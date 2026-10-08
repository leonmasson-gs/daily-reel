// Flat symbol artwork. Colour tells you the rarity: grey = common, sky = rare, gold = epic and legendary.
export const RARITY_COLOR: Record<string, string> = {
  Common: "#b4c4c6",
  Rare: "#32cbf0",
  Epic: "#e6b400",
  Legendary: "#ffd200",
};
const INK = "#14201f";

export function Glyph({ id, rarity, title }: { id: string; rarity: string; title?: string }) {
  const c = RARITY_COLOR[rarity] ?? RARITY_COLOR.Common;
  const common = { viewBox: "0 0 64 64", role: "img", "aria-label": title ?? id, focusable: false } as const;

  switch (id) {
    case "cherry":
      return (
        <svg {...common}>
          <path d="M22 32 Q28 14 38 10 M43 35 Q42 20 38 10" stroke={c} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M38 10 Q50 6 56 14 Q46 18 38 10Z" fill={c} />
          <circle cx="22" cy="44" r="12" fill={c} />
          <circle cx="43" cy="46" r="11" fill={c} />
          <path d="M16 40 Q18 36 22 35" stroke={INK} strokeOpacity=".3" strokeWidth="3" fill="none" strokeLinecap="round" />
        </svg>
      );
    case "bell":
      return (
        <svg {...common}>
          <path d="M32 8a4 4 0 0 1 4 4v2c10 3 14 11 14 22l5 8v3H9v-3l5-8c0-11 4-19 14-22v-2a4 4 0 0 1 4-4z" fill={c} />
          <circle cx="32" cy="54" r="5" fill={c} />
          <path d="M20 36 Q21 24 30 19" stroke={INK} strokeOpacity=".3" strokeWidth="3" fill="none" strokeLinecap="round" />
        </svg>
      );
    case "lemon":
      return (
        <svg {...common}>
          <path d="M4 33 Q9 28 14 26 Q22 13 34 13 Q47 13 54 27 Q58 29 60 31 Q58 34 54 36 Q47 51 34 51 Q22 51 14 38 Q9 37 4 33Z" fill={c} strokeLinejoin="round" />
          <path d="M24 24 Q30 19 38 20" stroke={INK} strokeOpacity=".3" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M30 51 Q34 56 40 55" stroke={c} strokeWidth="3" fill="none" strokeLinecap="round" />
        </svg>
      );
    case "clover":
      return (
        <svg {...common}>
          <path d="M32 44 Q31 54 25 59" stroke={c} strokeWidth="4" fill="none" strokeLinecap="round" />
          <circle cx="32" cy="19" r="11" fill={c} />
          <circle cx="19" cy="32" r="11" fill={c} />
          <circle cx="45" cy="32" r="11" fill={c} />
          <circle cx="32" cy="43" r="11" fill={c} />
          <circle cx="32" cy="31" r="6" fill={INK} fillOpacity=".25" />
        </svg>
      );
    case "star":
      return (
        <svg {...common}>
          <polygon
            points="32,8 38.5,25.1 56.7,26 42.5,37.4 47.3,55 32,45 16.7,55 21.5,37.4 7.3,26 25.5,25.1"
            fill={c}
            strokeLinejoin="round"
          />
          <path d="M32 18 L35 26" stroke={INK} strokeOpacity=".3" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case "gem":
      return (
        <svg {...common}>
          <path d="M18 12H46L58 26L32 56L6 26Z" fill={c} />
          <path d="M6 26H58M18 12L24 26L32 56L40 26L46 12M24 26L32 12L40 26" stroke={INK} strokeOpacity=".35" strokeWidth="2.5" fill="none" strokeLinejoin="round" />
        </svg>
      );
    case "crown":
      return (
        <svg {...common}>
          <path d="M8 46L12 18L24 32L32 14L40 32L52 18L56 46Z" fill={c} strokeLinejoin="round" />
          <rect x="8" y="48" width="48" height="8" rx="2" fill={c} />
          <circle cx="12" cy="16" r="4" fill={c} />
          <circle cx="32" cy="12" r="4" fill={c} />
          <circle cx="52" cy="16" r="4" fill={c} />
          <rect x="14" y="51" width="36" height="2" rx="1" fill={INK} fillOpacity=".3" />
        </svg>
      );
    case "golden-reel":
      return (
        <svg {...common}>
          <circle cx="32" cy="32" r="27" fill={c} />
          <circle cx="32" cy="32" r="19" fill="none" stroke={INK} strokeOpacity=".45" strokeWidth="3" />
          <rect x="20" y="22" width="6" height="20" rx="3" fill={INK} fillOpacity=".6" />
          <rect x="29" y="22" width="6" height="20" rx="3" fill={INK} fillOpacity=".6" />
          <rect x="38" y="22" width="6" height="20" rx="3" fill={INK} fillOpacity=".6" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="32" cy="32" r="20" fill={c} />
        </svg>
      );
  }
}
