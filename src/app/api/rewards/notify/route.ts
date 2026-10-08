import { NextResponse } from "next/server";
import { ready, logEvent } from "@/lib/db";
import { currentPlayerId } from "@/lib/session";

// A separate, explicit opt-in. Saving an email for spin reminders does not cover this.
export async function POST() {
  const playerId = await currentPlayerId();
  if (!playerId) return NextResponse.json({ error: "age_gate_required" }, { status: 401 });
  const db = await ready();
  const rows = await db.query<{ email: string | null }>("select email from players where id = $1", [playerId]);
  if (!rows[0]?.email) {
    return NextResponse.json({ error: "email_needed", message: "Save your email first, then you can ask to hear about rewards." }, { status: 400 });
  }
  await db.query("update players set rewards_notify = true where id = $1", [playerId]);
  await logEvent(playerId, "rewards_notify_optin");
  return NextResponse.json({ ok: true });
}
