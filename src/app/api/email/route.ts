import { NextResponse } from "next/server";
import { ready, logEvent } from "@/lib/db";
import { currentPlayerId } from "@/lib/session";

// Letters, digits and the usual . _ % + - ' in the local part. No angle brackets, quotes or spaces.
const EMAIL = /^[A-Za-z0-9._%+'-]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

export async function POST(req: Request) {
  const playerId = await currentPlayerId();
  if (!playerId) return NextResponse.json({ error: "age_gate_required" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 254) : "";
  const consent = body.consent === true;
  if (!EMAIL.test(email)) {
    return NextResponse.json({ error: "invalid_email", message: "Please enter a valid email address." }, { status: 400 });
  }
  if (!consent) {
    return NextResponse.json({ error: "consent_required", message: "Please tick the box to get reminders." }, { status: 400 });
  }
  const db = await ready();
  await db.query("update players set email = $2, email_consent = true where id = $1", [playerId, email]);
  await logEvent(playerId, "email_captured");

  // Saving an email earns one extra spin, once. It is not granted again to the same player, and not to a second
  // player who saves an address that has already earned one, so one email cannot be farmed for spins.
  let bonus = false;
  const [me] = await db.query<{ email_bonus_granted: boolean }>("select email_bonus_granted from players where id = $1", [playerId]);
  if (me && !me.email_bonus_granted) {
    const taken = await db.query("select 1 from players where email = $2 and email_bonus_granted and id <> $1", [playerId, email]);
    if (!taken.length) {
      await db.query("update players set email_bonus_granted = true where id = $1", [playerId]);
      await logEvent(playerId, "signup_bonus_granted");
      bonus = true;
    }
  }
  // Prototype: reminders are logged, not sent.
  return NextResponse.json({ ok: true, bonus });
}
