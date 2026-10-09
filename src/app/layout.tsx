import type { Metadata, Viewport } from "next";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/montserrat/latin-800.css";
import "@fontsource/montserrat/latin-900.css";
import "@fontsource/barlow-condensed/latin-700.css";
import "./globals.css";
import { SKINS, defaultSkinId } from "@/lib/skins";

const site = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: "Daily Reel",
  description: "Three free spins a day. Collect symbols, climb the weekly tier. Free to play. 18+ (21+ where US rules require).",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0E2A4D" };

// Runs before the page paints: use the skin from the address (?skin=...) or the one saved on this device, so there is no flash.
const pickSkin = (fallback: string) =>
  `try{var ids=${JSON.stringify(Object.keys(SKINS))};var q=new URLSearchParams(location.search).get('skin');var s=q&&ids.indexOf(q)>-1?q:localStorage.getItem('dr_skin');document.documentElement.dataset.skin=ids.indexOf(s)>-1?s:'${fallback}'}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const fallback = defaultSkinId();
  return (
    <html lang="en" data-skin={fallback} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: pickSkin(fallback) }} /></head>
      <body>{children}</body>
    </html>
  );
}
