import { NextResponse } from "next/server";
import { ready } from "@/lib/db";
import { currentPlayerId } from "@/lib/session";
import { getBoard } from "@/lib/friends";

export async function GET() {
  const id = await currentPlayerId();
  if (!id) return NextResponse.json({ error: "age_gate_required" }, { status: 401 });
  const db = await ready();
  const board = await getBoard(db.query, id);
  if (!board) return NextResponse.json({ error: "age_gate_required" }, { status: 401 });
  return NextResponse.json(board, { headers: { "Cache-Control": "no-store" } });
}
