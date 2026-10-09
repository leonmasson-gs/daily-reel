import { config, publishedOdds, totalWeight } from "../src/lib/config";
import { spinOnce, tierFor, scoreSpin } from "../src/lib/engine";
import { advertDisclosure } from "../src/lib/advert";
import { featuredSymbol } from "../src/lib/featured";
import { bonusFor } from "../src/lib/bonus";
import { SKINS } from "../src/lib/skins";
import { readFileSync } from "node:fs";
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
const pick = (r: { outcome: string; points: number }) => ({ outcome: r.outcome, points: r.points });
const pts = (id: string) => config.symbols.find((x) => x.id === id)!.points;
const eq = (label: string, a: unknown, b: unknown) => { const p = JSON.stringify(a) === JSON.stringify(b); if (!p) ok = false; console.log(`${p ? "PASS" : "FAIL"} ${label}`); };
eq("triple cherry = 3 cherries x triple multiplier", pick(scoreSpin(["cherry", "cherry", "cherry"])), { outcome: "triple", points: config.symbols[0].points * 3 * config.multipliers.triple });
eq("pair bells + star = (bell+bell+star) x pair multiplier", pick(scoreSpin(["bell", "bell", "star"])), { outcome: "pair", points: (pts("bell") * 2 + pts("star")) * config.multipliers.pair });
eq("no match = plain sum", pick(scoreSpin(["cherry", "bell", "star"])), { outcome: "none", points: pts("cherry") + pts("bell") + pts("star") });
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
const sup = config.responsible.support;
eq("US advert says 21+ and gives the US help line", /21\+/.test(advertDisclosure(21, sup.US)) && /ncpgambling\.org/.test(advertDisclosure(21, sup.US)) && /1-800-GAMBLER/.test(advertDisclosure(21, sup.US)), true);
eq("US advert does not name a UK charity", !/begambleaware/i.test(advertDisclosure(21, sup.US)), true);
eq("UK advert says 18+ and gives the UK help line", /18\+/.test(advertDisclosure(18, sup.UK)) && /begambleaware\.org/.test(advertDisclosure(18, sup.UK)) && /0808 8020 133/.test(advertDisclosure(18, sup.UK)), true);
eq("every region has an advert line with an age, T&Cs and a help source", Object.keys(sup).every((r) => /\d\d\+\. T&Cs apply\. Help: \S+/.test(advertDisclosure(18, sup[r as keyof typeof sup]))), true);
eq("everyone else needs to be 18", [minAgeFor("GB"), minAgeFor("ie"), minAgeFor(null)].join(), "18,18,18");

// --- the featured symbol of the day ---
eq("the featured symbol is the same all day", featuredSymbol("2026-10-09") === featuredSymbol("2026-10-09"), true);
const feats = new Set<string>(); let legendary = false;
for (let d = 0; d < 700; d++) { const f = featuredSymbol(new Date(Date.UTC(2026, 0, 1 + d)).toISOString().slice(0, 10)); feats.add(f); if (f === "golden-reel") legendary = true; }
eq("the featured symbol is never the Legendary one", legendary, false);
eq("over time every other symbol gets a turn", feats.size, config.symbols.length - 1);
eq("a featured symbol counts double in the base points", scoreSpin(["star", "cherry", "bell"], "star").points, (pts("star") * 2 + pts("cherry") + pts("bell")));
eq("featured hits are counted", scoreSpin(["star", "star", "bell"], "star").featuredHits, 2);
eq("featured triple: doubled base, then the triple multiplier", scoreSpin(["star", "star", "star"], "star").points, pts("star") * 2 * 3 * config.multipliers.triple);
eq("with no featured symbol nothing changes", scoreSpin(["star", "cherry", "bell"]).points, pts("star") + pts("cherry") + pts("bell"));
eq("a different featured symbol changes nothing for this spin", scoreSpin(["star", "cherry", "bell"], "gem").points, pts("star") + pts("cherry") + pts("bell"));

// --- bonus round bands ---
eq("dead centre is Perfect", bonusFor(1).label, "Perfect");
eq("0.9 is still Perfect", bonusFor(0.9).label, "Perfect");
eq("just under 0.9 is Great", bonusFor(0.89).label, "Great");
eq("0.65 is Great", bonusFor(0.65).label, "Great");
eq("just under 0.65 is Good", bonusFor(0.64).label, "Good");
eq("0.35 is Good", bonusFor(0.35).label, "Good");
eq("under 0.35 is a Miss", bonusFor(0.34).label, "Miss");
eq("the very edge is a Miss", bonusFor(0).label, "Miss");
eq("rubbish input is a Miss, not an error", bonusFor(NaN).label, "Miss");
eq("an impossible accuracy above 1 is capped at Perfect", bonusFor(7).points, bonusFor(1).points);
eq("a Miss is never worth more than the standard bonus", bonusFor(0).points <= config.bonus.skipPoints, true);
eq("the standard bonus is worth no more than a Great stop", config.bonus.skipPoints <= bonusFor(0.7).points, true);

// --- skins: every skin must be complete, and readable ---
const glyphSource = readFileSync(new URL("../src/components/glyph-shapes.tsx", import.meta.url), "utf8");
const knownArt = new Set([...glyphSource.matchAll(/case "([a-z-]+)":/g)].map((m) => m[1]));
const lum = (hex: string) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a: string, b: string) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
for (const sk of Object.values(SKINS)) {
  eq(`${sk.label}: every symbol has a name and a drawing that exists`, config.symbols.every((s) => sk.symbols[s.id]?.name && knownArt.has(sk.symbols[s.id].art)), true);
  eq(`${sk.label}: symbol names are all different`, new Set(Object.values(sk.symbols).map((x) => x.name)).size, config.symbols.length);
  eq(`${sk.label}: every rarity has a colour`, ["Common", "Rare", "Epic", "Legendary"].every((r) => /^#[0-9A-Fa-f]{6}$/.test(sk.rarity[r as keyof typeof sk.rarity])), true);
  eq(`${sk.label}: text on the background is easy to read (7:1)`, ratio(sk.card.text, sk.card.bg) >= 7, true);
  eq(`${sk.label}: muted text on the background passes AA (4.5:1)`, ratio(sk.card.muted, sk.card.bg) >= 4.5, true);
  eq(`${sk.label}: the accent on the background passes for large text and controls (3:1)`, ratio(sk.card.accent, sk.card.bg) >= 3, true);
  eq(`${sk.label}: every symbol colour can be seen against the reel window (3:1)`, Object.values(sk.rarity).every((c) => ratio(c, sk.card.win) >= 3), true);
}
process.exit(ok ? 0 : 1);
