import { NextResponse } from "next/server";
import { config, publishedOdds } from "@/lib/config";

export async function GET() {
  return NextResponse.json({
    copy: config.copy,
    minAge: config.minAge,
    spinsPerDay: config.spinsPerDay,
    bonusSpinsPerWeekCap: config.bonusSpinsPerWeekCap,
    tiers: config.tiers,
    sets: config.sets,
    rewards: config.rewards,
    partnerOffer: config.partnerOffer.enabled ? config.partnerOffer : null,
    odds: publishedOdds(),
  });
}
