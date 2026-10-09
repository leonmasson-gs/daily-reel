import { NextResponse } from "next/server";
import { ready, logEvent } from "@/lib/db";
import { currentPlayerId } from "@/lib/session";
import { buildState } from "@/lib/game";
import { performSpin } from "@/lib/spin";
import { nextReset } from "@/lib/dates";

export async function POST() {
  const playerId = await currentPlayerId();
  if (!playerId) {
    return NextResponse.json({ error: "age_gate_required", message: "Confirm your age to play." }, { status: 401 });
  }
  const db = await ready();
  await logEvent(playerId, "spin_attempted");

  try {
    const result = await db.tx((q) => performSpin(q, playerId));

    if (result.kind === "no_player") {
      return NextResponse.json({ error: "age_gate_required", message: "Confirm your age to play." }, { status: 401 });
    }
    if (result.kind === "no_spins") {
      return NextResponse.json(
        { error: "no_spins", message: "You've used all your spins for today.", resetsAt: nextReset() },
        { status: 429 },
      );
    }

    await logEvent(playerId, "spin_result", { outcome: result.spin.outcome, points: result.spin.points, bonus: result.isBonus });
    if (result.granted) await logEvent(result.inviter, "invite_redeemed", { invitee: playerId });
    for (const s of result.newSets) await logEvent(playerId, "set_completed", { set: s.id });
    if (result.tierUp) await logEvent(playerId, "tier_up", result.tierUp);
    if (result.trophy) await logEvent(playerId, "trophy_earned");
    if (result.grandReached) await logEvent(playerId, "grand_tier_reached");

    const state = await buildState(playerId);
    return NextResponse.json({
      result: { ...result.spin, isBonus: result.isBonus },
      newSets: result.newSets,
      tierUp: result.tierUp,
      trophy: result.trophy,
      grandReached: result.grandReached,
      bonusRound: result.bonusRound,
      missionDone: result.missionDone,
      state,
    });
  } catch (e: any) {
    // Two requests raced for the same spin number: the unique index let only one through.
    if (e?.code === "23505") {
      return NextResponse.json({ error: "busy", message: "Please try that spin again." }, { status: 409 });
    }
    console.error("spin failed", e);
    return NextResponse.json({ error: "server_error", message: "Something went wrong. Please try again." }, { status: 500 });
  }
}
