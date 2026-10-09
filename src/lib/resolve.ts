import raw from "../../config/reel.json";

/*
  How a spin is scored. This is the single place the rules live, so the engine, the published odds and the tests all
  agree. A Wild stands in for whichever symbol gives the player the best result. Nothing here ever changes which
  symbols are drawn: boosts and the featured symbol only change the points.
*/
export type Outcome = "triple" | "pair" | "none";
export type BoostSpec = { pairMult?: number; tripleMult?: number; rareBonus?: number };
type Sym = { id: string; points: number; rarity: string; wild?: boolean };

const byId = new Map<string, Sym>((raw.symbols as Sym[]).map((s) => [s.id, s]));
const isWild = (id: string) => byId.get(id)?.wild === true;

function scoreFixed(ids: string[], featured?: string, boost?: BoostSpec) {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  const best = Math.max(...counts.values());
  const outcome: Outcome = best === 3 ? "triple" : best === 2 ? "pair" : "none";
  let base = 0;
  for (const id of ids) {
    const s = byId.get(id)!;
    base += s.points * (id === featured ? raw.featured.multiplier : 1);
    if (boost?.rareBonus && s.rarity !== "Common") base += boost.rareBonus;
  }
  const mult = outcome === "triple" ? (boost?.tripleMult ?? raw.multipliers.triple) : outcome === "pair" ? (boost?.pairMult ?? raw.multipliers.pair) : 1;
  return { outcome, points: base * mult, featuredHits: featured ? ids.filter((i) => i === featured).length : 0, resolved: ids };
}

export function resolveSpin(ids: string[], featured?: string, boost?: BoostSpec) {
  const wilds = ids.filter(isWild).length;
  // No wild, or three wilds (which score as wilds): nothing to substitute.
  if (wilds === 0 || wilds === 3) return { ...scoreFixed(ids, featured, boost), wilds };
  // Otherwise the wild(s) become whichever symbol on the reels scores best.
  let best: ReturnType<typeof scoreFixed> | null = null;
  for (const c of new Set(ids.filter((id) => !isWild(id)))) {
    const sc = scoreFixed(ids.map((id) => (isWild(id) ? c : id)), featured, boost);
    if (!best || sc.points > best.points) best = sc;
  }
  return { ...best!, wilds };
}
