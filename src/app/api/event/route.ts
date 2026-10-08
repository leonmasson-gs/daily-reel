import { NextResponse } from "next/server";
import { logEvent, ready } from "@/lib/db";
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
  // Events only count for real players, and one player cannot repeat the same event more than 6 times a minute.
  // The reply is the same either way so the page never has to handle a refusal.
  if (!playerId) return NextResponse.json({ ok: true });
  const db = await ready();
  const [{ n }] = await db.query<{ n: number }>(
    "select count(*)::int as n from events where player_id = $1 and name = $2 and created_at > now() - interval '1 minute'",
    [playerId, name],
  );
  if (n < 6) await logEvent(playerId, name, Object.keys(meta).length ? meta : undefined);
  return NextResponse.json({ ok: true });
}
