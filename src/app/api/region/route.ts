import { NextResponse } from "next/server";
import { regionOf } from "@/lib/rewards";
import { minAgeFor } from "@/lib/dates";

// Vercel adds the visitor's country to each request. A VPN can change it, which is fine for a preview.
export async function GET(req: Request) {
  const country = req.headers.get("x-vercel-ip-country");
  return NextResponse.json({ country, region: regionOf(country), minAge: minAgeFor(country) }, { headers: { "Cache-Control": "no-store" } });
}
