import type { Query } from "./db";
import { config } from "./config";
import { cryptoRng, spinOnce, tierFor, type SpinResult } from "./engine";
import { featuredSymbol } from "./featured";
import { boostForDay } from "./boosts";
import { awardMissionIfDone, type Mission } from "./missions";
import { allowance, ownedSymbols, weekPoints, weekTrophies } from "./game";
import { playDate, weekStart } from "./dates";

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
      trophy: boolean;
      grandReached: boolean;
      bonusRound: boolean;
      missionDone: Mission | null;
    };

/**
 * One spin, inside a transaction the caller provides.
 * `draw` is injectable so tests can force a result. Production always uses the default.
 */
export async function performSpin(q: Query, playerId: string, draw: () => SpinResult = () => spinOnce(cryptoRng, featuredSymbol(playDate()), boostForDay(playDate()).spec)): Promise<SpinOutcome> {
  const players = await q<{ invited_by: string | null }>("select invited_by from players where id = $1", [playerId]);
  if (!players.length) return { kind: "no_player" };

  const a = await allowance(q, playerId);
  if (a.remaining <= 0) return { kind: "no_spins" };

  const week = weekStart();
  const before = await weekPoints(q, playerId, week);
  const trophiesBefore = await weekTrophies(q, playerId, week);

  const spin = draw();
  // Order of use: the three daily spins, then the fourth spin from saving an email, then invite bonus spins.
  const isBonus = a.baseRemaining === 0;
  const isSignup = isBonus && a.signupRemaining > 0;
  await q(
    `insert into spins (player_id, play_date, week_start, spin_number, is_bonus, is_signup_bonus, symbols, outcome, points)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [playerId, playDate(), week, a.spinsToday + 1, isBonus, isSignup, JSON.stringify(spin.symbols), spin.outcome, spin.points],
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

  // The day's mission pays once, the first time it is complete.
  const missionDone = await awardMissionIfDone(q, playerId);

  const after = await weekPoints(q, playerId, week);
  const t0 = tierFor(before).current;
  const t1 = tierFor(after).current;
  const tierUp = t1.id !== t0.id ? { from: t0.name, to: t1.name } : null;

  // A trophy for every triple match. Three in a week reach the Grand tier (a preview: nothing is awarded).
  const trophy = spin.outcome === "triple";
  const trophiesAfter = trophiesBefore + (trophy ? 1 : 0);
  const grandReached = trophiesBefore < config.trophies.needed && trophiesAfter >= config.trophies.needed;

  return { kind: "ok", spin, isBonus, granted, inviter, newSets, tierUp, trophy, grandReached, bonusRound: trophy, missionDone };
}
