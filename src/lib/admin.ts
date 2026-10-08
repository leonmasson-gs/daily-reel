import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "dr_admin";

export const adminConfigured = () => Boolean(process.env.ADMIN_KEY);

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET is not set.");
  return "dev-only-secret-change-me";
}
const sign = (v: string) => createHmac("sha256", secret()).update("admin:" + v).digest("base64url");

/** Compares without leaking the key through timing. */
export function keyMatches(input: string): boolean {
  const key = process.env.ADMIN_KEY;
  if (!key || !input) return false;
  const a = createHmac("sha256", "k").update(input).digest();
  const b = createHmac("sha256", "k").update(key).digest();
  return timingSafeEqual(a, b);
}

export async function isAdmin(): Promise<boolean> {
  if (!adminConfigured()) return false;
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return false;
  const [stamp, sig] = raw.split(".");
  if (!stamp || !sig) return false;
  const expected = Buffer.from(sign(stamp));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
  const issued = Number(stamp);
  return Number.isFinite(issued) && Date.now() - issued < 8 * 3600 * 1000;
}

export async function setAdminCookie() {
  const stamp = String(Date.now());
  (await cookies()).set(COOKIE, `${stamp}.${sign(stamp)}`, {
    httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 8 * 3600,
  });
}
export async function clearAdminCookie() {
  (await cookies()).delete(COOKIE);
}
