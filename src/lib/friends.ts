import { randomInt } from "node:crypto";
import type { Query } from "./db";
import { config } from "./config";
import { tierFor } from "./engine";
import { weekStart } from "./dates";

/*
  The friends board. Two players are friends when one invited the other, so "friends" means the person who invited you
  and the people you invited. A friend sees only a random nickname, a tier, points, trophies and which symbols
  you have found. Never an email, never anything you typed. Nicknames are generated, so there is nothing to moderate.
*/

const ADJECTIVES = ["Quick", "Bright", "Calm", "Bold", "Lucky", "Swift", "Merry", "Keen", "Sunny", "Steady", "Clever", "Brave"];
const NOUNS = ["Cherry", "Bell", "Lemon", "Clover", "Star", "Gem", "Crown", "Reel"];

export function makeNickname(): string {
  return `${ADJECTIVES[randomInt(ADJECTIVES.length)]} ${NOUNS[randomInt(NOUNS.length)]} ${randomInt(10, 100)}`;
}

export async function ensureNickname(q: Query, id: string): Promise<string> {
  const [r] = await q<{ nickname: string | null }>("select nickname from players where id = $1", [id]);
  if (r?.nickname) return r.nickname;
  const nick = makeNickname();
  await q("update players set nickname = $2 where id = $1 and nickname is null", [id, nick]);
  const [r2] = await q<{ nickname: string | null }>("select nickname from players where id = $1", [id]);
  return r2?.nickname ?? nick;
}

export async function shuffleNickname(q: Query, id: string): Promise<string> {
  const nick = makeNickname();
  await q("update players set nickname = $2 where id = $1", [id, nick]);
  return nick;
}

export async function setVisibility(q: Query, id: string, visible: boolean) {
  await q("update players set board_visible = $2 where id = $1", [id, visible]);
}

export type BoardEntry = {
  nickname: string;
  you: boolean;
  hidden: boolean;
  tier?: string;
  points?: number;
  trophies?: number;
  sets?: number;
  found?: string[];
};

const marks = (from: number, n: number) => Array.from({ length: n }, (_, i) => `$${from + i}`).join(", ");

export async function getBoard(q: Query, me: string) {
  const week = weekStart();
  const [self] = await q<{ invited_by: string | null; board_visible: boolean }>(
    "select invited_by, board_visible from players where id = $1",
    [me],
  );
  if (!self) return null;

  const friendRows = await q<{ id: string; board_visible: boolean }>(
    "select id, board_visible from players where invited_by = $1 or id = $2 order by created_at limit 60",
    [me, self.invited_by],
  );
  const ids = [me, ...friendRows.map((r) => r.id).filter((id) => id !== me)];
  const hiddenIds = new Set(friendRows.filter((r) => !r.board_visible).map((r) => r.id));
  const list = marks(1, ids.length);

  const spinPts = await q<{ player_id: string; n: number }>(
    `select player_id, sum(points)::int as n from spins where week_start = $${ids.length + 1} and player_id in (${list}) group by player_id`,
    [...ids, week],
  );
  const setPts = await q<{ player_id: string; n: number }>(
    `select player_id, sum(points)::int as n from set_awards where week_start = $${ids.length + 1} and player_id in (${list}) group by player_id`,
    [...ids, week],
  );
  const trophies = await q<{ player_id: string; n: number }>(
    `select player_id, count(*)::int as n from spins where week_start = $${ids.length + 1} and outcome = 'triple' and player_id in (${list}) group by player_id`,
    [...ids, week],
  );
  const found = await q<{ player_id: string; symbol: string }>(
    `select player_id, s as symbol from spins, jsonb_array_elements_text(symbols) s where player_id in (${list}) group by player_id, s`,
    ids,
  );
  const sets = await q<{ player_id: string; n: number }>(
    `select player_id, count(*)::int as n from set_awards where player_id in (${list}) group by player_id`,
    ids,
  );

  const order = config.symbols.map((s) => s.id);
  const entry = async (id: string): Promise<BoardEntry> => {
    const nickname = await ensureNickname(q, id);
    const you = id === me;
    if (!you && hiddenIds.has(id)) return { nickname: "Private friend", you: false, hidden: true };
    const points = (spinPts.find((r) => r.player_id === id)?.n ?? 0) + (setPts.find((r) => r.player_id === id)?.n ?? 0);
    const mine = new Set(found.filter((r) => r.player_id === id).map((r) => r.symbol));
    return {
      nickname, you, hidden: false,
      tier: tierFor(points).current.name,
      points,
      trophies: trophies.find((r) => r.player_id === id)?.n ?? 0,
      sets: sets.find((r) => r.player_id === id)?.n ?? 0,
      found: order.filter((s) => mine.has(s)),
    };
  };

  const meEntry = await entry(me);
  const others = await Promise.all(ids.filter((id) => id !== me).map(entry));
  others.sort((a, b) => (b.found?.length ?? -1) - (a.found?.length ?? -1) || (b.points ?? -1) - (a.points ?? -1));
  return { me: meEntry, friends: others, visible: self.board_visible, week };
}
