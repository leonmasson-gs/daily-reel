import { config } from "./config";

export type Region = "UK" | "IE" | "US" | "Other";

/** Maps the visitor's country (from Vercel's connection header) to a prize pool. */
export function regionOf(country?: string | null): Region {
  switch ((country ?? "").toUpperCase()) {
    case "GB": return "UK";
    case "IE": return "IE";
    case "US": return "US";
    default: return "Other";
  }
}

export type RewardsCfg = typeof config.rewards;

export function regularProgress(daysPlayed: number, rw: RewardsCfg = config.rewards) {
  return {
    days: daysPlayed,
    need: rw.regular.daysNeeded,
    earned: daysPlayed >= rw.regular.daysNeeded,
    fullWeek: daysPlayed >= rw.regular.fullWeekDays,
  };
}

export function partnerProgress(points: number, tiers: { name: string; minPoints: number }[] = config.tiers, rw: RewardsCfg = config.rewards) {
  const need = tiers.find((t) => t.name === rw.partner.tier)?.minPoints ?? 0;
  return { points, need, earned: points >= need };
}

/** One entry per day played, from the minimum up to the cap. Below the minimum there are no entries. */
export function grandProgress(trophies: number, rw: RewardsCfg = config.rewards) {
  return { trophies, need: rw.grand.trophiesNeeded, earned: trophies >= rw.grand.trophiesNeeded };
}

export function drawProgress(daysPlayed: number, rw: RewardsCfg = config.rewards) {
  const qualifies = daysPlayed >= rw.draw.minDays;
  return {
    days: daysPlayed,
    need: rw.draw.minDays,
    qualifies,
    entries: qualifies ? Math.min(daysPlayed, rw.draw.maxEntries) : 0,
    maxEntries: rw.draw.maxEntries,
  };
}
