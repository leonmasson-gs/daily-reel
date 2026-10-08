import { NextResponse } from "next/server";
import { logEvent } from "@/lib/db";
import { currentPlayerId } from "@/lib/session";

const ALLOWED = new Set(["tier_viewed", "offer_clicked", "invite_copied", "explainer_dismissed", "odds_viewed"]);

export async function POST(req: Request) {
  const playerId = await currentPlayerId();
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name : "";
  if (!ALLOWED.has(name)) return NextResponse.json({ error: "unknown_event" }, { status: 400 });
  const meta = typeof body.region === "string" ? { region: body.region.slice(0, 12) } : undefined;
  await logEvent(playerId, name, meta);
  return NextResponse.json({ ok: true });
}
