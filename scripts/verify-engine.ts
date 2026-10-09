import { config, publishedOdds, totalWeight } from "../src/lib/config";
import { spinOnce, tierFor, scoreSpin } from "../src/lib/engine";
import { ageOn, minAgeFor, playDate, weekStart, previousWeekStart, nextReset, nextWeekReset, resetIsToday } from "../src/lib/dates";

const N = 200_000;
const counts: Record<string, number> = {};
let pairs = 0, triples = 0, points = 0;
for (let i = 0; i < N; i++) {
  const s = spinOnce();
  for (const id of s.symbols) counts[id] = (counts[id] ?? 0) + 1;
  if (s.outcome === "pair") pairs++;
  if (s.outcome === "triple") triples++;
  points += s.points;
}
const odds = publishedOdds();
let ok = true;
const check = (label: string, actual: number, expected: number, tol: number) => {
  const pass = Math.abs(actual - expected) <= tol;
  if (!pass) ok = false;
  console.log(`${pass ? "PASS" : "FAIL"} ${label}: actual ${(actual * 100).toFixed(3)}% vs published ${(expected * 100).toFixed(3)}%`);
};
for (const s of config.symbols) check(`reel chance ${s.id}`, counts[s.id] / (N * 3), s.weight / totalWeight, 0.004);
check("pair rate", pairs / N, odds.pair, 0.005);
check("triple rate", triples / N, odds.triple, 0.003);
console.log(`published: none ${(odds.none * 100).toFixed(1)}% / pair ${(odds.pair * 100).toFixed(1)}% / triple ${(odds.triple * 100).toFixed(2)}%`);
console.log(`avg points per spin: ${(points / N).toFixed(2)}; per week at 21 spins: ~${(points / N * 21).toFixed(0)} (tiers: ${config.tiers.map((t) => t.minPoints).join("/")})`);

// scoring + tiers + dates
const pts = (id: string) => config.symbols.find((x) => x.id === id)!.points;
const eq = (label: string, a: unknown, b: unknown) => { const p = JSON.stringify(a) === JSON.stringify(b); if (!p) ok = false; console.log(`${p ? "PASS" : "FAIL"} ${label}`); };
eq("triple cherry = 3 cherries x triple multiplier", scoreSpin(["cherry", "cherry", "cherry"]), { outcome: "triple", points: config.symbols[0].points * 3 * config.multipliers.triple });
eq("pair bells + star = (bell+bell+star) x pair multiplier", scoreSpin(["bell", "bell", "star"]), { outcome: "pair", points: (pts("bell") * 2 + pts("star")) * config.multipliers.pair });
eq("no match = plain sum", scoreSpin(["cherry", "bell", "star"]), { outcome: "none", points: pts("cherry") + pts("bell") + pts("star") });
eq("tier at 0", tierFor(0).current.id, "bronze");
eq("tier at the Silver threshold", tierFor(config.tiers[1].minPoints).current.id, "silver");
eq("tier just below Silver", tierFor(config.tiers[1].minPoints - 1).current.id, "bronze");
eq("tier at 9999 has no next", tierFor(9999).next, null);
eq("age 17y364d is under 18", (ageOn("2008-10-09", new Date("2026-10-08T12:00:00Z")) ?? 99) < 18, true);
eq("age on 18th birthday is 18", ageOn("2008-10-08", new Date("2026-10-08T12:00:00Z")), 18);
eq("bad dob rejected", ageOn("2026-02-31"), null);
eq("an age over 120 is rejected as a typing mistake", ageOn("1900-01-01"), null);
eq("an age of exactly 100 is accepted", ageOn("1926-10-01", new Date("2026-10-08T12:00:00Z")), 100);
// --- the 18:00 UK reset, including daylight saving. A day is named by the date it ENDS on. ---
const at = (iso: string) => new Date(iso);
eq("BST: Thursday 17:59 is still Thursday's day", playDate(at("2026-10-08T16:59:00Z")), "2026-10-08");
eq("BST: Thursday 18:00 starts Friday's day", playDate(at("2026-10-08T17:00:00Z")), "2026-10-09");
eq("GMT: Thursday 17:59 is still Thursday's day", playDate(at("2026-12-10T17:59:00Z")), "2026-12-10");
eq("GMT: Thursday 18:00 starts Friday's day", playDate(at("2026-12-10T18:00:00Z")), "2026-12-11");
eq("Thursday late evening already counts as Friday", playDate(at("2026-10-08T22:30:00Z")), "2026-10-09");
eq("Friday morning is Friday (not Thursday)", playDate(at("2026-10-09T08:00:00Z")), "2026-10-09");
eq("Friday 11:15 UK is Friday", playDate(at("2026-10-09T10:15:00Z")), "2026-10-09");
eq("clocks go back on 25 Oct: Sunday 17:30 GMT is still Sunday", playDate(at("2026-10-25T17:30:00Z")), "2026-10-25");
eq("clocks go back on 25 Oct: Sunday 18:00 GMT starts Monday", playDate(at("2026-10-25T18:00:00Z")), "2026-10-26");
eq("next reset in BST is 17:00 UTC", nextReset(at("2026-10-24T12:00:00Z")), "2026-10-24T17:00:00.000Z");
eq("next reset after clocks go back is 18:00 UTC", nextReset(at("2026-10-25T12:00:00Z")), "2026-10-25T18:00:00.000Z");
eq("next reset in GMT is 18:00 UTC", nextReset(at("2026-03-28T12:00:00Z")), "2026-03-28T18:00:00.000Z");
eq("next reset after clocks go forward is 17:00 UTC", nextReset(at("2026-03-29T12:00:00Z")), "2026-03-29T17:00:00.000Z");
eq("Friday morning: next reset is Friday 18:00 UK", nextReset(at("2026-10-09T10:15:00Z")), "2026-10-09T17:00:00.000Z");
eq("just after a reset the next one is a day later", nextReset(at("2026-10-08T17:00:01Z")), "2026-10-09T17:00:00.000Z");
eq("a day is never more than 25 hours from the next reset", (Date.parse(nextReset(at("2026-10-24T17:30:00Z"))) - Date.parse("2026-10-24T17:30:00Z")) / 3600000 <= 25, true);
eq("morning says the reset is today", resetIsToday(at("2026-10-09T10:15:00Z")), true);
eq("just after 18:00 says the reset is tomorrow", resetIsToday(at("2026-10-09T17:30:00Z")), false);
eq("the week starts on Monday: Sunday 18:00 starts the new week", weekStart(at("2026-10-11T17:00:00Z")), "2026-10-12");
eq("Sunday 17:59 BST is still the old week", weekStart(at("2026-10-11T16:59:00Z")), "2026-10-05");
eq("midweek belongs to the Monday before", weekStart(at("2026-10-14T12:00:00Z")), "2026-10-12");
eq("Friday morning is in the week that began on Monday", weekStart(at("2026-10-09T10:15:00Z")), "2026-10-05");
eq("Saturday evening is the same week", weekStart(at("2026-10-17T20:00:00Z")), "2026-10-12");
eq("previous week is seven days earlier", previousWeekStart(at("2026-10-14T12:00:00Z")), "2026-10-05");
eq("previous week survives a clock change", previousWeekStart(at("2026-10-25T18:30:00Z")), "2026-10-19");
eq("the week ends on Sunday 18:00 (17:00Z in BST)", nextWeekReset(at("2026-10-14T12:00:00Z")), "2026-10-18T17:00:00.000Z");
eq("the week ending after clocks go back is 18:00Z", nextWeekReset(at("2026-10-20T12:00:00Z")), "2026-10-25T18:00:00.000Z");
eq("US visitors need to be 21", minAgeFor("US"), 21);
eq("everyone else needs to be 18", [minAgeFor("GB"), minAgeFor("ie"), minAgeFor(null)].join(), "18,18,18");
process.exit(ok ? 0 : 1);
