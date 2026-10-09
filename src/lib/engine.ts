import { randomInt } from "node:crypto";
import { config, totalWeight, symbolById } from "./config";

export type Rng = (maxExclusive: number) => number;
export const cryptoRng: Rng = (n) => randomInt(n);

export type Outcome = "triple" | "pair" | "none";

export type SpinResult = {
  symbols: string[]; // symbol ids, one per reel
  outcome: Outcome;
  points: number;
  /** How many of the three reels showed the featured symbol (each counts double). */
  featuredHits?: number;
};

/**
 * One independent weighted draw per reel.
 * Reels never look at each other: there is deliberately no near-miss tuning.
 * (config.nearMiss exists as a switch for a future decision and is not read here.)
 */
export function drawSymbol(rng: Rng = cryptoRng): string {
  let roll = rng(totalWeight);
  for (const s of config.symbols) {
    if (roll < s.weight) return s.id;
    roll -= s.weight;
  }
  throw new Error("weights misconfigured");
}

export function scoreSpin(symbols: string[], featured?: string): { outcome: Outcome; points: number; featuredHits: number } {
  const counts = new Map<string, number>();
  for (const id of symbols) counts.set(id, (counts.get(id) ?? 0) + 1);
  const best = Math.max(...counts.values());
  const outcome: Outcome = best === 3 ? "triple" : best === 2 ? "pair" : "none";
  // The featured symbol of the day counts double in the base points. It never changes which symbols are drawn.
  const featuredHits = featured ? symbols.filter((id) => id === featured).length : 0;
  const base = symbols.reduce((n, id) => n + (symbolById.get(id)?.points ?? 0) * (id === featured ? config.featured.multiplier : 1), 0);
  const mult = outcome === "triple" ? config.multipliers.triple : outcome === "pair" ? config.multipliers.pair : 1;
  return { outcome, points: base * mult, featuredHits };
}

export function spinOnce(rng: Rng = cryptoRng, featured?: string): SpinResult {
  const symbols = [drawSymbol(rng), drawSymbol(rng), drawSymbol(rng)];
  return { symbols, ...scoreSpin(symbols, featured) };
}

export function tierFor(points: number) {
  let current = config.tiers[0];
  for (const t of config.tiers) if (points >= t.minPoints) current = t;
  const idx = config.tiers.findIndex((t) => t.id === current.id);
  const next = config.tiers[idx + 1] ?? null;
  return { current, next };
}
