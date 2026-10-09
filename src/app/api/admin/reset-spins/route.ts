import { NextResponse } from "next/server";
import { ready, logEvent } from "@/lib/db";
import { isAdmin } from "@/lib/admin";
import { currentPlayerId } from "@/lib/session";
import { playDate } from "@/lib/dates";

/**
 * A testing and demo tool. If this browser is signed in to the stats page AND is also a player, it clears that
 * player's spins for the current day so they can be played again. It touches only that one player. It changes the
 * stats (the removed spins no longer count), which is why it sits behind the admin key.
 */
export async function POST() {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const playerId = await currentPlayerId();
  if (!playerId) {
    return NextResponse.json({ error: "no_player", message: "This browser has not played yet. Open the game here, pass the age check, then try again." }, { status: 400 });
  }
  const db = await ready();
  const removed = await db.query<{ id: number }>("delete from spins where player_id = $1 and play_date = $2 returning id", [playerId, playDate()]);
  await logEvent(playerId, "admin_reset_spins", { removed: removed.length });
  return NextResponse.json({ ok: true, removed: removed.length });
}
