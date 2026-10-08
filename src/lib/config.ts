import raw from "../../config/reel.json";

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
    chancePerReel: s.weight / totalWeight,
  }));
  const triple = probs.reduce((n, p) => n + p.chancePerReel ** 3, 0);
  // exactly two of the same symbol across three reels
  const pair = probs.reduce((n, p) => n + 3 * p.chancePerReel ** 2 * (1 - p.chancePerReel), 0);
  return {
    symbols: probs,
    triple,
    pair,
    none: 1 - triple - pair,
    multipliers: config.multipliers,
  };
}
