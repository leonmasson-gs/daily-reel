// Rule tests for sets, tier-ups and the weekly recap, using forced spin results and an in-memory database.
process.env.ALLOW_MEMORY_DB = "1";
import { randomUUID } from "node:crypto";
import { ready } from "../src/lib/db";
import { performSpin } from "../src/lib/spin";
import { buildState, weekPoints } from "../src/lib/game";
import { getRecap, markRecapSeen, previousWeekStart } from "../src/lib/recap";
import { scoreSpin, type SpinResult } from "../src/lib/engine";
import { utcWeekStart } from "../src/lib/dates";

let failed = 0;
const ok = (label: string, cond: boolean, extra?: unknown) => { if (!cond) failed++; console.log(cond ? "PASS" : "FAIL", label, cond ? "" : JSON.stringify(extra)); };
const force = (...symbols: string[]): (() => SpinResult) => () => ({ symbols, ...scoreSpin(symbols) });

const db = await ready();
async function newPlayer() {
  const id = randomUUID();
  await db.query("insert into players (id, invite_code) values ($1, $2)", [id, id.slice(0, 8)]);
  return id;
}
async function spin(id: string, draw: () => SpinResult) {
  const r = await db.tx((q) => performSpin(q, id, draw));
  if (r.kind !== "ok") throw new Error("spin refused: " + r.kind);
  return r;
}

// --- sets ---
{
  const p = await newPlayer();
  let r = await spin(p, force("cherry", "bell", "bell"));
  ok("no set after cherry + bell", r.newSets.length === 0, r.newSets);
  r = await spin(p, force("lemon", "lemon", "cherry"));
  ok("Everyday trio completes once cherry, bell and lemon are all owned", r.newSets.map((s) => s.id).join() === "everyday", r.newSets);
  ok("set bonus is 10 points", r.newSets[0].points === 10);
  const s1 = await buildState(p);
  const spinPts = (await db.query<{ n: number }>("select sum(points)::int as n from spins where player_id = $1", [p]))[0].n;
  ok("week points = spin points + set bonus", s1!.week.points === spinPts + 10, [s1!.week.points, spinPts]);
  const everyday = s1!.sets.find((s) => s.id === "everyday")!;
  ok("state reports the set as complete", everyday.complete && everyday.found === 3);
  r = await spin(p, force("cherry", "bell", "lemon"));
  ok("a completed set never pays twice", r.newSets.length === 0);
  const full = s1!.sets.find((s) => s.id === "full-reel")!;
  ok("full reel progress counts owned symbols", full.found === 3 && full.total === 8, full);
}

// --- one spin completing two sets at once ---
{
  const p = await newPlayer();
  await spin(p, force("cherry", "bell", "lemon"));          // everyday done
  await spin(p, force("clover", "gem", "cherry"));          // owns clover, gem
  const r = await spin(p, force("star", "crown", "star"));  // completes lucky and treasury
  ok("two sets can complete on one spin", r.newSets.map((s) => s.id).sort().join() === "lucky,treasury", r.newSets);
}

// --- full reel ---
{
  const p = await newPlayer();
  await spin(p, force("cherry", "bell", "lemon"));
  await spin(p, force("clover", "star", "gem"));
  const r = await spin(p, force("crown", "golden-reel", "cherry"));
  ok("full reel completes with all eight symbols", r.newSets.some((s) => s.id === "full-reel") && r.newSets.some((s) => s.id === "treasury"), r.newSets);
}

// --- tier-up ---
{
  const p = await newPlayer();
  // triple golden reel = 40 x 3 x 5 = 600 points: Bronze -> Platinum in one spin
  let r = await spin(p, force("golden-reel", "golden-reel", "golden-reel"));
  ok("tier-up is reported with from and to", r.tierUp?.from === "Bronze" && r.tierUp?.to === "Platinum", r.tierUp);
  r = await spin(p, force("cherry", "bell", "star"));
  ok("no tier-up when the tier is unchanged", r.tierUp === null, r.tierUp);
}
{
  const p = await newPlayer();
  const r = await spin(p, force("cherry", "bell", "star"));
  ok("small spin stays in Bronze with no tier-up", r.tierUp === null);
}
{
  // a set bonus can itself carry a player over a tier line
  const p = await newPlayer();
  const week = utcWeekStart();
  await db.query("insert into spins (player_id, play_date, week_start, spin_number, symbols, outcome, points) values ($1,'2000-01-01',$2,99,'[\"cherry\",\"bell\",\"star\"]','none',112)", [p, week]);
  const r = await spin(p, force("lemon", "clover", "star")); // +9 spin points = 121, no set yet
  ok("112 + 9 crosses 120 into Silver", r.tierUp?.to === "Silver", r.tierUp);
}

// --- daily limit still holds ---
{
  const p = await newPlayer();
  for (let i = 0; i < 3; i++) await spin(p, force("cherry", "bell", "lemon"));
  const r = await db.tx((q) => performSpin(q, p, force("cherry", "bell", "lemon")));
  ok("fourth spin of the day is still refused", r.kind === "no_spins");
}

// --- days played ---
{
  const p = await newPlayer();
  const week = utcWeekStart();
  await db.query("insert into spins (player_id, play_date, week_start, spin_number, symbols, outcome, points) values ($1,$2,$3,1,'[\"cherry\",\"bell\",\"star\"]','none',6)", [p, week, week]);
  await spin(p, force("cherry", "bell", "star"));
  const s = await buildState(p);
  ok("days played lists distinct play dates this week", s!.week.daysPlayed.length === 2 && s!.week.daysPlayed.includes(week), s!.week.daysPlayed);
}

// --- weekly recap ---
{
  const p = await newPlayer();
  const last = previousWeekStart();
  const ins = (date: string, n: number, syms: string, outcome: string, pts: number) =>
    db.query("insert into spins (player_id, play_date, week_start, spin_number, symbols, outcome, points) values ($1,$2,$3,$4,$5,$6,$7)", [p, date, last, n, syms, outcome, pts]);
  const d0 = last, d1 = new Date(Date.parse(last) + 86400000).toISOString().slice(0, 10), d2 = new Date(Date.parse(last) + 2 * 86400000).toISOString().slice(0, 10);
  await ins(d0, 1, '["cherry","cherry","cherry"]', "triple", 15);
  await ins(d1, 1, '["bell","bell","star"]', "pair", 12);
  await ins(d2, 1, '["lemon","clover","star"]', "none", 9);
  await db.query("insert into set_awards (player_id, set_id, week_start, points) values ($1,'lucky',$2,15)", [p, last]);
  const r = await getRecap(db.query, p);
  ok("recap exists for a player who played last week", r !== null);
  ok("recap points include the set bonus (15+12+9+15)", r?.points === 51, r);
  ok("recap counts days, spins, pairs, triples", r?.daysPlayed === 3 && r?.spins === 3 && r?.pairs === 1 && r?.triples === 1, r);
  ok("recap counts symbols first found that week", r?.symbolsDiscovered === 5, r);
  ok("recap counts sets completed that week", r?.setsCompleted === 1, r);
  ok("recap tier is Bronze for 51 points", r?.tier === "Bronze", r);
  await markRecapSeen(db.query, p);
  ok("recap is shown once, then gone", (await getRecap(db.query, p)) === null);
}
{
  const p = await newPlayer();
  ok("no recap for a brand-new player", (await getRecap(db.query, p)) === null);
  await spin(p, force("cherry", "bell", "star"));
  ok("this week's play does not create a recap", (await getRecap(db.query, p)) === null);
}
{
  const p = await newPlayer();
  const old = new Date(Date.now() - 21 * 86400000);
  const w = utcWeekStart(old);
  await db.query("insert into spins (player_id, play_date, week_start, spin_number, symbols, outcome, points) values ($1,$2,$3,1,'[\"cherry\",\"bell\",\"star\"]','none',6)", [p, w, w]);
  ok("play three weeks ago does not produce a recap", (await getRecap(db.query, p)) === null);
}

// --- rewards rules (pure) ---
{
  const { regularProgress, partnerProgress, drawProgress, regionOf } = await import("../src/lib/rewards");
  ok("Regular badge needs 5 days", !regularProgress(4).earned && regularProgress(5).earned && !regularProgress(6).fullWeek && regularProgress(7).fullWeek);
  ok("partner offer unlocks at the Gold line (240)", !partnerProgress(239).earned && partnerProgress(240).earned, partnerProgress(240));
  ok("draw: no entries below 4 days", drawProgress(3).entries === 0 && !drawProgress(3).qualifies);
  ok("draw: one entry per day from day 4, capped at 7", drawProgress(4).entries === 4 && drawProgress(6).entries === 6 && drawProgress(7).entries === 7);
  ok("region mapping: GB to UK, IE, US, anything else Other", regionOf("GB") === "UK" && regionOf("ie") === "IE" && regionOf("US") === "US" && regionOf("FR") === "Other" && regionOf(null) === "Other");
}
// --- weeks with 5+ days ---
{
  const p = await newPlayer();
  const ins = (date: string, week: string, n: number) => db.query("insert into spins (player_id, play_date, week_start, spin_number, symbols, outcome, points) values ($1,$2,$3,$4,'[\"cherry\",\"bell\",\"star\"]','none',6)", [p, date, week, n]);
  const mon1 = "2026-08-03", mon2 = "2026-08-10";
  for (let i = 0; i < 5; i++) await ins(new Date(Date.parse(mon1) + i * 86400000).toISOString().slice(0, 10), mon1, 1);
  for (let i = 0; i < 7; i++) await ins(new Date(Date.parse(mon2) + i * 86400000).toISOString().slice(0, 10), mon2, 1);
  const s = await buildState(p);
  ok("state counts regular weeks (5+ days) and full weeks (7)", s!.rewards.weeksRegular === 2 && s!.rewards.weeksFull === 1, s!.rewards);
  ok("state starts with no rewards opt-in", s!.rewardsNotify === false);
}

console.log(failed ? `\n${failed} check(s) FAILED` : "\nAll rule checks passed");
process.exit(failed ? 1 : 0);
