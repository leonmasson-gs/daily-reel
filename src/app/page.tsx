import type { Metadata } from "next";
import Game from "@/components/Game";

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const sp = await searchParams;
  const invited = typeof sp.ref === "string";
  const title = invited ? "A friend invited you to Daily Reel" : "Daily Reel";
  const description = "Three free spins a day. Collect symbols and build your weekly tier. Free to play. 18+ (21+ where US rules require).";
  const image = { url: "/api/card?kind=invite", width: 1200, height: 630, alt: "Daily Reel: three free spins a day" };
  return {
    title,
    description,
    openGraph: { title, description, images: [image], type: "website" },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
  };
}

export default function Page() {
  return <Game />;
}
