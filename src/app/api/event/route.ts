import { NextResponse } from "next/server";
import { logEvent } from "@/lib/db";
import { currentPlayerId } from "@/lib/session";

const ALLOWED = new Set(["tier_viewed", "offer_clicked", "invite_copied", "explainer_dismissed", "odds_viewed", "intro_completed", "intro_skipped", "recap_viewed", "offer_viewed", "share_card", "rewards_viewed", "reward_interest"]);

export async function POST(req: Request) {
  const playerId = await currentPlayerId();
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name : "";
  if (!ALLOWED.has(name)) return NextResponse.json({ error: "unknown_event" }, { status: 400 });
  const meta: Record<string, string> = {};
  if (typeof body.region === "string") meta.region = body.region.slice(0, 12);
  if (["regular", "partner", "draw"].includes(body.rung)) meta.rung = body.rung;
  await logEvent(playerId, name, Object.keys(meta).length ? meta : undefined);
  return NextResponse.json({ ok: true });
}
