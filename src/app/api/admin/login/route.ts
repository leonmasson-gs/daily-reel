import { NextResponse } from "next/server";
import { adminConfigured, keyMatches, setAdminCookie } from "@/lib/admin";

export async function POST(req: Request) {
  if (!adminConfigured()) {
    return NextResponse.json({ error: "not_configured", message: "The stats page is switched off. Set ADMIN_KEY to turn it on." }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  const key = typeof body.key === "string" ? body.key : "";
  if (!keyMatches(key)) {
    await new Promise((r) => setTimeout(r, 600)); // slows down guessing
    return NextResponse.json({ error: "wrong_key", message: "That key is not right." }, { status: 401 });
  }
  await setAdminCookie();
  return NextResponse.json({ ok: true });
}
