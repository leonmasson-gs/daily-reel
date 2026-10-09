import { NextResponse } from "next/server";
import { config, publishedOdds } from "@/lib/config";

export async function GET() {
  return NextResponse.json({
    copy: config.copy,
    minAge: config.minAge,
    minAgeUS: config.minAgeUS,
    spinsPerDay: config.spinsPerDay,
    bonusSpinsPerWeekCap: config.bonusSpinsPerWeekCap,
    tiers: config.tiers,
    sets: config.sets,
    rewards: config.rewards,
    reset: config.reset,
    skin: config.skin,
    featured: config.featured,
    bonus: { skipPoints: config.bonus.skipPoints, bands: config.bonus.bands },
    trophies: config.trophies,
    responsible: config.responsible,
    partnerOffer: config.partnerOffer.enabled ? config.partnerOffer : null,
    odds: publishedOdds(),
  });
}
