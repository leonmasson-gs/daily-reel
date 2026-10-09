// Checks the admin numbers against data where the right answers are known.
process.env.ALLOW_MEMORY_DB = "1";
import { randomUUID } from "node:crypto";
import { ready, logEvent } from "../src/lib/db";
import { getStats } from "../src/lib/stats";
import { addDays, playDate, weekStart } from "../src/lib/dates";
// The week a play date belongs to (weeks start on a Sunday play day).
const weekOf = (date: string) => addDays(date, -new Date(date + "T00:00:00Z").getUTCDay());

let failed = 0;
const ok = (label: string, cond: boolean, extra?: unknown) => { if (!cond) failed++; console.log(cond ? "PASS" : "FAIL", label, cond ? "" : JSON.stringify(extra)); };
const near = (a: number | null | undefined, b: number) => a != null && Math.abs(a - b) < 1e-9;

const db = await ready();
const day = (back: number) => addDays(playDate(), -back);
const mk = async (extra: Record<string, unknown> = {}) => {
  const id = randomUUID();
  await db.query("insert into players (id, invite_code, email, invited_by) values ($1,$2,$3,$4)", [id, id.slice(0, 8), (extra.email as string) ?? null, (extra.invitedBy as string) ?? null]);
  return id;
};
let n = 0;
const spin = (p: string, date: string, num: number, outcome: string, syms: string[], pts: number) =>
  db.query("insert into spins (player_id, play_date, week_start, spin_number, symbols, outcome, points) values ($1,$2,$3,$4,$5,$6,$7)",
    [p, date, weekOf(date), num, JSON.stringify(syms), outcome, pts]);

const A = await mk();
const B = await mk({ email: "b@example.com", invitedBy: A });
const C = await mk();                                  // joined, never spun
await spin(A, day(2), 1, "pair", ["cherry", "cherry", "bell"], 6);
await spin(A, day(2), 2, "none", ["cherry", "bell", "star"], 6);
await spin(A, day(2), 3, "none", ["lemon", "bell", "star"], 7);
await spin(A, day(1), 1, "triple", ["gem", "gem", "gem"], 120);
await spin(B, day(0), 1, "none", ["cherry", "clover", "star"], 8);
await db.query("insert into bonus_grants (inviter_id, invitee_id, week_start) values ($1,$2,$3)", [A, B, weekStart()]);
await db.query("insert into set_awards (player_id, set_id, week_start, points) values ($1,'everyday',$2,10)", [A, weekStart()]);
for (const [name, times] of [["invite_copied", 2], ["offer_viewed", 4], ["age_gate_blocked", 1], ["intro_completed", 2], ["share_card", 3]] as const)
  for (let i = 0; i < times; i++) await logEvent(null, name);
await logEvent(null, "offer_clicked", { region: "UK" });

await logEvent(A, "rewards_viewed", { region: "UK" });
await logEvent(A, "rewards_viewed", { region: "UK" });     // same player twice
await logEvent(B, "rewards_viewed", { region: "IE" });
await logEvent(A, "reward_interest", { rung: "draw", region: "UK" });
await logEvent(A, "reward_interest", { rung: "draw", region: "UK" }); // repeat tap
await logEvent(B, "reward_interest", { rung: "draw", region: "IE" });
await logEvent(B, "reward_interest", { rung: "regular", region: "IE" });
await db.query("update players set rewards_notify = true where id = $1", [B]);

const s = await getStats(db.query);
ok("counts players, spinners and spins", s.totals.players === 3 && s.totals.spinners === 2 && s.totals.totalSpins === 5, s.totals);
ok("spins today counts only today", s.totals.spinsToday === 1, s.totals);
ok("enjoyable: 5 spins across 2 players = 2.5 each", near(s.answers.enjoyable.spinsPerPlayer, 2.5), s.answers.enjoyable);
ok("enjoyable: 1 of 3 player-days used all three spins", near(s.answers.enjoyable.fullDayShare, 1 / 3), s.answers.enjoyable);
ok("come back: the one eligible player returned (100%)", s.answers.comeBack.eligible === 1 && near(s.answers.comeBack.returnRate, 1), s.answers.comeBack);
ok("come back: one of two players played on 2+ days", s.answers.comeBack.multiDayPlayers === 1 && near(s.answers.comeBack.multiDayShare, 0.5), s.answers.comeBack);
ok("email: only spinners with an email count (1 of 2)", s.answers.email.captured === 1 && near(s.answers.email.rate, 0.5), s.answers.email);
ok("friends: copies, joined, redeemed, shares", s.answers.friends.copies === 2 && s.answers.friends.joinedViaInvite === 1 && s.answers.friends.redeemed === 1 && s.answers.friends.shares === 3, s.answers.friends);
ok("monetise: 1 click from 4 views = 25% and region split", near(s.answers.monetise.ctr, 0.25) && s.answers.monetise.byRegion[0].region === "UK", s.answers.monetise);
ok("daily chart covers 14 days ending today", s.daily.length === 14 && s.daily[13].date === day(0), s.daily.map((d) => d.date));
ok("daily activity: 1 active two days ago, 1 yesterday, 1 today", s.daily[11].active === 1 && s.daily[12].active === 1 && s.daily[13].active === 1, s.daily.slice(-3));
ok("progress: set completions and intro events", s.progress.sets.find((x) => x.name === "Everyday trio")?.completed === 1 && s.progress.introCompleted === 2, s.progress);
ok("tier split covers this week's players only", s.progress.tiersThisWeek.reduce((a, t) => a + t.players, 0) >= 1);
ok("fairness: observed pair and triple rates", near(s.fairness.pair.observed, 0.2) && near(s.fairness.triple.observed, 0.2), s.fairness);
ok("fairness: published odds shown alongside", s.fairness.reels.length === 8 && s.fairness.reels.every((r) => r.published > 0));
ok("guardrails: blocked under-18 attempts are counted", s.guardrails.ageBlocked === 1, s.guardrails);
ok("rewards: viewers counted once per player", s.rewards.viewers === 2, s.rewards);
ok("rewards: interest counts distinct players per rung", s.rewards.interest.find((r) => r.rung === "draw")?.players === 2 && s.rewards.interest.find((r) => r.rung === "regular")?.players === 1 && s.rewards.interest.find((r) => r.rung === "partner")?.players === 0, s.rewards.interest);
ok("rewards: viewers split by region and opt-ins counted", s.rewards.viewersByRegion.length === 2 && s.rewards.notifyOptIns === 1, s.rewards);
const json = JSON.stringify(s);
ok("no email address or player id leaks into the stats", !json.includes("@") && !json.includes(A) && !json.includes(B));

console.log(failed ? `\n${failed} check(s) FAILED` : "\nAll stats checks passed");
process.exit(failed ? 1 : 0);
