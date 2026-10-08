import { NextResponse } from "next/server";
import { ready } from "@/lib/db";
import { currentPlayerId } from "@/lib/session";
import { getRecap, markRecapSeen } from "@/lib/recap";

export async function GET() {
  const id = await currentPlayerId();
  if (!id) return NextResponse.json({ recap: null });
  const db = await ready();
  return NextResponse.json({ recap: await getRecap(db.query, id) });
}

export async function POST() {
  const id = await currentPlayerId();
  if (!id) return NextResponse.json({ error: "age_gate_required" }, { status: 401 });
  const db = await ready();
  await markRecapSeen(db.query, id);
  return NextResponse.json({ ok: true });
}
