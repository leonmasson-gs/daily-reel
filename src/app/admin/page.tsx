import type { Metadata } from "next";
import AdminStats from "@/components/AdminStats";

export const metadata: Metadata = { title: "Daily Reel stats", robots: { index: false, follow: false } };

export default function Page() {
  return <AdminStats />;
}
