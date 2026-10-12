import { NextResponse } from "next/server";
import { ready } from "@/lib/db";
import { isAdmin } from "@/lib/admin";
import { currentPlayerId } from "@/lib/session";
import { nextReset, playDate } from "@/lib/dates";

/**
 * For presenters. Replays today for the player in THIS browser only: today's spins, today's mission, sets finished
 * today and the saved email are cleared, so the demo can be shown again without a new private window or a new player
 * on the stats page. Needs the admin sign-in. Events already logged stay in the stats.
 */
export async function POST() {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorised", message: "Sign in to the stats page first." }, { status: 401 });
  const pid = await currentPlayerId();
  if (!pid) return NextResponse.json({ error: "no_player", message: "This browser has no player yet. Open the game and confirm your age first." }, { status: 400 });
  const day = playDate();
  const dayStart = new Date(new Date(nextReset()).getTime() - 24 * 3600 * 1000).toISOString();
  const db = await ready();
  const cleared = await db.tx(async (q) => {
    const spins = await q<{ id: number }>("delete from spins where player_id = $1 and play_date = $2 returning id", [pid, day]);
    await q("delete from mission_awards where player_id = $1 and play_date = $2", [pid, day]);
    await q("delete from set_awards where player_id = $1 and created_at >= $2", [pid, dayStart]);
    await q("update players set email = null, email_consent = false, email_bonus_granted = false where id = $1", [pid]);
    return spins.length;
  });
  return NextResponse.json({ ok: true, spinsCleared: cleared });
}
