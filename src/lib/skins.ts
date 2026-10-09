/*
  Skins. A skin is a look, a name and a set of symbol drawings. It never changes the rules, the odds or the compliance
  wording: those live in config/reel.json. Add a skin by adding an entry here, a token block in globals.css
  (html[data-skin="<id>"]), and, if it has new artwork, the drawings in Glyph.tsx.
*/
import { config } from "./config";

export type Rarity = "Common" | "Rare" | "Epic" | "Legendary";
export type TierId = "bronze" | "silver" | "gold" | "platinum";

export type Skin = {
  id: string;
  label: string;
  brand: { name: string; parts?: [string, string]; eyebrow?: string };
  title: string;
  tagline: string;
  /** Per symbol id: the name players see and which drawing to use. */
  symbols: Record<string, { name: string; art: string }>;
  rarity: Record<Rarity, string>;
  medal: Record<TierId, string>;
  /** Colours for the reward and trophy artwork. */
  art: { gold: string; sky: string; ink: string; panel: string; copper: string; paper: string };
  /** Colours for the share card (drawn on the server, which cannot read the stylesheet). */
  card: { bg: string; panel: string; accent: string; accent2: string; text: string; muted: string; win: string };
  bonus: { title: string; intro: string; zone: string; stop: string; marker: "dot" | "ball" };
  themeColor: string;
};

const GRANDSTAND: Skin = {
  id: "grandstand",
  label: "Grandstand",
  brand: { name: "Daily Reel" },
  title: "Daily Reel",
  tagline: "Three free spins a day. Collect symbols and build your weekly tier.",
  symbols: Object.fromEntries(config.symbols.map((s) => [s.id, { name: s.name, art: s.id }])),
  rarity: { Common: "#B8B2A4", Rare: "#4DA7FF", Epic: "#C88A2E", Legendary: "#E6AE55" },
  medal: { bronze: "#B07A45", silver: "#CFCBBF", gold: "#C88A2E", platinum: "#4DA7FF" },
  art: { gold: "#C88A2E", sky: "#4DA7FF", ink: "#081A31", panel: "#225080", copper: "#B07A45", paper: "#F4F1EA" },
  card: { bg: "#0E2A4D", panel: "#1D4876", accent: "#C88A2E", accent2: "#4DA7FF", text: "#F4F1EA", muted: "#B8B2A4", win: "#081A31" },
  bonus: { title: "Bonus round", intro: "A triple match earns a bonus round. Stop the marker in the gold zone. Skill counts here, and points only.", zone: "gold zone", stop: "Stop", marker: "dot" },
  themeColor: "#0E2A4D",
};

// Colours read from the Tom Garratt Bets site: background #0A0E1A, yellow #F5C300, text #F4F5F8, muted #989AA1.
const TGB: Skin = {
  id: "tgb",
  label: "Tom Garratt Bets",
  brand: { name: "TOMGARRATTBETS", parts: ["TOMGARRATT", "BETS"], eyebrow: "Daily Reel" },
  title: "Daily Reel",
  tagline: "Three free spins a day. Collect the football symbols and build your week.",
  symbols: {
    cherry: { name: "Whistle", art: "whistle" },
    bell: { name: "Corner flag", art: "flag" },
    lemon: { name: "Boot", art: "boot" },
    clover: { name: "Shirt", art: "shirt" },
    star: { name: "Football", art: "ball" },
    gem: { name: "Gloves", art: "gloves" },
    crown: { name: "Armband", art: "armband" },
    "golden-reel": { name: "Golden ball", art: "goldball" },
    wild: { name: "Wildcard", art: "wildcard" },
  },
  rarity: { Common: "#9AA3BA", Rare: "#F4F5F8", Epic: "#F5C300", Legendary: "#FFD93D" },
  medal: { bronze: "#C98A4B", silver: "#C9CED8", gold: "#F5C300", platinum: "#9FD0FF" },
  art: { gold: "#F5C300", sky: "#8DB8FF", ink: "#070A14", panel: "#1D2538", copper: "#C98A4B", paper: "#F4F5F8" },
  card: { bg: "#0A0E1A", panel: "#161C2C", accent: "#F5C300", accent2: "#F4F5F8", text: "#F4F5F8", muted: "#989AA1", win: "#070A14" },
  bonus: { title: "Penalty!", intro: "A triple match earns a penalty. Stop the marker in the gold zone to score. Skill counts here, and points only.", zone: "gold zone", stop: "Shoot", marker: "ball" },
  themeColor: "#0A0E1A",
};

export const SKINS: Record<string, Skin> = { [GRANDSTAND.id]: GRANDSTAND, [TGB.id]: TGB };

/** The skin a deployment starts with. An operator sets NEXT_PUBLIC_DEFAULT_SKIN, or config.skin.default. */
export function defaultSkinId(): string {
  const fromEnv = process.env.NEXT_PUBLIC_DEFAULT_SKIN;
  if (fromEnv && SKINS[fromEnv]) return fromEnv;
  return SKINS[config.skin.default] ? config.skin.default : GRANDSTAND.id;
}

export function skinById(id?: string | null): Skin {
  return (id && SKINS[id]) || SKINS[defaultSkinId()];
}
