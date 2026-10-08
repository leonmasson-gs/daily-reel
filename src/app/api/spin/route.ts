import { NextResponse } from "next/server";
import { ready, logEvent } from "@/lib/db";
import { currentPlayerId } from "@/lib/session";
import { allowance, buildState } from "@/lib/game";
import { spinOnce } from "@/lib/engine";
import { nextUtcMidnight, utcDate, utcWeekStart } from "@/lib/dates";

export async function POST() {
  const playerId = await currentPlayerId();
  if (!playerId) {
    return NextResponse.json({ error: "age_gate_required", message: "Confirm your age to play." }, { status: 401 });
  }
  const db = await ready();
  await logEvent(playerId, "spin_attempted");

  try {
    const result = await db.tx(async (q) => {
      const players = await q<{ invited_by: string | null }>("select invited_by from players where id = $1", [playerId]);
      if (!players.length) return { kind: "no_player" as const };

      const a = await allowance(q, playerId);
      if (a.remaining <= 0) return { kind: "no_spins" as const };

      const spin = spinOnce();
      const isBonus = a.baseRemaining === 0;
      const spinNumber = a.spinsToday + 1;

      await q(
        `insert into spins (player_id, play_date, week_start, spin_number, is_bonus, symbols, outcome, points)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [playerId, utcDate(), utcWeekStart(), spinNumber, isBonus, JSON.stringify(spin.symbols), spin.outcome, spin.points],
      );

      // A friend's first spin earns their inviter a bonus spin (capped per week when counted).
      let granted = false;
      const inviter = players[0].invited_by;
      if (inviter && inviter !== playerId) {
        const rows = await q<{ id: number }>(
          `insert into bonus_grants (inviter_id, invitee_id, week_start) values ($1, $2, $3)
           on conflict (invitee_id) do nothing returning id`,
          [inviter, playerId, utcWeekStart()],
        );
        granted = rows.length > 0;
      }
      return { kind: "ok" as const, spin, isBonus, granted, inviter };
    });

    if (result.kind === "no_player") {
      return NextResponse.json({ error: "age_gate_required", message: "Confirm your age to play." }, { status: 401 });
    }
    if (result.kind === "no_spins") {
      return NextResponse.json(
        { error: "no_spins", message: "You've used all your spins for today.", resetsAt: nextUtcMidnight() },
        { status: 429 },
      );
    }

    await logEvent(playerId, "spin_result", {
      outcome: result.spin.outcome,
      points: result.spin.points,
      bonus: result.isBonus,
    });
    if (result.granted) await logEvent(result.inviter, "invite_redeemed", { invitee: playerId });

    const state = await buildState(playerId);
    return NextResponse.json({ result: { ...result.spin, isBonus: result.isBonus }, state });
  } catch (e: any) {
    // Two requests raced for the same spin number: the unique index let only one through.
    if (e?.code === "23505") {
      return NextResponse.json({ error: "busy", message: "Please try that spin again." }, { status: 409 });
    }
    console.error("spin failed", e);
    return NextResponse.json({ error: "server_error", message: "Something went wrong. Please try again." }, { status: 500 });
  }
}
