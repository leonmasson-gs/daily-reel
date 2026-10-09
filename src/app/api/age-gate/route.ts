import { NextResponse } from "next/server";
import { randomBytes, randomUUID } from "node:crypto";
import { ready, logEvent } from "@/lib/db";
import { ageOn, minAgeFor } from "@/lib/dates";
import { currentPlayerId, setPlayerCookie } from "@/lib/session";

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
function inviteCode() {
  return Array.from(randomBytes(8), (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const dob = typeof body.dob === "string" ? body.dob : "";
  const ref = typeof body.ref === "string" ? body.ref.slice(0, 16) : "";

  // 18 in most places, 21 for visitors connecting from the US (state rules vary, so the stricter age is used).
  const minAge = minAgeFor(req.headers.get("x-vercel-ip-country"));

  // The normal route is a single tap: "I am 18 or over" or "I am under 18". It is a declaration, not a verified check.
  // A date of birth is still accepted from older callers, checked, and thrown away. It is never stored.
  let underAge: boolean;
  if (typeof body.over === "boolean") {
    underAge = body.over === false;
  } else {
    const age = ageOn(dob);
    if (age === null) {
      return NextResponse.json({ error: "invalid_dob", message: "Please confirm your age." }, { status: 400 });
    }
    underAge = age < minAge;
  }
  if (underAge) {
    await logEvent(null, "age_gate_blocked"); // counted only, no identity kept
    return NextResponse.json(
      { error: "under_age", message: `You must be ${minAge} or over to play.` },
      { status: 403 },
    );
  }

  const db = await ready();
  const existing = await currentPlayerId();
  if (existing) {
    const rows = await db.query("select 1 from players where id = $1", [existing]);
    if (rows.length) return NextResponse.json({ ok: true, returning: true });
  }

  let invitedBy: string | null = null;
  if (ref) {
    const rows = await db.query<{ id: string }>("select id from players where invite_code = $1", [ref]);
    invitedBy = rows[0]?.id ?? null;
  }

  const id = randomUUID();
  await db.query("insert into players (id, invite_code, invited_by) values ($1, $2, $3)", [id, inviteCode(), invitedBy]);
  await setPlayerCookie(id);
  await logEvent(id, "age_gate_passed", { invited: Boolean(invitedBy) });
  return NextResponse.json({ ok: true, returning: false });
}
