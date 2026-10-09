import { NextResponse } from "next/server";
import { ready, logEvent } from "@/lib/db";
import { currentPlayerId } from "@/lib/session";
import { playDate } from "@/lib/dates";

// One tap a day: how was today's play? 1 = good, 2 = okay, 3 = not for me. It answers the brief's "Enjoyable" question directly.
export async function POST(req: Request) {
  const playerId = await currentPlayerId();
  if (!playerId) return NextResponse.json({ error: "age_gate_required" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (![1, 2, 3].includes(body.score)) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const db = await ready();
  const day = playDate();
  const seen = await db.query("select 1 from events where player_id = $1 and name = 'enjoyment' and meta->>'day' = $2", [playerId, day]);
  if (!seen.length) await logEvent(playerId, "enjoyment", { score: body.score, day });
  return NextResponse.json({ ok: true });
}
