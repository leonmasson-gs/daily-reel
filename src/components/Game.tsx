"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Sym = { id: string; name: string; icon: string; rarity: string; points: number; chancePerReel: number };
type Cfg = {
  copy: { title: string; tagline: string; footer: string };
  minAge: number;
  tiers: { id: string; name: string; minPoints: number }[];
  bonusSpinsPerWeekCap: number;
  partnerOffer: null | {
    sponsor: string; headline: string; body: string; cta: string; href: string; regions: string[]; disclosure: string;
  };
  odds: { symbols: Sym[]; triple: number; pair: number; none: number; multipliers: { pair: number; triple: number } };
};
type Player = {
  inviteCode: string;
  emailSaved: boolean;
  spins: { perDay: number; remaining: number; baseRemaining: number; bonusRemaining: number; bonusCapPerWeek: number; resetsAt: string };
  today: { symbols: string[]; outcome: string; points: number; is_bonus: boolean }[];
  collection: Record<string, number>;
  week: { points: number; tier: { id: string; name: string; minPoints: number }; nextTier: { name: string; minPoints: number } | null; pointsToNext: number };
};
type Tab = "play" | "collection" | "tier" | "invite";

const pct = (n: number) => (n * 100 < 1 ? (n * 100).toFixed(2) : (n * 100).toFixed(1)) + "%";
const track = (name: string, extra?: object) =>
  fetch("/api/event", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, ...extra }) }).catch(() => {});

export default function Game() {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [player, setPlayer] = useState<Player | null | undefined>(undefined); // undefined = loading
  const [tab, setTab] = useState<Tab>("play");

  const refresh = useCallback(async () => {
    const r = await fetch("/api/state").then((x) => x.json());
    setPlayer(r.player);
  }, []);

  useEffect(() => {
    fetch("/api/config").then((r) => r.json()).then(setCfg);
    refresh();
  }, [refresh]);

  if (!cfg || player === undefined) return <main className="app"><p className="muted">Loading…</p></main>;

  return (
    <main className="app">
      <h1>🎰 {cfg.copy.title}</h1>
      <p className="muted">{cfg.copy.tagline}</p>

      {player === null ? (
        <AgeGate cfg={cfg} onDone={refresh} />
      ) : (
        <>
          {tab === "play" && <Play cfg={cfg} player={player} setPlayer={setPlayer} />}
          {tab === "collection" && <Collection cfg={cfg} player={player} />}
          {tab === "tier" && <Tier cfg={cfg} player={player} />}
          {tab === "invite" && <Invite cfg={cfg} player={player} />}
          <nav className="nav"><div className="in">
            {([["play", "🎰", "Play"], ["collection", "🗂️", "Collection"], ["tier", "🏆", "Weekly tier"], ["invite", "🎁", "Invite"]] as const).map(([k, e, l]) => (
              <button key={k} className={tab === k ? "on" : ""} onClick={() => { setTab(k); if (k === "tier") track("tier_viewed"); }}>
                <span className="e">{e}</span>{l}
              </button>
            ))}
          </div></nav>
        </>
      )}

      <p className="muted foot">
        {cfg.copy.footer} <a href="https://www.begambleaware.org" target="_blank" rel="noopener noreferrer">BeGambleAware.org</a>
      </p>
    </main>
  );
}

function AgeGate({ cfg, onDone }: { cfg: Cfg; onDone: () => void }) {
  const [dob, setDob] = useState("");
  const [err, setErr] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true); setErr("");
    const ref = new URLSearchParams(window.location.search).get("ref") ?? "";
    const r = await fetch("/api/age-gate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dob, ref }) });
    const j = await r.json();
    setBusy(false);
    if (r.ok) { onDone(); return; }
    if (j.error === "under_age") setBlocked(true);
    setErr(j.message ?? "Something went wrong.");
  }

  if (blocked) {
    return (
      <div className="card">
        <h2>Sorry, you can't play</h2>
        <p>{err}</p>
        <a href="https://www.begambleaware.org" className="btn ghost" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>Leave</a>
      </div>
    );
  }
  return (
    <div className="card">
      <h2>Before you play</h2>
      <p className="muted">This game is for people aged {cfg.minAge} or over. Enter your date of birth. We check it and don't store it.</p>
      <label htmlFor="dob">Date of birth</label>
      <input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} max={new Date().toISOString().slice(0, 10)} />
      {err && <div className="err">{err}</div>}
      <div style={{ height: 12 }} />
      <button className="btn" disabled={!dob || busy} onClick={submit}>Continue</button>
    </div>
  );
}

function Play({ cfg, player, setPlayer }: { cfg: Cfg; player: Player; setPlayer: (p: Player) => void }) {
  const last = player.today.at(-1);
  const symById = useRef(new Map(cfg.odds.symbols.map((s) => [s.id, s]))).current;
  const [shown, setShown] = useState<string[]>(last ? last.symbols : ["cherry", "bell", "star"]);
  const [spinning, setSpinning] = useState<boolean[]>([false, false, false]);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [showHelp, setShowHelp] = useState(true);
  const [showOdds, setShowOdds] = useState(false);
  const [fresh, setFresh] = useState(false); // a spin happened in this visit
  const busy = spinning.some(Boolean);

  async function spin() {
    setErr(""); setMsg(""); setFresh(false);
    setSpinning([true, true, true]);
    const ids = cfg.odds.symbols.map((s) => s.id);
    const timer = setInterval(() => setShown((cur) => cur.map((c, i) => (spinning[i] === false ? c : ids[Math.floor(Math.random() * ids.length)]))), 80);
    const [r] = await Promise.all([
      fetch("/api/spin", { method: "POST" }).then(async (x) => ({ ok: x.ok, status: x.status, j: await x.json() })),
      new Promise((res) => setTimeout(res, 900)),
    ]);
    clearInterval(timer);
    if (!r.ok) {
      setSpinning([false, false, false]);
      setErr(r.j.message ?? "Something went wrong.");
      if (r.status === 429 || r.status === 401) {
        const s = await fetch("/api/state").then((x) => x.json());
        if (s.player) setPlayer(s.player);
      }
      return;
    }
    const res = r.j.result as { symbols: string[]; outcome: string; points: number; isBonus: boolean };
    // stop the reels one at a time
    for (let i = 0; i < 3; i++) {
      await new Promise((x) => setTimeout(x, 250));
      setShown((cur) => cur.map((c, k) => (k === i ? res.symbols[i] : c)));
      setSpinning((cur) => cur.map((c, k) => (k === i ? false : c)));
    }
    setShown(res.symbols);
    setMsg(res.outcome === "triple" ? `Triple! +${res.points} points` : res.outcome === "pair" ? `Pair! +${res.points} points` : `+${res.points} points`);
    setPlayer(r.j.state);
    setFresh(true);
  }

  const left = player.spins.remaining;
  const resetTxt = new Date(player.spins.resetsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <>
      {showHelp && (
        <div className="card banner">
          <p style={{ margin: 0 }}><b>How it works:</b> spin up to {player.spins.perDay} times a day. Every symbol you land joins your collection, and points build your weekly tier.</p>
          <button aria-label="Dismiss" onClick={() => { setShowHelp(false); track("explainer_dismissed"); }}>✕</button>
        </div>
      )}

      <div className="card">
        <div className="reels" aria-live="polite">
          {shown.map((id, i) => (
            <div key={i} className={"reel" + (spinning[i] ? " spinning" : "")} aria-label={symById.get(id)?.name}>{symById.get(id)?.icon ?? "❔"}</div>
          ))}
        </div>
        <div className="outcome">{msg}</div>
        <p className="muted" style={{ textAlign: "center" }}>
          {left > 0 ? <>{left} spin{left === 1 ? "" : "s"} left today{player.spins.bonusRemaining > 0 && <> (incl. {player.spins.bonusRemaining} bonus)</>}</> : <>All spins used. New spins at {resetTxt}.</>}
        </p>
        <button className="btn" disabled={busy || left <= 0} onClick={spin}>{busy ? "Spinning…" : left > 0 ? "Spin" : "Come back tomorrow"}</button>
        {err && <div className="err">{err}</div>}
        <p className="muted" style={{ textAlign: "center", marginBottom: 0 }}>
          <button className="pill" onClick={() => { setShowOdds(!showOdds); if (!showOdds) track("odds_viewed"); }} style={{ background: "none", cursor: "pointer" }}>
            {showOdds ? "Hide odds" : "Show odds"}
          </button>
        </p>
        {showOdds && (
          <div style={{ marginTop: 12 }}>
            <table>
              <thead><tr><th>Symbol</th><th>Chance per reel</th><th>Points</th></tr></thead>
              <tbody>
                {cfg.odds.symbols.map((s) => (<tr key={s.id}><td>{s.icon} {s.name} <span className="muted">({s.rarity})</span></td><td>{pct(s.chancePerReel)}</td><td>{s.points}</td></tr>))}
              </tbody>
            </table>
            <p className="muted">
              Each reel is an independent random draw. Pair (exactly two the same): {pct(cfg.odds.pair)} of spins, points ×{cfg.odds.multipliers.pair}. Triple: {pct(cfg.odds.triple)}, points ×{cfg.odds.multipliers.triple}. Nothing else changes the odds.
            </p>
          </div>
        )}
      </div>

      {(fresh || left === 0) && !player.emailSaved && <EmailCard onSaved={() => setPlayer({ ...player, emailSaved: true })} />}
      {(fresh || left === 0) && cfg.partnerOffer && <Offer offer={cfg.partnerOffer} />}
    </>
  );
}

function EmailCard({ onSaved }: { onSaved: () => void }) {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState("");
  async function save() {
    setErr("");
    const r = await fetch("/api/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, consent }) });
    const j = await r.json();
    if (r.ok) onSaved(); else setErr(j.message ?? "Something went wrong.");
  }
  return (
    <div className="card">
      <h2>Save your collection</h2>
      <p className="muted">Add your email to keep your symbols safe and get a reminder when your spins are ready.</p>
      <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email address" />
      <label style={{ display: "flex", gap: 8, alignItems: "start" }}>
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3 }} />
        <span>Yes, send me a reminder when my daily spins are ready. I can unsubscribe at any time.</span>
      </label>
      {err && <div className="err">{err}</div>}
      <div style={{ height: 10 }} />
      <button className="btn ghost" onClick={save}>Save</button>
    </div>
  );
}

function Offer({ offer }: { offer: NonNullable<Cfg["partnerOffer"]> }) {
  const [region, setRegion] = useState(offer.regions[0]);
  return (
    <div className="card offer">
      <span className="pill">Partner offer · Advertisement</span>
      <h2 style={{ marginTop: 10 }}>{offer.headline}</h2>
      <p className="muted"><b>{offer.sponsor}</b>. {offer.body}</p>
      <label htmlFor="region">Offers shown for</label>
      <select id="region" value={region} onChange={(e) => setRegion(e.target.value)}>
        {offer.regions.map((r) => <option key={r}>{r}</option>)}
      </select>
      <div style={{ height: 10 }} />
      <a className="btn" style={{ display: "block", textAlign: "center", textDecoration: "none" }} href={offer.href} target="_blank" rel="sponsored noopener noreferrer" onClick={() => track("offer_clicked", { region })}>{offer.cta}</a>
      <p className="muted" style={{ marginBottom: 0 }}>{offer.disclosure}</p>
    </div>
  );
}

function Collection({ cfg, player }: { cfg: Cfg; player: Player }) {
  const owned = cfg.odds.symbols.filter((s) => (player.collection[s.id] ?? 0) > 0).length;
  return (
    <div className="card">
      <h2>Your collection</h2>
      <p className="muted">{owned} of {cfg.odds.symbols.length} symbols found.</p>
      <div className="grid">
        {cfg.odds.symbols.map((s) => {
          const n = player.collection[s.id] ?? 0;
          return (
            <div key={s.id} className={"sym" + (n === 0 ? " locked" : "")}>
              <div className="i">{s.icon}</div>
              <div>{s.name}</div>
              <div className="muted">{n === 0 ? "Not found yet" : `×${n}`}</div>
              <div className="pill">{s.rarity}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Tier({ cfg, player }: { cfg: Cfg; player: Player }) {
  const { week } = player;
  const span = week.nextTier ? week.nextTier.minPoints - week.tier.minPoints : 1;
  const into = week.points - week.tier.minPoints;
  const width = week.nextTier ? Math.min(100, Math.round((into / span) * 100)) : 100;
  return (
    <div className="card">
      <h2>This week: {week.tier.name}</h2>
      <p className="muted">{week.points} points this week. {week.nextTier ? `${week.pointsToNext} more for ${week.nextTier.name}.` : "You've reached the top tier."}</p>
      <div className="bar" role="progressbar" aria-valuenow={width} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${width}%` }} /></div>
      <table style={{ marginTop: 14 }}>
        <tbody>{cfg.tiers.map((t) => (<tr key={t.id}><td>{t.id === week.tier.id ? "➡️ " : ""}{t.name}</td><td className="muted">{t.minPoints}+ points</td></tr>))}</tbody>
      </table>
      <p className="muted">Tiers reset every Monday for a fresh start. Missing a day never costs you anything you've already earned.</p>
    </div>
  );
}

function Invite({ cfg, player }: { cfg: Cfg; player: Player }) {
  const [copied, setCopied] = useState(false);
  const link = typeof window === "undefined" ? "" : `${window.location.origin}/?ref=${player.inviteCode}`;
  async function share() {
    track("invite_copied");
    if (navigator.share) { try { await navigator.share({ title: "Daily Reel", text: "Three free spins a day. 18+ only.", url: link }); return; } catch {} }
    await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="card">
      <h2>Invite a friend</h2>
      <p>When a friend aged {cfg.minAge}+ joins through your link and takes their first spin, you get <b>1 bonus spin</b>. Up to {cfg.bonusSpinsPerWeekCap} bonus spins a week.</p>
      <input readOnly value={link} aria-label="Your invite link" onFocus={(e) => e.currentTarget.select()} />
      <div style={{ height: 10 }} />
      <button className="btn" onClick={share}>{copied ? "Copied!" : "Share link"}</button>
      <p className="muted">Only share with people aged {cfg.minAge} or over.</p>
    </div>
  );
}
