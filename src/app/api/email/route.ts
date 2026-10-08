import { NextResponse } from "next/server";
import { ready, logEvent } from "@/lib/db";
import { currentPlayerId } from "@/lib/session";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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
  // Prototype: reminders are logged, not sent.
  return NextResponse.json({ ok: true });
}
