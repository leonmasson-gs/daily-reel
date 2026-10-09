"use client";

import { useSkin } from "./SkinContext";
import { GlyphShapes, RARITY_COLOR } from "./glyph-shapes";

export { GlyphShapes, RARITY_COLOR };

export function Glyph({ id, rarity, title }: { id: string; rarity: string; title?: string }) {
  const skin = useSkin();
  const art = skin.symbols[id]?.art ?? id;
  const c = skin.rarity[rarity as keyof typeof skin.rarity] ?? RARITY_COLOR[rarity] ?? RARITY_COLOR.Common;
  return (
    <svg viewBox="0 0 64 64" role="img" aria-label={title ?? skin.symbols[id]?.name ?? id} focusable={false}>
      <GlyphShapes id={art} c={c} />
    </svg>
  );
}
