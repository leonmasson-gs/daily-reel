import { NextResponse } from "next/server";
import { ready } from "@/lib/db";
import { currentPlayerId } from "@/lib/session";
import { setVisibility } from "@/lib/friends";

export async function POST(req: Request) {
  const id = await currentPlayerId();
  if (!id) return NextResponse.json({ error: "age_gate_required" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (typeof body.visible !== "boolean") return NextResponse.json({ error: "invalid" }, { status: 400 });
  const db = await ready();
  await setVisibility(db.query, id, body.visible);
  return NextResponse.json({ ok: true, visible: body.visible });
}
