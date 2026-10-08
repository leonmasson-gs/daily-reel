import type { Query } from "./db";
import { config, totalWeight, publishedOdds } from "./config";
import { tierFor } from "./engine";
import { utcDate, utcWeekStart } from "./dates";

const DAY = 86400000;
const dayStr = (d: Date) => d.toISOString().slice(0, 10);

function lastDays(n: number, now = new Date()): string[] {
  return Array.from({ length: n }, (_, i) => dayStr(new Date(now.getTime() - (n - 1 - i) * DAY)));
}
const pctOf = (a: number, b: number) => (b > 0 ? a / b : null);

/** Aggregate numbers only. No emails, no player ids, nothing that identifies a person. */
export async function getStats(q: Query, now = new Date()) {
  const today = utcDate(now);
  const week = utcWeekStart(now);
  const days = lastDays(14, now);

  const one = async <T,>(sql: string, params: unknown[] = []) => (await q<T>(sql, params))[0];

  const { players } = await one<{ players: number }>("select count(*)::int as players from players");
  const { spinners } = await one<{ spinners: number }>("select count(distinct player_id)::int as spinners from spins");
  const { total_spins, spins_today } = await one<{ total_spins: number; spins_today: number }>(
    "select count(*)::int as total_spins, count(*) filter (where play_date = $1)::int as spins_today from spins",
    [today],
  );

  // Enjoyable
  const { player_days, full_days } = await one<{ player_days: number; full_days: number }>(
    `select count(*)::int as player_days, count(*) filter (where n >= $1)::int as full_days
       from (select player_id, play_date, count(*) n from spins group by player_id, play_date) t`,
    [config.spinsPerDay],
  );

  // Come back
  const { eligible, returned } = await one<{ eligible: number; returned: number }>(
    `with t as (select player_id, min(play_date) fd, max(play_date) ld from spins group by player_id)
     select count(*) filter (where fd < $1)::int as eligible,
            count(*) filter (where fd < $1 and ld > fd)::int as returned from t`,
    [today],
  );
  const { multi_day } = await one<{ multi_day: number }>(
    `select count(*)::int as multi_day from (select player_id from spins group by player_id having count(distinct play_date) >= 2) t`,
  );
  const dau = await q<{ d: string; n: number }>(
    "select play_date as d, count(distinct player_id)::int as n from spins where play_date >= $1 group by play_date",
    [days[0]],
  );
  const joined = await q<{ d: string; n: number }>(
    "select to_char(created_at at time zone 'UTC', 'YYYY-MM-DD') as d, count(*)::int as n from players group by 1",
  );
  const daysHist = await q<{ days: number; n: number }>(
    `select days, count(*)::int as n from (select count(distinct play_date)::int as days from spins where week_start = $1 group by player_id) t group by days order by days`,
    [week],
  );

  // Email
  const { emails } = await one<{ emails: number }>("select count(*)::int as emails from players where email is not null and id in (select player_id from spins)");

  // With friends
  const { via_invite } = await one<{ via_invite: number }>("select count(*)::int as via_invite from players where invited_by is not null");
  const { grants } = await one<{ grants: number }>("select count(*)::int as grants from bonus_grants");

  // Events
  const ev = Object.fromEntries((await q<{ name: string; n: number }>("select name, count(*)::int as n from events group by name")).map((r) => [r.name, r.n]));
  const clicksByRegion = await q<{ region: string | null; n: number }>(
    "select meta->>'region' as region, count(*)::int as n from events where name = 'offer_clicked' group by 1 order by 2 desc",
  );

  // Progress and sets
  const setRows = await q<{ set_id: string; n: number }>("select set_id, count(*)::int as n from set_awards group by set_id");
  const weekly = await q<{ points: number }>(
    `select (coalesce(sp.pts, 0) + coalesce(sa.pts, 0))::int as points
       from (select distinct player_id from spins where week_start = $1) p
       left join (select player_id, sum(points) pts from spins where week_start = $1 group by player_id) sp using (player_id)
       left join (select player_id, sum(points) pts from set_awards where week_start = $1 group by player_id) sa using (player_id)`,
    [week],
  );
  const tiers = config.tiers.map((t) => ({ name: t.name, players: 0 }));
  for (const r of weekly) {
    const idx = config.tiers.findIndex((t) => t.id === tierFor(r.points).current.id);
    tiers[idx].players += 1;
  }

  // Fairness: observed against published
  const outcomes = Object.fromEntries((await q<{ outcome: string; n: number }>("select outcome, count(*)::int as n from spins group by outcome")).map((r) => [r.outcome, r.n]));
  const reelRows = await q<{ s: string; n: number }>(
    "select s, count(*)::int as n from spins, jsonb_array_elements_text(symbols) s group by s",
  );
  const reelTotal = reelRows.reduce((n, r) => n + r.n, 0);
  const odds = publishedOdds();
  const byReel = Object.fromEntries(reelRows.map((r) => [r.s, r.n]));

  return {
    generatedAt: now.toISOString(),
    today,
    totals: { players, spinners, totalSpins: total_spins, spinsToday: spins_today },
    answers: {
      enjoyable: {
        spinsPerPlayer: spinners ? total_spins / spinners : null,
        fullDayShare: pctOf(full_days, player_days),
        playerDays: player_days,
      },
      comeBack: {
        returnRate: pctOf(returned, eligible),
        eligible,
        returned,
        multiDayPlayers: multi_day,
        multiDayShare: pctOf(multi_day, spinners),
      },
      email: { captured: emails, rate: pctOf(emails, spinners) },
      friends: {
        copies: ev.invite_copied ?? 0,
        joinedViaInvite: via_invite,
        redeemed: grants,
        shares: ev.share_card ?? 0,
      },
      monetise: {
        views: ev.offer_viewed ?? 0,
        clicks: ev.offer_clicked ?? 0,
        ctr: pctOf(ev.offer_clicked ?? 0, ev.offer_viewed ?? 0),
        byRegion: clicksByRegion.map((r) => ({ region: r.region ?? "Unknown", clicks: r.n })),
      },
    },
    daily: days.map((d) => ({
      date: d,
      active: dau.find((r) => r.d === d)?.n ?? 0,
      joined: joined.find((r) => r.d === d)?.n ?? 0,
    })),
    daysPlayedThisWeek: daysHist.map((r) => ({ days: r.days, players: r.n })),
    progress: {
      tiersThisWeek: tiers,
      sets: config.sets.map((s) => ({ name: s.name, completed: setRows.find((r) => r.set_id === s.id)?.n ?? 0 })),
      introCompleted: ev.intro_completed ?? 0,
      introSkipped: ev.intro_skipped ?? 0,
      tierUps: ev.tier_up ?? 0,
      recapsViewed: ev.recap_viewed ?? 0,
    },
    fairness: {
      spins: total_spins,
      pair: { observed: pctOf(outcomes.pair ?? 0, total_spins), published: odds.pair },
      triple: { observed: pctOf(outcomes.triple ?? 0, total_spins), published: odds.triple },
      reels: config.symbols.map((s) => ({
        name: s.name,
        observed: pctOf(byReel[s.id] ?? 0, reelTotal),
        published: s.weight / totalWeight,
      })),
    },
    guardrails: {
      agePassed: ev.age_gate_passed ?? 0,
      ageBlocked: ev.age_gate_blocked ?? 0,
      oddsViewed: ev.odds_viewed ?? 0,
    },
  };
}
