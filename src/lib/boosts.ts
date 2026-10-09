import { createHash } from "node:crypto";
import { config } from "./config";
import type { BoostSpec } from "./resolve";

export type Boost = { id: string; label: string; text: string; spec: BoostSpec };
type Def = { label: string; text: string; pairMult?: number; tripleMult?: number; rareBonus?: number };

/**
 * Each day has one boost, the same for every player, changing at the 18:00 reset. A boost only changes how points are
 * counted. It never changes which symbols are drawn or how likely any result is. Dates in config.boosts.matchdays
 * override the rotation, for example to run a Triple surge on a big match day.
 */
export function boostForDay(playDate: string): Boost {
  const defs = config.boosts.defs as Record<string, Def>;
  const override = (config.boosts.matchdays as Record<string, string>)[playDate];
  const rotation = config.boosts.rotation;
  const id = override && defs[override] ? override : rotation[createHash("sha256").update("boost:" + playDate).digest()[0] % rotation.length];
  const d = defs[id];
  return { id, label: d.label, text: d.text, spec: { pairMult: d.pairMult, tripleMult: d.tripleMult, rareBonus: d.rareBonus } };
}
