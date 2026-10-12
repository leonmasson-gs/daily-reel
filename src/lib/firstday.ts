import type { Query } from "./db";
import { playDate } from "./dates";

/**
 * A player's first play day is kept simple: the reels, the collection and the tier. The daily boost and the daily
 * mission start on their second play day. This is decided on the server, so the points always match what the player sees.
 */
export async function isFirstPlayDay(q: Query, playerId: string): Promise<boolean> {
  const rows = await q<{ n: number }>("select count(*)::int as n from spins where player_id = $1 and play_date < $2", [playerId, playDate()]);
  return rows[0].n === 0;
}
