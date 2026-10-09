import { ready, type Query } from "./db";
import { config } from "./config";
import { tierFor } from "./engine";
import { nextReset, nextWeekReset, playDate, weekStart } from "./dates";
import { featuredSymbol } from "./featured";

export async function allowance(q: Query, playerId: string) {
  const today = playDate();
  const week = weekStart();

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
    "select count(*)::int as bonus_used from spins where player_id = $1 and week_start = $2 and is_bonus and not is_signup_bonus",
    [playerId, week],
  );
  // The fourth spin for saving an email: granted once, used once, whenever the player likes.
  const [{ granted, used }] = await q<{ granted: boolean; used: number }>(
    `select (select email_bonus_granted from players where id = $1) as granted,
            (select count(*)::int from spins where player_id = $1 and is_signup_bonus) as used`,
    [playerId],
  );

  const baseRemaining = Math.max(0, config.spinsPerDay - base_used);
  const bonusAllowance = Math.min(grants, config.bonusSpinsPerWeekCap);
  const inviteRemaining = Math.max(0, bonusAllowance - bonus_used);
  const signupRemaining = granted && used === 0 ? 1 : 0;
  return {
    spinsToday: spins_today,
    baseRemaining,
    signupRemaining,
    inviteRemaining,
    bonusRemaining: signupRemaining + inviteRemaining,
    remaining: baseRemaining + signupRemaining + inviteRemaining,
    bonusAllowance,
  };
}

/** Trophies earned in a week: one for each triple match. */
export async function weekTrophies(q: Query, playerId: string, week: string): Promise<number> {
  const [row] = await q<{ n: number }>(
    "select count(*)::int as n from spins where player_id = $1 and week_start = $2 and outcome = 'triple'",
    [playerId, week],
  );
  return row.n;
}

/** Points for a given week: spin points plus one-off set bonuses awarded that week. */
export async function weekPoints(q: Query, playerId: string, week: string): Promise<number> {
  const [row] = await q<{ points: number }>(
    `select ((select coalesce(sum(points + bonus_points), 0) from spins where player_id = $1 and week_start = $2)
           + (select coalesce(sum(points), 0) from set_awards where player_id = $1 and week_start = $2))::int as points`,
    [playerId, week],
  );
  return row.points;
}

/** Distinct symbols this player has ever landed. */
export async function ownedSymbols(q: Query, playerId: string): Promise<Set<string>> {
  const rows = await q<{ s: string }>(
    "select distinct s from spins, jsonb_array_elements_text(symbols) s where player_id = $1",
    [playerId],
  );
  return new Set(rows.map((r) => r.s));
}

export async function buildState(playerId: string) {
  const db = await ready();
  const q = db.query;
  const week = weekStart();

  const [player] = await q<{ invite_code: string; email: string | null; rewards_notify: boolean }>(
    "select invite_code, email, rewards_notify from players where id = $1",
    [playerId],
  );
  if (!player) return null;

  const a = await allowance(q, playerId);
  const points = await weekPoints(q, playerId, week);
  const collectionRows = await q<{ symbol: string; n: number }>(
    `select s as symbol, count(*)::int as n
       from spins, jsonb_array_elements_text(symbols) s
      where player_id = $1 group by s`,
    [playerId],
  );
  const todays = await q<{ symbols: string[]; outcome: string; points: number; is_bonus: boolean }>(
    "select symbols, outcome, points, is_bonus from spins where player_id = $1 and play_date = $2 order by spin_number",
    [playerId, playDate()],
  );
  const days = await q<{ play_date: string }>(
    "select distinct play_date from spins where player_id = $1 and week_start = $2 order by play_date",
    [playerId, week],
  );
  const awards = await q<{ set_id: string }>("select set_id from set_awards where player_id = $1", [playerId]);
  const awarded = new Set(awards.map((r) => r.set_id));
  const owned = new Set(collectionRows.map((r) => r.symbol));
  const { current, next } = tierFor(points);
  const trophies = await weekTrophies(q, playerId, week);
  const [weeks] = await q<{ regular: number; full: number }>(
    `select count(*) filter (where d >= $2)::int as regular, count(*) filter (where d >= $3)::int as full
       from (select count(distinct play_date) as d from spins where player_id = $1 group by week_start) t`,
    [playerId, config.rewards.regular.daysNeeded, config.rewards.regular.fullWeekDays],
  );

  return {
    inviteCode: player.invite_code,
    emailSaved: Boolean(player.email),
    rewardsNotify: player.rewards_notify,
    featured: { id: featuredSymbol(playDate()), multiplier: config.featured.multiplier },
    rewards: { weeksRegular: weeks.regular, weeksFull: weeks.full },
    spins: {
      perDay: config.spinsPerDay,
      remaining: a.remaining,
      baseRemaining: a.baseRemaining,
      bonusRemaining: a.bonusRemaining,
      signupBonusRemaining: a.signupRemaining,
      bonusCapPerWeek: config.bonusSpinsPerWeekCap,
      resetsAt: nextReset(),
    },
    today: todays,
    collection: Object.fromEntries(collectionRows.map((r) => [r.symbol, r.n])),
    sets: config.sets.map((s) => ({
      id: s.id,
      name: s.name,
      symbols: s.symbols,
      points: s.points,
      found: s.symbols.filter((id) => owned.has(id)).length,
      total: s.symbols.length,
      complete: awarded.has(s.id),
    })),
    week: {
      start: week,
      today: playDate(),
      resetsAt: nextWeekReset(),
      trophies,
      trophiesNeeded: config.trophies.needed,
      grand: trophies >= config.trophies.needed,
      daysPlayed: days.map((d) => d.play_date),
      points,
      tier: current,
      nextTier: next,
      pointsToNext: next ? next.minPoints - points : 0,
    },
  };
}
