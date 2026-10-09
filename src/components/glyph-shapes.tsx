// Flat symbol artwork. Colour tells you the rarity: grey = common, sky = rare, gold = epic and legendary.
export const RARITY_COLOR: Record<string, string> = {
  Common: "#B8B2A4",
  Rare: "#4DA7FF",
  Epic: "#C88A2E",
  Legendary: "#E6AE55",
};
const INK = "#081A31";

/** The drawing itself, without the <svg> wrapper, so it can also be used on the share card. */
export function GlyphShapes({ id, c }: { id: string; c: string }) {
  switch (id) {
    case "cherry":
      return (
        <>
          <path d="M22 32 Q28 14 38 10 M43 35 Q42 20 38 10" stroke={c} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M38 10 Q50 6 56 14 Q46 18 38 10Z" fill={c} />
          <circle cx="22" cy="44" r="12" fill={c} />
          <circle cx="43" cy="46" r="11" fill={c} />
          <path d="M16 40 Q18 36 22 35" stroke={INK} strokeOpacity=".3" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      );
    case "bell":
      return (
        <>
          <path d="M32 8a4 4 0 0 1 4 4v2c10 3 14 11 14 22l5 8v3H9v-3l5-8c0-11 4-19 14-22v-2a4 4 0 0 1 4-4z" fill={c} />
          <circle cx="32" cy="54" r="5" fill={c} />
          <path d="M20 36 Q21 24 30 19" stroke={INK} strokeOpacity=".3" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      );
    case "lemon":
      return (
        <>
          <path d="M4 33 Q9 28 14 26 Q22 13 34 13 Q47 13 54 27 Q58 29 60 31 Q58 34 54 36 Q47 51 34 51 Q22 51 14 38 Q9 37 4 33Z" fill={c} strokeLinejoin="round" />
          <path d="M24 24 Q30 19 38 20" stroke={INK} strokeOpacity=".3" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M30 51 Q34 56 40 55" stroke={c} strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      );
    case "clover":
      return (
        <>
          <path d="M32 44 Q31 54 25 59" stroke={c} strokeWidth="4" fill="none" strokeLinecap="round" />
          <circle cx="32" cy="19" r="11" fill={c} />
          <circle cx="19" cy="32" r="11" fill={c} />
          <circle cx="45" cy="32" r="11" fill={c} />
          <circle cx="32" cy="43" r="11" fill={c} />
          <circle cx="32" cy="31" r="6" fill={INK} fillOpacity=".25" />
        </>
      );
    case "star":
      return (
        <>
          <polygon
            points="32,8 38.5,25.1 56.7,26 42.5,37.4 47.3,55 32,45 16.7,55 21.5,37.4 7.3,26 25.5,25.1"
            fill={c}
            strokeLinejoin="round"
          />
          <path d="M32 18 L35 26" stroke={INK} strokeOpacity=".3" strokeWidth="3" strokeLinecap="round" />
        </>
      );
    case "gem":
      return (
        <>
          <path d="M18 12H46L58 26L32 56L6 26Z" fill={c} />
          <path d="M6 26H58M18 12L24 26L32 56L40 26L46 12M24 26L32 12L40 26" stroke={INK} strokeOpacity=".35" strokeWidth="2.5" fill="none" strokeLinejoin="round" />
        </>
      );
    case "crown":
      return (
        <>
          <path d="M8 46L12 18L24 32L32 14L40 32L52 18L56 46Z" fill={c} strokeLinejoin="round" />
          <rect x="8" y="48" width="48" height="8" rx="2" fill={c} />
          <circle cx="12" cy="16" r="4" fill={c} />
          <circle cx="32" cy="12" r="4" fill={c} />
          <circle cx="52" cy="16" r="4" fill={c} />
          <rect x="14" y="51" width="36" height="2" rx="1" fill={INK} fillOpacity=".3" />
        </>
      );
    case "golden-reel":
      return (
        <>
          <circle cx="32" cy="32" r="27" fill={c} />
          <circle cx="32" cy="32" r="19" fill="none" stroke={INK} strokeOpacity=".45" strokeWidth="3" />
          <rect x="20" y="22" width="6" height="20" rx="3" fill={INK} fillOpacity=".6" />
          <rect x="29" y="22" width="6" height="20" rx="3" fill={INK} fillOpacity=".6" />
          <rect x="38" y="22" width="6" height="20" rx="3" fill={INK} fillOpacity=".6" />
        </>
      );
    case "wild":
    case "wildcard": {
      const tilt = id === "wildcard" ? "rotate(-9 32 32)" : undefined;
      return (
        <g transform={tilt}>
          <rect x="12" y="5" width="40" height="54" rx="8" fill={c} />
          <rect x="17" y="10" width="30" height="44" rx="5" fill="none" stroke={INK} strokeOpacity=".3" strokeWidth="2" />
          <path d="M20 22 L26 44 L32 29 L38 44 L44 22" fill="none" stroke={INK} strokeOpacity=".7" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M22 13 L23.6 16.4 L27 18 L23.6 19.6 L22 23 L20.4 19.6 L17 18 L20.4 16.4 Z" fill={INK} fillOpacity=".4" transform="scale(.6) translate(15 5)" />
        </g>
      );
    }
    // ---- football set (Tom Garratt Bets skin) ----
    case "whistle":
      return (
        <>
          <circle cx="24" cy="38" r="16" fill={c} />
          <rect x="30" y="18" width="30" height="14" rx="5" fill={c} />
          <circle cx="24" cy="38" r="6" fill={INK} fillOpacity=".4" />
          <circle cx="13" cy="20" r="6" fill="none" stroke={c} strokeWidth="3.5" />
          <path d="M34 25 H56" stroke={INK} strokeOpacity=".3" strokeWidth="3" strokeLinecap="round" />
        </>
      );
    case "flag":
      return (
        <>
          <rect x="27" y="8" width="5" height="48" rx="2.5" fill={c} />
          <polygon points="32,10 56,19 32,28" fill={c} />
          <ellipse cx="29.5" cy="58" rx="15" ry="4" fill={c} fillOpacity=".5" />
          <path d="M36 16 L47 20" stroke={INK} strokeOpacity=".3" strokeWidth="3" strokeLinecap="round" />
        </>
      );
    case "boot":
      return (
        <>
          <path d="M8 10 H27 V29 C27 33 31 35 37 37 L56 43 C61 44.5 61 52 55 52 H8 Z" fill={c} />
          <rect x="8" y="52" width="48" height="4" rx="1" fill={INK} fillOpacity=".4" />
          <rect x="13" y="56" width="5" height="5" rx="1.5" fill={c} />
          <rect x="26" y="56" width="5" height="5" rx="1.5" fill={c} />
          <rect x="39" y="56" width="5" height="5" rx="1.5" fill={c} />
          <path d="M31 40 L40 43 M28 34 L36 37" stroke={INK} strokeOpacity=".35" strokeWidth="2.5" strokeLinecap="round" />
        </>
      );
    case "shirt":
      return (
        <>
          <polygon points="22,8 32,14 42,8 58,18 50,31 44,27 44,57 20,57 20,27 14,31 6,18" fill={c} strokeLinejoin="round" />
          <path d="M25 8 Q32 20 39 8" fill="none" stroke={INK} strokeOpacity=".4" strokeWidth="3" />
          <rect x="20" y="36" width="24" height="5" fill={INK} fillOpacity=".25" />
        </>
      );
    case "ball":
    case "goldball": {
      const gold = id === "goldball";
      const cx = gold ? 29 : 32, cy = gold ? 35 : 32, r = gold ? 22 : 26;
      const k = r / 26;
      return (
        <>
          <circle cx={cx} cy={cy} r={r} fill={c} />
          <polygon points={`${cx},${cy - 12 * k} ${cx + 11 * k},${cy - 4 * k} ${cx + 7 * k},${cy + 9 * k} ${cx - 7 * k},${cy + 9 * k} ${cx - 11 * k},${cy - 4 * k}`} fill={INK} fillOpacity=".55" />
          <path d={`M${cx} ${cy - 12 * k} V${cy - r + 2} M${cx + 11 * k} ${cy - 4 * k} L${cx + r - 2} ${cy - 8 * k} M${cx + 7 * k} ${cy + 9 * k} L${cx + 15 * k} ${cy + r - 5 * k} M${cx - 7 * k} ${cy + 9 * k} L${cx - 15 * k} ${cy + r - 5 * k} M${cx - 11 * k} ${cy - 4 * k} L${cx - r + 2} ${cy - 8 * k}`} stroke={INK} strokeOpacity=".55" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          {gold && <path d="M53 4 L55.5 10.5 L62 13 L55.5 15.5 L53 22 L50.5 15.5 L44 13 L50.5 10.5 Z" fill={c} />}
        </>
      );
    }
    case "gloves":
      return (
        <>
          <rect x="18" y="28" width="30" height="24" rx="9" fill={c} />
          <rect x="18" y="13" width="7" height="26" rx="3.5" fill={c} />
          <rect x="26" y="8" width="7" height="30" rx="3.5" fill={c} />
          <rect x="34" y="9" width="7" height="30" rx="3.5" fill={c} />
          <rect x="42" y="14" width="7" height="26" rx="3.5" fill={c} />
          <rect x="7" y="34" width="20" height="9" rx="4.5" fill={c} transform="rotate(-28 17 38)" />
          <rect x="20" y="51" width="26" height="8" rx="2" fill={c} />
          <rect x="20" y="53" width="26" height="3" fill={INK} fillOpacity=".35" />
        </>
      );
    case "armband":
      return (
        <>
          <rect x="5" y="18" width="54" height="28" rx="7" fill={c} />
          <path d="M11 18 V46 M53 18 V46" stroke={INK} strokeOpacity=".25" strokeWidth="2.5" />
          <path d="M39 26.5 A9 9 0 1 0 39 37.5" fill="none" stroke={INK} strokeOpacity=".6" strokeWidth="4.5" strokeLinecap="round" />
        </>
      );
    default:
      return (
        <>
          <circle cx="32" cy="32" r="20" fill={c} />
        </>
      );
  }
}
