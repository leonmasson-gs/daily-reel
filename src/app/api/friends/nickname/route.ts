import { NextResponse } from "next/server";
import { ready } from "@/lib/db";
import { currentPlayerId } from "@/lib/session";
import { shuffleNickname } from "@/lib/friends";

// Players cannot type a nickname. They can only ask for a new random one.
export async function POST() {
  const id = await currentPlayerId();
  if (!id) return NextResponse.json({ error: "age_gate_required" }, { status: 401 });
  const db = await ready();
  return NextResponse.json({ nickname: await shuffleNickname(db.query, id) });
}
