import { config, publishedOdds, totalWeight } from "../src/lib/config";
import { spinOnce, tierFor, scoreSpin } from "../src/lib/engine";
import { ageOn, utcWeekStart } from "../src/lib/dates";

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
eq("week starts Monday", utcWeekStart(new Date("2026-10-08T12:00:00Z")), "2026-10-05");
eq("Sunday belongs to the previous Monday", utcWeekStart(new Date("2026-10-11T23:59:00Z")), "2026-10-05");
process.exit(ok ? 0 : 1);
