import { NextResponse } from "next/server";
import { ready } from "@/lib/db";
import { isAdmin } from "@/lib/admin";
import { getStats } from "@/lib/stats";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const db = await ready();
  return NextResponse.json(await getStats(db.query), { headers: { "Cache-Control": "no-store" } });
}
