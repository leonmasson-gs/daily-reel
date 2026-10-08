"use client";

import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from "react";
import { Glyph } from "./Glyph";

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
type SpinResult = { symbols: string[]; outcome: "triple" | "pair" | "none"; points: number; isBonus: boolean };

const pct = (n: number) => (n * 100 < 1 ? (n * 100).toFixed(2) : (n * 100).toFixed(1)) + "%";
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const track = (name: string, extra?: object) =>
  fetch("/api/event", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, ...extra }) }).catch(() => {});

/* ------------------------------------------------------------------ */

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

  if (!cfg || player === undefined) return <main className="app"><p className="muted small">Loading…</p></main>;

  const tabs: { k: Tab; label: string; icon: React.ReactNode }[] = [
    { k: "play", label: "Play", icon: <path d="M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm4 4v8m3-8v8m3-8v8" /> },
    { k: "collection", label: "Collection", icon: <path d="M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 0h7v7h-7z" /> },
    { k: "tier", label: "Weekly tier", icon: <path d="M4 20V13m5 7V9m5 11V5m5 15V11" /> },
    { k: "invite", label: "Invite", icon: <path d="M12 3v4m0 0a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm-7 14a7 7 0 0 1 14 0" /> },
  ];

  return (
    <main className="app">
      <header className="top">
        <h1 className="brand"><i aria-hidden />{cfg.copy.title}</h1>
      </header>

      {player === null ? (
        <AgeGate cfg={cfg} onDone={refresh} />
      ) : (
        <>
          <button className="meter" onClick={() => { setTab("tier"); track("tier_viewed"); }} aria-label="Open weekly tier">
            <div className="row1">
              <b>{player.week.tier.name}</b>
              <span className="muted tnum">
                {player.week.nextTier ? `${player.week.points} of ${player.week.nextTier.minPoints} points to ${player.week.nextTier.name}` : `${player.week.points} points, top tier`}
              </span>
            </div>
            <div className="bar"><div style={{ width: `${tierPct(player)}%` }} /></div>
          </button>

          {tab === "play" && <Play cfg={cfg} player={player} setPlayer={setPlayer} />}
          {tab === "collection" && <Collection cfg={cfg} player={player} />}
          {tab === "tier" && <Tier cfg={cfg} player={player} />}
          {tab === "invite" && <Invite cfg={cfg} player={player} />}

          <nav className="nav" aria-label="Main"><div className="in">
            {tabs.map((t) => (
              <button key={t.k} aria-current={tab === t.k ? "page" : undefined} onClick={() => { setTab(t.k); if (t.k === "tier") track("tier_viewed"); }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{t.icon}</svg>
                {t.label}
              </button>
            ))}
          </div></nav>
        </>
      )}

      <p className="muted small foot">
        {cfg.copy.footer} <a href="https://www.begambleaware.org" target="_blank" rel="noopener noreferrer">BeGambleAware.org</a>
      </p>
    </main>
  );
}

function tierPct(p: Player) {
  const { week } = p;
  if (!week.nextTier) return 100;
  const span = week.nextTier.minPoints - week.tier.minPoints;
  return Math.max(2, Math.min(100, Math.round(((week.points - week.tier.minPoints) / span) * 100)));
}

/* ------------------------------------------------------------------ */

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
      <div className="panel">
        <h2>You can't play this game</h2>
        <p>{err}</p>
        <a href="https://www.begambleaware.org" className="btn quiet">Leave</a>
      </div>
    );
  }
  return (
    <div className="panel">
      <h2>Confirm your age</h2>
      <p>{cfg.copy.tagline}</p>
      <p className="muted">You must be {cfg.minAge} or over. We check your date of birth and do not store it.</p>
      <label className="field" htmlFor="dob">Date of birth</label>
      <input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} max={new Date().toISOString().slice(0, 10)} />
      {err && <div className="err" role="alert">{err}</div>}
      <div style={{ height: 14 }} />
      <button className="btn" disabled={!dob || busy} onClick={submit}>Continue</button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Reel: a vertical strip that spins, then decelerates onto the drawn symbol.
   Only the drawn symbol is ever visible in the window, so there are no neighbouring symbols
   that could read as a near miss. */

type ReelHandle = { spin: () => void; stop: (id: string, ms: number) => Promise<void>; cancel: (id: string) => void };
type ReelMode = { kind: "idle" | "spin" | "stop"; strip: string[]; ms: number };

function Reel({ ref, cfg, initial, hit, settle }: { ref: Ref<ReelHandle>; cfg: Cfg; initial: string; hit: boolean; settle: boolean }) {
  const ids = cfg.odds.symbols.map((s) => s.id);
  const byId = useRef(new Map(cfg.odds.symbols.map((s) => [s.id, s]))).current;
  const [mode, setMode] = useState<ReelMode>({ kind: "idle", strip: [initial], ms: 0 });
  const stripEl = useRef<HTMLDivElement>(null);
  const winEl = useRef<HTMLDivElement>(null);
  const anim = useRef<Animation | null>(null);
  const done = useRef<(() => void) | null>(null);

  const shuffled = () => [...ids].sort(() => Math.random() - 0.5);

  useImperativeHandle(ref, () => ({
    spin() {
      const loop = shuffled();
      setMode({ kind: "spin", strip: [...loop, loop[0]], ms: 0 });
    },
    stop(id, ms) {
      return new Promise<void>((resolve) => {
        done.current = resolve;
        const fillers: string[] = [];
        for (let i = 0; i < 18; i++) fillers.push(ids[Math.floor(Math.random() * ids.length)]);
        setMode({ kind: "stop", strip: [id, ...fillers], ms });
      });
    },
    cancel(id) { setMode({ kind: "idle", strip: [id], ms: 0 }); },
  }), [ids]);

  useLayoutEffect(() => {
    const el = stripEl.current;
    const H = winEl.current?.clientHeight ?? 108;
    anim.current?.cancel();
    anim.current = null;
    if (!el) return;

    if (mode.kind === "spin" && !reducedMotion()) {
      const n = mode.strip.length - 1;
      anim.current = el.animate(
        [{ transform: "translateY(0)", filter: "blur(2.5px)" }, { transform: `translateY(${-n * H}px)`, filter: "blur(2.5px)" }],
        { duration: 480, iterations: Infinity, easing: "linear" },
      );
    }
    if (mode.kind === "stop") {
      const finish = () => {
        setMode((m) => ({ kind: "idle", strip: [m.strip[0]], ms: 0 }));
        done.current?.(); done.current = null;
      };
      if (reducedMotion()) { finish(); return; }
      const n = mode.strip.length - 1;
      const a = el.animate(
        [
          { transform: `translateY(${-n * H}px)`, filter: "blur(2.5px)", offset: 0 },
          { transform: `translateY(${-n * H * 0.12}px)`, filter: "blur(1.5px)", offset: 0.7 },
          { transform: "translateY(0)", filter: "blur(0px)", offset: 1 },
        ],
        { duration: mode.ms, easing: "cubic-bezier(.15,.7,.2,1)", fill: "forwards" },
      );
      a.onfinish = finish;
      anim.current = a;
    }
  }, [mode]);

  const first = byId.get(mode.strip[0]);
  return (
    <div ref={winEl} className={"reel-win" + (hit ? " hit" : "") + (settle ? " settle" : "")} aria-label={first?.name}>
      <div ref={stripEl} className="strip">
        {mode.strip.map((id, i) => {
          const s = byId.get(id);
          return <div className="cell" key={i}>{s && <Glyph id={s.id} rarity={s.rarity} title={s.name} />}</div>;
        })}
      </div>
    </div>
  );
}

function useCountUp(target: number, key: number) {
  const [v, setV] = useState(target);
  useEffect(() => {
    if (reducedMotion() || target === 0) { setV(target); return; }
    let raf = 0; const t0 = performance.now(); const dur = 700;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, key]);
  return v;
}

function Play({ cfg, player, setPlayer }: { cfg: Cfg; player: Player; setPlayer: (p: Player) => void }) {
  const last = player.today.at(-1);
  const start = last ? last.symbols : ["cherry", "lemon", "star"];
  const symById = useRef(new Map(cfg.odds.symbols.map((s) => [s.id, s]))).current;
  const reels = [useRef<ReelHandle>(null), useRef<ReelHandle>(null), useRef<ReelHandle>(null)];
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState<string[]>(start);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [hits, setHits] = useState<boolean[]>([false, false, false]);
  const [settled, setSettled] = useState<boolean[]>([false, false, false]);
  const [runKey, setRunKey] = useState(0);
  const [err, setErr] = useState("");
  const [showOdds, setShowOdds] = useState(false);
  const [fresh, setFresh] = useState(false);
  const pts = useCountUp(result?.points ?? 0, runKey);

  async function spin() {
    setErr(""); setResult(null); setHits([false, false, false]); setSettled([false, false, false]); setFresh(false);
    setBusy(true);
    reels.forEach((r) => r.current?.spin());
    const t0 = performance.now();
    const res = await fetch("/api/spin", { method: "POST" }).then(async (x) => ({ ok: x.ok, status: x.status, j: await x.json() })).catch(() => null);

    if (!res || !res.ok) {
      reels.forEach((r, i) => r.current?.cancel(shown[i]));
      setErr(res?.j?.message ?? "Could not reach the game. Check your connection and try again.");
      if (res && (res.status === 429 || res.status === 401)) {
        const s = await fetch("/api/state").then((x) => x.json());
        if (s.player) setPlayer(s.player);
      }
      setBusy(false);
      return;
    }

    const out = { ...(res.j.result as Omit<SpinResult, "isBonus">), isBonus: res.j.result.isBonus } as SpinResult;
    await sleep(Math.max(0, 550 - (performance.now() - t0)));
    await Promise.all(
      reels.map((r, i) =>
        sleep(i * 320).then(async () => {
          await r.current?.stop(out.symbols[i], 900 + i * 220);
          setSettled((s) => s.map((v, k) => (k === i ? true : v)));
        }),
      ),
    );
    setShown(out.symbols);
    const counts = new Map<string, number>();
    out.symbols.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));
    setHits(out.symbols.map((id) => out.outcome !== "none" && (counts.get(id) ?? 0) >= 2));
    setResult(out); setRunKey((k) => k + 1);
    setPlayer(res.j.state);
    setFresh(true);
    setBusy(false);
  }

  const left = player.spins.remaining;
  const resetTxt = new Date(player.spins.resetsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const baseUsed = player.spins.perDay - player.spins.baseRemaining;
  const bonusLeft = player.spins.bonusRemaining;

  const whatText = result
    ? result.outcome === "triple"
      ? `Triple match: ${symById.get(result.symbols[0])?.name}`
      : result.outcome === "pair"
        ? `Matched pair: ${symById.get(result.symbols.find((id, i, a) => a.indexOf(id) !== i)!)?.name}`
        : "No match"
    : "";
  const mult = result ? (result.outcome === "triple" ? cfg.odds.multipliers.triple : result.outcome === "pair" ? cfg.odds.multipliers.pair : 1) : 1;

  return (
    <>
      <section className="machine" aria-label="Reel">
        <div className="reels">
          {[0, 1, 2].map((i) => (
            <Reel key={i} ref={reels[i]} cfg={cfg} initial={start[i]} hit={hits[i]} settle={settled[i] && !hits[i]} />
          ))}
        </div>

        <div className="result" aria-live="polite">
          {result ? (
            <>
              <div className="what">{whatText}</div>
              <div className="pts tnum">+{pts} points</div>
              {mult > 1 && <div className="hint small">Symbol points multiplied by {mult}</div>}
            </>
          ) : busy ? (
            <div className="hint small">Spinning</div>
          ) : last ? (
            <div className="hint small">Your last spin today</div>
          ) : (
            <div className="hint small">Match two or three symbols to multiply your points.</div>
          )}
        </div>

        <div className="pips" aria-label={`${left} spins left today`}>
          {Array.from({ length: player.spins.perDay }, (_, i) => <span key={i} className={"pip" + (i >= baseUsed ? " on" : "")} />)}
          {Array.from({ length: bonusLeft }, (_, i) => <span key={"b" + i} className="pip bonus on" />)}
          <span className="label tnum">{left > 0 ? `${left} spin${left === 1 ? "" : "s"} left today` : `All spins used. Back at ${resetTxt}`}</span>
        </div>

        <button className="btn" disabled={busy || left <= 0} onClick={spin}>{busy ? "Spinning" : left > 0 ? "Spin" : "Back tomorrow"}</button>
        {err && <div className="err" role="alert">{err}</div>}
      </section>

      <div className="section" style={{ paddingBottom: 6 }}>
        <button className="link" onClick={() => { setShowOdds(!showOdds); if (!showOdds) track("odds_viewed"); }} aria-expanded={showOdds}>
          {showOdds ? "Hide the odds" : "See the odds"}
        </button>
        {showOdds && (
          <div>
            <table className="odds">
              <thead><tr><th /><th>Symbol</th><th>Chance per reel</th><th>Points</th></tr></thead>
              <tbody>
                {cfg.odds.symbols.map((s) => (
                  <tr key={s.id}><td className="g"><Glyph id={s.id} rarity={s.rarity} title={s.name} /></td><td>{s.name}</td><td className="tnum">{pct(s.chancePerReel)}</td><td className="tnum">{s.points}</td></tr>
                ))}
              </tbody>
            </table>
            <p className="small muted">
              Each reel is an independent random draw made on our server. Per spin: {pct(cfg.odds.pair)} chance of exactly one pair (points x{cfg.odds.multipliers.pair}), {pct(cfg.odds.triple)} chance of three of a kind (points x{cfg.odds.multipliers.triple}), {pct(cfg.odds.none)} no match. Nothing else changes the odds.
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
    <div className="panel">
      <h3>Keep your collection</h3>
      <p className="small muted" style={{ fontFamily: "var(--sans)" }}>Save your symbols to an email address and get a reminder when your daily spins are ready.</p>
      <label className="field" htmlFor="em">Email address</label>
      <input id="em" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      <label className="check">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>Send me a reminder when my daily spins are ready. I can unsubscribe at any time.</span>
      </label>
      {err && <div className="err" role="alert">{err}</div>}
      <button className="btn quiet" onClick={save}>Save my collection</button>
    </div>
  );
}

function Offer({ offer }: { offer: NonNullable<Cfg["partnerOffer"]> }) {
  const [region, setRegion] = useState(offer.regions[0]);
  return (
    <div className="offer">
      <span className="tag">Partner offer · Advertisement</span>
      <h3 style={{ marginTop: 10 }}>{offer.headline}</h3>
      <p className="small muted" style={{ fontFamily: "var(--sans)" }}><b style={{ color: "var(--paper)" }}>{offer.sponsor}</b>. {offer.body}</p>
      <label className="field" htmlFor="region">Offers shown for</label>
      <select id="region" value={region} onChange={(e) => setRegion(e.target.value)}>
        {offer.regions.map((r) => <option key={r}>{r}</option>)}
      </select>
      <div style={{ height: 12 }} />
      <a className="btn quiet" href={offer.href} target="_blank" rel="sponsored noopener noreferrer" onClick={() => track("offer_clicked", { region })}>{offer.cta}</a>
      <p className="small muted" style={{ fontFamily: "var(--sans)", marginBottom: 0 }}>{offer.disclosure}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Collection({ cfg, player }: { cfg: Cfg; player: Player }) {
  const owned = cfg.odds.symbols.filter((s) => (player.collection[s.id] ?? 0) > 0).length;
  return (
    <div className="section">
      <h2>Collection</h2>
      <p className="muted">{owned} of {cfg.odds.symbols.length} symbols found. Every symbol you land is added here.</p>
      <div className="coll">
        {cfg.odds.symbols.map((s) => {
          const n = player.collection[s.id] ?? 0;
          return (
            <div key={s.id} className={"sym" + (n === 0 ? " locked" : "")}>
              <Glyph id={s.id} rarity={s.rarity} title={s.name} />
              <div className="nm">{s.name}</div>
              <div className="n tnum">{n === 0 ? "–" : n}</div>
              <div className="small muted">{s.rarity}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Tier({ cfg, player }: { cfg: Cfg; player: Player }) {
  const { week } = player;
  return (
    <div className="section">
      <h2>{week.tier.name} this week</h2>
      <p className="muted tnum">
        {week.points} points since Monday.{" "}
        {week.nextTier ? `${week.pointsToNext} more to reach ${week.nextTier.name}.` : "You have reached the top tier."}
      </p>
      <ul className="ladder">
        {[...cfg.tiers].reverse().map((t) => {
          const state = t.id === week.tier.id ? "now" : week.points >= t.minPoints ? "done" : "";
          return (
            <li key={t.id} className={state}>
              <span>{t.name}{state === "now" && <span className="here">You are here</span>}</span>
              <span className="tnum">from {t.minPoints} points</span>
            </li>
          );
        })}
      </ul>
      <p className="small muted" style={{ fontFamily: "var(--sans)" }}>Tiers start again every Monday. Missing a day never removes points you have already earned.</p>
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
    <div className="section">
      <h2>Invite a friend</h2>
      <p>When a friend aged {cfg.minAge} or over joins with your link and takes their first spin, you get one bonus spin. The limit is {cfg.bonusSpinsPerWeekCap} bonus spins a week.</p>
      <label className="field" htmlFor="lnk">Your invite link</label>
      <input id="lnk" type="text" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
      <div style={{ height: 12 }} />
      <button className="btn" onClick={share}>{copied ? "Link copied" : "Share your link"}</button>
      <p className="small muted" style={{ fontFamily: "var(--sans)" }}>Only share it with people aged {cfg.minAge} or over.</p>
    </div>
  );
}
