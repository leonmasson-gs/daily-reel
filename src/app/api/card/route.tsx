import { ImageResponse } from "next/og";
import { config } from "@/lib/config";
import { skinById, type Skin } from "@/lib/skins";
import { GlyphShapes } from "@/components/glyph-shapes";

// Share images. Only whitelisted values are drawn, never free text from the URL. The skin only changes colours,
// names and artwork. It cannot change the rules or any wording about them.

const num = (v: string | null, max: number) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));

function Symbol({ id, size, on, skin }: { id: string; size: number; on: boolean; skin: Skin }) {
  const sym = config.symbols.find((s) => s.id === id)!;
  const c = skin.rarity[sym.rarity as keyof Skin["rarity"]] ?? skin.rarity.Common;
  const art = skin.symbols[id]?.art ?? id;
  return (
    <div style={{ display: "flex", width: size, height: size, alignItems: "center", justifyContent: "center", borderRadius: size / 5, background: skin.card.win, opacity: on ? 1 : 0.28 }}>
      <svg width={size * 0.68} height={size * 0.68} viewBox="0 0 64 64">
        {GlyphShapes({ id: art, c: on ? c : "#6F7E92" })}
      </svg>
    </div>
  );
}

function Medal({ tier, size, skin }: { tier: string; size: number; skin: Skin }) {
  const c = skin.medal[tier.toLowerCase() as keyof Skin["medal"]] ?? skin.card.accent;
  return (
    <svg width={size} height={size} viewBox="0 0 96 96">
      <path d="M30 4h14l8 28H38z" fill={skin.card.accent2} opacity="0.85" />
      <path d="M66 4H52l-8 28h14z" fill={skin.card.accent} opacity="0.85" />
      <circle cx="48" cy="60" r="32" fill={c} />
      <circle cx="48" cy="60" r="23" fill="none" stroke={skin.card.win} strokeOpacity="0.4" strokeWidth="3" />
      <polygon points="48,45 52.6,55.4 63.9,56.1 55.3,63.5 58,74.4 48,68.5 38,74.4 40.7,63.5 32.1,56.1 43.4,55.4" fill={skin.card.win} fillOpacity="0.5" />
    </svg>
  );
}

function Brand({ size, skin }: { size: number; skin: Skin }) {
  const k = skin.card;
  if (skin.brand.parts) {
    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: size, fontWeight: 900, letterSpacing: -1 }}>
          <div style={{ display: "flex", color: k.accent }}>{skin.brand.parts[0]}</div>
          <div style={{ display: "flex", color: k.text }}>{skin.brand.parts[1]}</div>
        </div>
        {skin.brand.eyebrow && <div style={{ display: "flex", fontSize: size * 0.4, color: k.accent, letterSpacing: 4, marginTop: 2 }}>{skin.brand.eyebrow.toUpperCase()}</div>}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", fontSize: size, fontWeight: 800, color: k.text }}>
      <div style={{ display: "flex", width: size * 0.5, height: size * 0.5, borderRadius: 999, background: k.accent, marginRight: size * 0.35 }} />
      {skin.brand.name}
    </div>
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const host = url.host;
  const skin = skinById(url.searchParams.get("skin"));
  const k = skin.card;
  const kind = url.searchParams.get("kind") === "invite" ? "invite" : "week";
  const footer = "Free to play. 18+ (21+ where US rules require). No stake, no prizes.";

  if (kind === "invite") {
    const showcase = ["cherry", "star", "crown"];
    return new ImageResponse(
      (
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%", background: k.bg, padding: 56, border: `10px solid ${k.accent}` }}>
          <Brand size={44} skin={skin} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "column", maxWidth: 560 }}>
              <div style={{ display: "flex", fontSize: 68, fontWeight: 800, color: k.text, lineHeight: 1.05 }}>Three free spins a day.</div>
              <div style={{ display: "flex", fontSize: 32, color: k.muted, marginTop: 20 }}>Collect symbols. Build your weekly tier.</div>
            </div>
            <div style={{ display: "flex", background: k.panel, borderRadius: 28, padding: 18 }}>
              {showcase.map((id, i) => (
                <div key={id} style={{ display: "flex", marginLeft: i === 0 ? 0 : 14 }}><Symbol id={id} size={128} on skin={skin} /></div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: k.muted }}>
            <div style={{ display: "flex" }}>{footer}</div>
            <div style={{ display: "flex", color: k.accent }}>{host}</div>
          </div>
        </div>
      ),
      { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=3600" } },
    );
  }

  const tier = (config.tiers.find((t) => t.name.toLowerCase() === (url.searchParams.get("tier") ?? "").toLowerCase()) ?? config.tiers[0]).name;
  const points = num(url.searchParams.get("pts"), 99999);
  const days = num(url.searchParams.get("days"), 7);
  const trophies = num(url.searchParams.get("trophies"), 9);
  const found = new Set((url.searchParams.get("found") ?? "").split(",").filter((id) => config.symbols.some((s) => s.id === id)));

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%", background: k.bg, padding: 64, border: `12px solid ${k.accent}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Brand size={48} skin={skin} />
          <div style={{ display: "flex", fontSize: 30, color: k.muted }}>My week</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <Medal tier={tier} size={300} skin={skin} />
          <div style={{ display: "flex", fontSize: 120, fontWeight: 800, color: k.text, marginTop: 8 }}>{tier}</div>
          <div style={{ display: "flex", fontSize: 44, color: k.accent, fontWeight: 700, marginTop: 4 }}>{points} points this week</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ display: "flex", background: k.panel, borderRadius: 30, padding: 20 }}>
            {config.symbols.map((s, i) => (
              <div key={s.id} style={{ display: "flex", marginLeft: i === 0 ? 0 : 12 }}><Symbol id={s.id} size={92} on={found.has(s.id)} skin={skin} /></div>
            ))}
          </div>
          <div style={{ display: "flex", fontSize: 32, color: k.text, marginTop: 24 }}>
            {found.size} of {config.symbols.length} symbols found. {days} of 7 days played. {trophies} {trophies === 1 ? "trophy" : "trophies"}.
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, color: k.muted }}>
          <div style={{ display: "flex" }}>{footer}</div>
          <div style={{ display: "flex", color: k.accent }}>{host}</div>
        </div>
      </div>
    ),
    { width: 1080, height: 1080, headers: { "Cache-Control": "public, max-age=300" } },
  );
}
