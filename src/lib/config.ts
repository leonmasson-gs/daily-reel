import raw from "../../config/reel.json";
import { resolveSpin } from "./resolve";

export type Symbol = (typeof raw.symbols)[number];
export const config = raw;

export const symbolById = new Map(config.symbols.map((s) => [s.id, s]));
export const totalWeight = config.symbols.reduce((n, s) => n + s.weight, 0);

/** Published odds, derived from the same weights the engine uses. */
export function publishedOdds() {
  const probs = config.symbols.map((s) => ({
    id: s.id,
    name: s.name,
    icon: s.icon,
    rarity: s.rarity,
    points: s.points,
    wild: (s as { wild?: boolean }).wild === true,
    chancePerReel: s.weight / totalWeight,
  }));
  // Try every one of the possible three-reel combinations, score each with the real rules (a Wild stands in for the best
  // symbol), and add up how likely each result is. Exact, not estimated.
  let triple = 0, pair = 0, none = 0;
  for (const a of probs) for (const b of probs) for (const c of probs) {
    const p = a.chancePerReel * b.chancePerReel * c.chancePerReel;
    const outcome = resolveSpin([a.id, b.id, c.id]).outcome;
    if (outcome === "triple") triple += p; else if (outcome === "pair") pair += p; else none += p;
  }
  return { symbols: probs, triple, pair, none, multipliers: config.multipliers };
}
