"use client";

import { useSkin } from "./SkinContext";

// Simple flat artwork for the sample rewards. All of it is placeholder. Colours come from the skin.

export type ArtKind = "badge" | "gift" | "voucher" | "hamper" | "ticket" | "star" | "trophy" | "jersey" | "ball" | "stadium";

export function RewardArt({ kind, size = 56, label }: { kind: ArtKind; size?: number; label?: string }) {
  const { gold: GOLD, sky: SKY, ink: INK, panel: PANEL, copper: COPPER, paper: PAPER } = useSkin().art;
  const common = { width: size, height: size, viewBox: "0 0 64 64", role: label ? "img" : "presentation", "aria-label": label, focusable: false } as const;
  switch (kind) {
    case "badge":
      return (
        <svg {...common}>
          <path d="M32 5 L55 13 V30 C55 45 45 55 32 59 C19 55 9 45 9 30 V13 Z" fill={GOLD} />
          <path d="M32 11 L49 17 V30 C49 41 42 49 32 53 C22 49 15 41 15 30 V17 Z" fill="none" stroke={INK} strokeOpacity=".4" strokeWidth="3" />
          <path d="M23 31 L29 37 L41 24" fill="none" stroke={INK} strokeOpacity=".7" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "gift":
      return (
        <svg {...common}>
          <rect x="12" y="28" width="40" height="26" rx="3" fill={SKY} />
          <rect x="8" y="20" width="48" height="11" rx="3" fill="#3A86D8" />
          <rect x="29" y="20" width="6" height="34" fill={GOLD} />
          <path d="M32 20 C24 8 14 12 20 20 Z M32 20 C40 8 50 12 44 20 Z" fill="none" stroke={GOLD} strokeWidth="3.5" strokeLinejoin="round" />
        </svg>
      );
    case "voucher":
      return (
        <svg {...common}>
          <rect x="6" y="16" width="52" height="34" rx="6" fill={PANEL} stroke={GOLD} strokeWidth="2.5" />
          <circle cx="22" cy="33" r="9" fill={GOLD} />
          <circle cx="22" cy="33" r="5" fill="none" stroke={INK} strokeOpacity=".45" strokeWidth="2" />
          <rect x="36" y="25" width="16" height="4" rx="2" fill={PAPER} />
          <rect x="36" y="33" width="12" height="4" rx="2" fill={PAPER} opacity=".7" />
          <rect x="36" y="41" width="8" height="3" rx="1.5" fill={PAPER} opacity=".5" />
        </svg>
      );
    case "hamper":
      return (
        <svg {...common}>
          <path d="M14 26 C14 10 50 10 50 26" fill="none" stroke={COPPER} strokeWidth="4" strokeLinecap="round" />
          <rect x="10" y="28" width="44" height="26" rx="4" fill={COPPER} />
          <rect x="8" y="22" width="48" height="9" rx="3" fill="#CB9660" />
          <rect x="29" y="22" width="6" height="32" fill={GOLD} />
          <path d="M16 38 H26 M38 38 H48 M16 46 H26 M38 46 H48" stroke={INK} strokeOpacity=".25" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
    case "ticket":
      return (
        <svg {...common}>
          <path d="M6 18 H58 V27 A5 5 0 0 0 58 37 V46 H6 V37 A5 5 0 0 0 6 27 Z" fill={SKY} />
          <path d="M40 18 V46" stroke={INK} strokeOpacity=".4" strokeWidth="2.5" strokeDasharray="3 4" />
          <polygon points="23,24 25.6,29.6 31.7,30.2 27.1,34.2 28.5,40.2 23,37 17.5,40.2 18.9,34.2 14.3,30.2 20.4,29.6" fill={INK} fillOpacity=".5" />
        </svg>
      );
    case "jersey":
      return (
        <svg {...common}>
          <polygon points="22,8 32,13 42,8 58,18 51,31 45,28 45,57 19,57 19,28 13,31 6,18" fill={SKY} strokeLinejoin="round" />
          <path d="M25 8 Q32 19 39 8" fill="none" stroke={INK} strokeOpacity=".45" strokeWidth="3" />
          <text x="32" y="44" textAnchor="middle" fontSize="15" fontWeight="800" fontFamily="Arial, sans-serif" fill={PAPER}>10</text>
          <path d="M22 51 C27 47 31 53 36 49 C39 47 41 50 43 49" fill="none" stroke={GOLD} strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
    case "ball":
      return (
        <svg {...common}>
          <circle cx="32" cy="32" r="25" fill={PAPER} />
          <polygon points="32,20 43,28 39,41 25,41 21,28" fill={INK} fillOpacity=".75" />
          <path d="M32 20 V8 M43 28 L55 24 M39 41 L46 52 M25 41 L18 52 M21 28 L9 24" stroke={INK} strokeOpacity=".55" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M12 46 C20 40 24 50 32 44 C36 41 40 45 44 43" fill="none" stroke={GOLD} strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case "stadium":
      return (
        <svg {...common}>
          <ellipse cx="32" cy="40" rx="27" ry="14" fill={PANEL} stroke={GOLD} strokeWidth="2.5" />
          <ellipse cx="32" cy="40" rx="17" ry="7.5" fill="#2F8F5B" />
          <path d="M32 33 V47 M15 40 H49" stroke={PAPER} strokeOpacity=".6" strokeWidth="1.5" />
          <path d="M12 30 V14 M52 30 V14" stroke={GOLD} strokeWidth="3" strokeLinecap="round" />
          <rect x="7" y="10" width="10" height="6" rx="2" fill={PAPER} />
          <rect x="47" y="10" width="10" height="6" rx="2" fill={PAPER} />
        </svg>
      );
    case "trophy":
      return (
        <svg {...common}>
          <path d="M18 8 H46 V26 C46 36 40 42 32 42 C24 42 18 36 18 26 Z" fill={GOLD} />
          <path d="M18 14 H9 C9 26 13 30 19 31 M46 14 H55 C55 26 51 30 45 31" fill="none" stroke={GOLD} strokeWidth="4" strokeLinecap="round" />
          <rect x="29" y="42" width="6" height="9" fill={GOLD} />
          <rect x="21" y="51" width="22" height="6" rx="2" fill={GOLD} />
          <path d="M24 14 V25" stroke={INK} strokeOpacity=".3" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case "star":
    default:
      return (
        <svg {...common}>
          <circle cx="32" cy="32" r="26" fill={PANEL} stroke={GOLD} strokeWidth="2.5" />
          <polygon points="32,12 37.5,26.2 52.8,27 41,36.6 44.9,51.4 32,43 19.1,51.4 23,36.6 11.2,27 26.5,26.2" fill={GOLD} />
        </svg>
      );
  }
}
