import { NextResponse } from "next/server";
import { ready, logEvent } from "@/lib/db";
import { currentPlayerId } from "@/lib/session";
import { buildState } from "@/lib/game";
import { claimBonus } from "@/lib/bonus";

export async function POST(req: Request) {
  const playerId = await currentPlayerId();
  if (!playerId) return NextResponse.json({ error: "age_gate_required", message: "Confirm your age to play." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const skip = body.skip === true;
  const accuracy = typeof body.accuracy === "number" ? body.accuracy : NaN;
  if (!skip && !Number.isFinite(accuracy)) return NextResponse.json({ error: "invalid", message: "Send an accuracy between 0 and 1, or skip." }, { status: 400 });

  const db = await ready();
  const r = await db.tx((q) => claimBonus(q, playerId, { accuracy, skip }));
  if (r.kind === "none") {
    return NextResponse.json({ error: "no_bonus", message: "There is no bonus round waiting. It may already have been played, or it has expired." }, { status: 409 });
  }
  await logEvent(playerId, "bonus_played", { label: r.label, points: r.points });
  const state = await buildState(playerId);
  return NextResponse.json({ ok: true, label: r.label, points: r.points, tierUp: r.tierUp, state });
}
