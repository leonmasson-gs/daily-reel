import { ImageResponse } from "next/og";
import { config } from "@/lib/config";
import { GlyphShapes, RARITY_COLOR } from "@/components/Glyph";

// Share images. Only whitelisted values are drawn, never free text from the URL.
const INK = "#172123";
const PANEL = "#374d50";
const GOLD = "#ffd200";
const SKY = "#32cbf0";
const PAPER = "#f0f0f0";
const MUTED = "#a9bbbd";
const MEDAL: Record<string, string> = { bronze: "#c27c45", silver: "#d3dcdd", gold: "#ffd200", platinum: "#32cbf0" };

const num = (v: string | null, max: number) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));

function Symbol({ id, size, on }: { id: string; size: number; on: boolean }) {
  const sym = config.symbols.find((s) => s.id === id)!;
  const c = RARITY_COLOR[sym.rarity] ?? RARITY_COLOR.Common;
  return (
    <div style={{ display: "flex", width: size, height: size, alignItems: "center", justifyContent: "center", borderRadius: size / 5, background: "#0f1718", opacity: on ? 1 : 0.28 }}>
      <svg width={size * 0.68} height={size * 0.68} viewBox="0 0 64 64">
        {GlyphShapes({ id, c: on ? c : "#7c8d8f" })}
      </svg>
    </div>
  );
}

function Medal({ tier, size }: { tier: string; size: number }) {
  const c = MEDAL[tier.toLowerCase()] ?? GOLD;
  return (
    <svg width={size} height={size} viewBox="0 0 96 96">
      <path d="M30 4h14l8 28H38z" fill={SKY} opacity="0.85" />
      <path d="M66 4H52l-8 28h14z" fill={GOLD} opacity="0.85" />
      <circle cx="48" cy="60" r="32" fill={c} />
      <circle cx="48" cy="60" r="23" fill="none" stroke="#14201f" strokeOpacity="0.4" strokeWidth="3" />
      <polygon points="48,45 52.6,55.4 63.9,56.1 55.3,63.5 58,74.4 48,68.5 38,74.4 40.7,63.5 32.1,56.1 43.4,55.4" fill="#14201f" fillOpacity="0.5" />
    </svg>
  );
}

const Brand = ({ size }: { size: number }) => (
  <div style={{ display: "flex", alignItems: "center", fontSize: size, fontWeight: 800, color: PAPER }}>
    <div style={{ display: "flex", width: size * 0.5, height: size * 0.5, borderRadius: 999, background: GOLD, marginRight: size * 0.35 }} />
    Daily Reel
  </div>
);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const host = url.host;
  const kind = url.searchParams.get("kind") === "invite" ? "invite" : "week";
  const footer = "Free to play. 18+ only. No stake, no prizes.";

  if (kind === "invite") {
    return new ImageResponse(
      (
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%", background: INK, padding: 56, border: `10px solid ${GOLD}` }}>
          <Brand size={44} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "column", maxWidth: 560 }}>
              <div style={{ display: "flex", fontSize: 68, fontWeight: 800, color: PAPER, lineHeight: 1.05 }}>Three free spins a day.</div>
              <div style={{ display: "flex", fontSize: 32, color: MUTED, marginTop: 20 }}>Collect symbols. Build your weekly tier.</div>
            </div>
            <div style={{ display: "flex", background: PANEL, borderRadius: 28, padding: 18 }}>
              {["cherry", "star", "crown"].map((id) => (
                <div key={id} style={{ display: "flex", marginLeft: id === "cherry" ? 0 : 14 }}><Symbol id={id} size={128} on /></div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: MUTED }}>
            <div style={{ display: "flex" }}>{footer}</div>
            <div style={{ display: "flex", color: GOLD }}>{host}</div>
          </div>
        </div>
      ),
      { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=3600" } },
    );
  }

  const tier = (config.tiers.find((t) => t.name.toLowerCase() === (url.searchParams.get("tier") ?? "").toLowerCase()) ?? config.tiers[0]).name;
  const points = num(url.searchParams.get("pts"), 99999);
  const days = num(url.searchParams.get("days"), 7);
  const found = new Set((url.searchParams.get("found") ?? "").split(",").filter((id) => config.symbols.some((s) => s.id === id)));

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%", background: INK, padding: 64, border: `12px solid ${GOLD}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Brand size={48} />
          <div style={{ display: "flex", fontSize: 30, color: MUTED }}>My week</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <Medal tier={tier} size={300} />
          <div style={{ display: "flex", fontSize: 120, fontWeight: 800, color: PAPER, marginTop: 8 }}>{tier}</div>
          <div style={{ display: "flex", fontSize: 44, color: GOLD, fontWeight: 700, marginTop: 4 }}>{points} points this week</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ display: "flex", background: PANEL, borderRadius: 30, padding: 20 }}>
            {config.symbols.map((s, i) => (
              <div key={s.id} style={{ display: "flex", marginLeft: i === 0 ? 0 : 12 }}><Symbol id={s.id} size={92} on={found.has(s.id)} /></div>
            ))}
          </div>
          <div style={{ display: "flex", fontSize: 32, color: PAPER, marginTop: 24 }}>
            {found.size} of {config.symbols.length} symbols found. {days} of 7 days played.
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, color: MUTED }}>
          <div style={{ display: "flex" }}>{footer}</div>
          <div style={{ display: "flex", color: GOLD }}>{host}</div>
        </div>
      </div>
    ),
    { width: 1080, height: 1080, headers: { "Cache-Control": "public, max-age=300" } },
  );
}
