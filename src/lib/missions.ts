import { createHash } from "node:crypto";
import type { Query } from "./db";
import { config } from "./config";
import { playDate, weekStart } from "./dates";

export type Mission = { id: string; title: string; points: number; symbol: string | null };

/** One small goal a day, the same for every player. It only ever pays a few points. It uses the day's spins and adds none. */
export function missionFor(pd: string): Mission {
  const list = config.missions.list;
  const h = createHash("sha256").update("mission:" + pd).digest();
  const def = list[h[0] % list.length];
  const ids = config.symbols.filter((s) => s.rarity !== "Legendary").map((s) => s.id);
  return { id: def.id, title: def.title, points: def.points, symbol: def.id === "land-symbol" ? ids[h[1] % ids.length] : null };
}

const rarityOf = new Map(config.symbols.map((s) => [s.id, s.rarity]));

export async function missionStatus(q: Query, playerId: string) {
  const pd = playDate();
  const m = missionFor(pd);
  const rows = await q<{ symbols: string[]; outcome: string; points: number }>(
    "select symbols, outcome, points from spins where player_id = $1 and play_date = $2",
    [playerId, pd],
  );
  const syms = rows.flatMap((r) => r.symbols);
  const done =
    m.id === "land-symbol" ? syms.includes(m.symbol!) :
    m.id === "match-pair" ? rows.some((r) => r.outcome !== "none") :
    m.id === "rare-find" ? syms.some((id) => rarityOf.get(id) !== "Common") :
    m.id === "score-20" ? rows.reduce((n, r) => n + r.points, 0) >= 20 : false;
  const [aw] = await q<{ n: number }>("select count(*)::int as n from mission_awards where player_id = $1 and play_date = $2", [playerId, pd]);
  return { ...m, done, awarded: aw.n > 0 };
}

/** Pays the day's mission once, the first time it is completed. */
export async function awardMissionIfDone(q: Query, playerId: string): Promise<Mission | null> {
  const st = await missionStatus(q, playerId);
  if (!st.done || st.awarded) return null;
  const rows = await q<{ mission_id: string }>(
    `insert into mission_awards (player_id, play_date, week_start, mission_id, points) values ($1, $2, $3, $4, $5)
     on conflict (player_id, play_date) do nothing returning mission_id`,
    [playerId, playDate(), weekStart(), st.id, st.points],
  );
  return rows.length ? { id: st.id, title: st.title, points: st.points, symbol: st.symbol } : null;
}
