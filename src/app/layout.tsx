import type { Metadata, Viewport } from "next";
import "./globals.css";

const site = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: "Daily Reel",
  description: "Three free spins a day. Collect symbols, climb the weekly tier. Free to play, 18+.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#172123" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
