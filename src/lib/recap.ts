import type { Query } from "./db";
import { tierFor } from "./engine";
import { weekPoints } from "./game";
import { utcWeekStart } from "./dates";

export function previousWeekStart(now = new Date()): string {
  return utcWeekStart(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
}

export type Recap = {
  weekStart: string;
  tier: string;
  points: number;
  daysPlayed: number;
  spins: number;
  pairs: number;
  triples: number;
  symbolsDiscovered: number;
  setsCompleted: number;
};

/** Last week's summary, once. Null if there was no play last week or it was already seen. */
export async function getRecap(q: Query, playerId: string, now = new Date()): Promise<Recap | null> {
  const last = previousWeekStart(now);
  const [p] = await q<{ recap_seen_week: string | null }>("select recap_seen_week from players where id = $1", [playerId]);
  if (!p || (p.recap_seen_week && p.recap_seen_week >= last)) return null;

  const [stats] = await q<{ spins: number; days: number; pairs: number; triples: number }>(
    `select count(*)::int as spins, count(distinct play_date)::int as days,
            count(*) filter (where outcome = 'pair')::int as pairs,
            count(*) filter (where outcome = 'triple')::int as triples
       from spins where player_id = $1 and week_start = $2`,
    [playerId, last],
  );
  if (!stats || stats.spins === 0) return null;

  const points = await weekPoints(q, playerId, last);
  const [{ n: discovered }] = await q<{ n: number }>(
    `select count(*)::int as n from (
       select s as symbol, min(week_start) as first_week
         from spins, jsonb_array_elements_text(symbols) s
        where player_id = $1 group by s) t
      where first_week = $2`,
    [playerId, last],
  );
  const [{ n: sets }] = await q<{ n: number }>(
    "select count(*)::int as n from set_awards where player_id = $1 and week_start = $2",
    [playerId, last],
  );

  return {
    weekStart: last,
    tier: tierFor(points).current.name,
    points,
    daysPlayed: stats.days,
    spins: stats.spins,
    pairs: stats.pairs,
    triples: stats.triples,
    symbolsDiscovered: discovered,
    setsCompleted: sets,
  };
}

export async function markRecapSeen(q: Query, playerId: string, now = new Date()) {
  await q("update players set recap_seen_week = $2 where id = $1", [playerId, previousWeekStart(now)]);
}

