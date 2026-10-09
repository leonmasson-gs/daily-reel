import { randomInt } from "node:crypto";
import { config, totalWeight } from "./config";
import { resolveSpin, type BoostSpec } from "./resolve";

export type Rng = (maxExclusive: number) => number;
export const cryptoRng: Rng = (n) => randomInt(n);

export type Outcome = "triple" | "pair" | "none";

export type SpinResult = {
  symbols: string[]; // symbol ids, one per reel
  outcome: Outcome;
  points: number;
  /** How many of the three reels showed the featured symbol (each counts double). */
  featuredHits?: number;
  /** The symbols as scored, with any Wild replaced by the symbol it stood in for. */
  resolved?: string[];
  wilds?: number;
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

export function scoreSpin(symbols: string[], featured?: string, boost?: BoostSpec) {
  return resolveSpin(symbols, featured, boost);
}

export function spinOnce(rng: Rng = cryptoRng, featured?: string, boost?: BoostSpec): SpinResult {
  const symbols = [drawSymbol(rng), drawSymbol(rng), drawSymbol(rng)];
  return { symbols, ...scoreSpin(symbols, featured, boost) };
}

export function tierFor(points: number) {
  let current = config.tiers[0];
  for (const t of config.tiers) if (points >= t.minPoints) current = t;
  const idx = config.tiers.findIndex((t) => t.id === current.id);
  const next = config.tiers[idx + 1] ?? null;
  return { current, next };
}
