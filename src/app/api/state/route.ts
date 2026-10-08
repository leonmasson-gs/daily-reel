import { NextResponse } from "next/server";
import { currentPlayerId } from "@/lib/session";
import { buildState } from "@/lib/game";

export async function GET() {
  const id = await currentPlayerId();
  if (!id) return NextResponse.json({ player: null });
  const state = await buildState(id);
  if (!state) return NextResponse.json({ player: null });
  return NextResponse.json({ player: state });
}
