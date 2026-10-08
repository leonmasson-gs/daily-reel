import type { Query } from "./db";
import { config } from "./config";
import { spinOnce, tierFor, type SpinResult } from "./engine";
import { allowance, ownedSymbols, weekPoints } from "./game";
import { utcDate, utcWeekStart } from "./dates";

export type SpinOutcome =
  | { kind: "no_player" }
  | { kind: "no_spins" }
  | {
      kind: "ok";
      spin: SpinResult;
      isBonus: boolean;
      granted: boolean;
      inviter: string | null;
      newSets: { id: string; name: string; points: number }[];
      tierUp: { from: string; to: string } | null;
    };

/**
 * One spin, inside a transaction the caller provides.
 * `draw` is injectable so tests can force a result. Production always uses the default.
 */
export async function performSpin(q: Query, playerId: string, draw: () => SpinResult = spinOnce): Promise<SpinOutcome> {
  const players = await q<{ invited_by: string | null }>("select invited_by from players where id = $1", [playerId]);
  if (!players.length) return { kind: "no_player" };

  const a = await allowance(q, playerId);
  if (a.remaining <= 0) return { kind: "no_spins" };

  const week = utcWeekStart();
  const before = await weekPoints(q, playerId, week);

  const spin = draw();
  const isBonus = a.baseRemaining === 0;
  await q(
    `insert into spins (player_id, play_date, week_start, spin_number, is_bonus, symbols, outcome, points)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [playerId, utcDate(), week, a.spinsToday + 1, isBonus, JSON.stringify(spin.symbols), spin.outcome, spin.points],
  );

  // A friend's first spin earns their inviter a bonus spin (capped per week when counted).
  let granted = false;
  const inviter = players[0].invited_by;
  if (inviter && inviter !== playerId) {
    const rows = await q<{ id: number }>(
      `insert into bonus_grants (inviter_id, invitee_id, week_start) values ($1, $2, $3)
       on conflict (invitee_id) do nothing returning id`,
      [inviter, playerId, week],
    );
    granted = rows.length > 0;
  }

  // Completed sets pay a one-off bonus.
  const owned = await ownedSymbols(q, playerId);
  const done = new Set((await q<{ set_id: string }>("select set_id from set_awards where player_id = $1", [playerId])).map((r) => r.set_id));
  const newSets: { id: string; name: string; points: number }[] = [];
  for (const s of config.sets) {
    if (done.has(s.id) || !s.symbols.every((id) => owned.has(id))) continue;
    const rows = await q<{ id: number }>(
      `insert into set_awards (player_id, set_id, week_start, points) values ($1, $2, $3, $4)
       on conflict (player_id, set_id) do nothing returning id`,
      [playerId, s.id, week, s.points],
    );
    if (rows.length) newSets.push({ id: s.id, name: s.name, points: s.points });
  }

  const after = await weekPoints(q, playerId, week);
  const t0 = tierFor(before).current;
  const t1 = tierFor(after).current;
  const tierUp = t1.id !== t0.id ? { from: t0.name, to: t1.name } : null;

  return { kind: "ok", spin, isBonus, granted, inviter, newSets, tierUp };
}
