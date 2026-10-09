import { createHash } from "node:crypto";
import { config } from "./config";

/**
 * One symbol each day counts double in the points. It is the same for every player, it changes at the 18:00 reset,
 * and it never affects which symbols are drawn. The rare Legendary symbol is left out so it is a symbol you can
 * realistically hope to see.
 */
export function featuredSymbol(playDate: string): string {
  const ids = config.symbols.filter((s) => s.rarity !== "Legendary").map((s) => s.id);
  const h = createHash("sha256").update("featured:" + playDate).digest();
  return ids[h[0] % ids.length];
}
