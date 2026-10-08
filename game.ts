import { ready, type Query } from "./db";
import { config } from "./config";
import { tierFor } from "./engine";
import { nextUtcMidnight, utcDate, utcWeekStart } from "./dates";

export async function allowance(q: Query, playerId: string) {
  const today = utcDate();
  const week = utcWeekStart();

  const [{ base_used, spins_today }] = await q<{ base_used: number; spins_today: number }>(
    `select count(*) filter (where not is_bonus)::int as base_used, count(*)::int as spins_today
       from spins where player_id = $1 and play_date = $2`,
    [playerId, today],
  );
  const [{ grants }] = await q<{ grants: number }>(
    "select count(*)::int as grants from bonus_grants where inviter_id = $1 and week_start = $2",
    [playerId, week],
  );
  const [{ bonus_used }] = await q<{ bonus_used: number }>(
    "select count(*)::int as bonus_used from spins where player_id = $1 and week_start = $2 and is_bonus",
    [playerId, week],
  );

  const baseRemaining = Math.max(0, config.spinsPerDay - base_used);
  const bonusAllowance = Math.min(grants, config.bonusSpinsPerWeekCap);
  const bonusRemaining = Math.max(0, bonusAllowance - bonus_used);
  return {
    spinsToday: spins_today,
    baseRemaining,
    bonusRemaining,
    remaining: baseRemaining + bonusRemaining,
    bonusAllowance,
  };
}

export async function buildState(playerId: string) {
  const db = await ready();
  const q = db.query;
  const week = utcWeekStart();

  const [player] = await q<{ invite_code: string; email: string | null }>(
    "select invite_code, email from players where id = $1",
    [playerId],
  );
  if (!player) return null;

  const a = await allowance(q, playerId);
  const [{ points }] = await q<{ points: number }>(
    "select coalesce(sum(points), 0)::int as points from spins where player_id = $1 and week_start = $2",
    [playerId, week],
  );
  const collectionRows = await q<{ symbol: string; n: number }>(
    `select s as symbol, count(*)::int as n
       from spins, jsonb_array_elements_text(symbols) s
      where player_id = $1 group by s`,
    [playerId],
  );
  const todays = await q<{ symbols: string[]; outcome: string; points: number; is_bonus: boolean }>(
    "select symbols, outcome, points, is_bonus from spins where player_id = $1 and play_date = $2 order by spin_number",
    [playerId, utcDate()],
  );
  const { current, next } = tierFor(points);

  return {
    inviteCode: player.invite_code,
    emailSaved: Boolean(player.email),
    spins: {
      perDay: config.spinsPerDay,
      remaining: a.remaining,
      baseRemaining: a.baseRemaining,
      bonusRemaining: a.bonusRemaining,
      bonusCapPerWeek: config.bonusSpinsPerWeekCap,
      resetsAt: nextUtcMidnight(),
    },
    today: todays,
    collection: Object.fromEntries(collectionRows.map((r) => [r.symbol, r.n])),
    week: {
      start: week,
      points,
      tier: current,
      nextTier: next,
      pointsToNext: next ? next.minPoints - points : 0,
    },
  };
}
