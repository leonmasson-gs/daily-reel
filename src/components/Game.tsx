"use client";

import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type Ref } from "react";
import { Glyph } from "./Glyph";
import { GrandDialog, Intro, RecapDialog, TierUp, type Recap as RecapData } from "./Overlays";
import { Friends } from "./Friends";
import { RewardArt } from "./RewardArt";
import { advertDisclosure } from "@/lib/advert";
import { SkinContext } from "./SkinContext";
import { BonusRound } from "./Bonus";
import { SKINS, defaultSkinId, skinById, type Skin } from "@/lib/skins";
import { ShareDialog } from "./Share";
import { ResponsibleFooter, type ResponsibleCfg } from "./ResponsibleFooter";
import { RewardsScreen, RewardsTeaser } from "./Rewards";
import type { RewardsCfg } from "@/lib/rewards";
import { KEYS, canVibrate, playSound, readFlag, vibrate, writeFlag, type SoundKind } from "@/lib/fx";

type Sym = { id: string; name: string; icon: string; rarity: string; points: number; chancePerReel: number };
type Cfg = {
  copy: { title: string; tagline: string; footer: string };
  minAge: number;
  minAgeUS: number;
  skin: { default: string; allowSwitch: boolean };
  featured: { multiplier: number };
  bonus: { skipPoints: number; bands: { min: number; label: string; points: number }[] };
  reset: { hour: number; timeZone: string; label: string };
  trophies: { needed: number; tierLabel: string; note: string };
  tiers: { id: string; name: string; minPoints: number }[];
  sets: { id: string; name: string; symbols: string[]; points: number }[];
  rewards: RewardsCfg;
  responsible: ResponsibleCfg;
  bonusSpinsPerWeekCap: number;
  partnerOffer: null | {
    sponsor: string; headline: string; body: string; cta: string; href: string;
  };
  odds: { symbols: Sym[]; triple: number; pair: number; none: number; multipliers: { pair: number; triple: number } };
};
type Player = {
  inviteCode: string;
  featured: { id: string; multiplier: number };
  emailSaved: boolean;
  rewardsNotify: boolean;
  rewards: { weeksRegular: number; weeksFull: number };
  spins: { perDay: number; remaining: number; baseRemaining: number; bonusRemaining: number; signupBonusRemaining: number; bonusCapPerWeek: number; resetsAt: string };
  today: { symbols: string[]; outcome: string; points: number; is_bonus: boolean }[];
  collection: Record<string, number>;
  sets: { id: string; name: string; symbols: string[]; points: number; found: number; total: number; complete: boolean }[];
  week: { start: string; today: string; resetsAt: string; trophies: number; trophiesNeeded: number; grand: boolean; daysPlayed: string[]; points: number; tier: { id: string; name: string; minPoints: number }; nextTier: { name: string; minPoints: number } | null; pointsToNext: number };
};
type Tab = "play" | "collection" | "tier" | "friends" | "rewards";
type SpinResult = { symbols: string[]; outcome: "triple" | "pair" | "none"; points: number; isBonus: boolean; featuredHits?: number };

const pct = (n: number) => (n * 100 < 1 ? (n * 100).toFixed(2) : (n * 100).toFixed(1)) + "%";
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const track = (name: string, extra?: object) =>
  fetch("/api/event", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, ...extra }) }).catch(() => {});

/* ------------------------------------------------------------------ */

/** The look-only changes a skin makes to the settings: its name and tagline, and what the symbols are called. */
function applySkin(cfg: Cfg, skin: Skin): Cfg {
  return {
    ...cfg,
    copy: { ...cfg.copy, title: skin.title, tagline: skin.tagline },
    odds: { ...cfg.odds, symbols: cfg.odds.symbols.map((s) => ({ ...s, name: skin.symbols[s.id]?.name ?? s.name })) },
  };
}

function BrandMark({ skin }: { skin: Skin }) {
  if (skin.brand.parts) return <><span className="b1">{skin.brand.parts[0]}</span><span className="b2">{skin.brand.parts[1]}</span></>;
  return <><i aria-hidden />{skin.brand.name}</>;
}

export default function Game() {
  const [cfgRaw, setCfg] = useState<Cfg | null>(null);
  const [skinId, setSkinId] = useState<string>(defaultSkinId());
  const skin = skinById(skinId);
  // The skin changes how things look and what the symbols are called. It never changes a rule, an odd or a compliance line.
  const cfg = useMemo(() => (cfgRaw ? applySkin(cfgRaw, skin) : null), [cfgRaw, skin]);
  function chooseSkin(id: string) {
    setSkinId(id);
    document.documentElement.dataset.skin = id;
    try { window.localStorage.setItem("dr_skin", id); } catch { /* not saved */ }
    // If the address names a skin, keep it in step with what was chosen, so a reload does not undo the choice.
    const url = new URL(window.location.href);
    if (url.searchParams.has("skin")) { url.searchParams.set("skin", id); window.history.replaceState(window.history.state, "", url); }
  }
  useEffect(() => {
    // The inline script in the layout has already set the attribute before paint. Here we just read the same choice.
    const fromPage = document.documentElement.dataset.skin;
    if (fromPage && SKINS[fromPage]) setSkinId(fromPage);
  }, []);
  const [player, setPlayer] = useState<Player | null | undefined>(undefined); // undefined = loading
  const [tab, setTab] = useState<Tab>("play");
  const [sound, setSound] = useState(false);
  const [haptics, setHaptics] = useState(true);
  const [vibrates, setVibrates] = useState(false);
  const [intro, setIntro] = useState(false);
  const [recap, setRecap] = useState<RecapData | null>(null);
  const [tierUp, setTierUp] = useState<{ from: string; to: string } | null>(null);
  const [sharing, setSharing] = useState(false);
  const [region, setRegionState] = useState("Other");
  const [minAge, setMinAge] = useState(18);
  const [grandUp, setGrandUp] = useState(false);
  const [bonus, setBonus] = useState(false);
  function setRegion(r: string) {
    setRegionState(r);
    try { window.localStorage.setItem("dr_region", r); } catch { /* not saved */ }
  }
  async function notifyRewards(): Promise<string | null> {
    const r = await fetch("/api/rewards/notify", { method: "POST" });
    if (r.ok) { setPlayer((p) => (p ? { ...p, rewardsNotify: true } : p)); return null; }
    return (await r.json().catch(() => ({}))).message ?? "Could not save that. Try again.";
  }

  const [loadError, setLoadError] = useState(false);

  /** Re-reads the player. Returns whether there is one, so the age check can tell if the cookie really stuck. */
  const refresh = useCallback(async (): Promise<boolean> => {
    try {
      const r = await fetch("/api/state");
      if (!r.ok) throw new Error("state");
      const j = await r.json();
      setPlayer(j.player);
      return Boolean(j.player);
    } catch {
      return false;
    }
  }, []);

  /** First load: settings and player together. If either fails, say so and offer a retry instead of loading forever. */
  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const get = async (url: string) => { const r = await fetch(url); if (!r.ok) throw new Error(url); return r.json(); };
      const [c, s] = await Promise.all([get("/api/config"), get("/api/state")]);
      setCfg(c);
      setPlayer(s.player);
    } catch {
      setLoadError(true);
    }
  }, []);

  // Each screen gets its own history entry (#rewards, #tier, ...) so the Back button and shared links work.
  const goTab = useCallback((t: Tab) => {
    setTab(t);
    window.scrollTo({ top: 0 });
    const url = window.location.pathname + window.location.search + (t === "play" ? "" : `#${t}`);
    if (url !== window.location.pathname + window.location.search + window.location.hash) window.history.pushState({ tab: t }, "", url);
  }, []);
  useEffect(() => {
    const fromHash = (): Tab => {
      let h = window.location.hash.slice(1);
      if (h === "invite") h = "friends"; // the Invite screen is now Friends
      return (["collection", "tier", "friends", "rewards"] as string[]).includes(h) ? (h as Tab) : "play";
    };
    setTab(fromHash());
    const onPop = () => { setTab(fromHash()); window.scrollTo({ top: 0 }); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    load();
    setSound(readFlag(KEYS.sound, false));
    setHaptics(readFlag(KEYS.haptics, true));
    setVibrates(canVibrate());
    fetch("/api/region").then((r) => r.json()).then((j) => {
      let saved: string | null = null;
      try { saved = window.localStorage.getItem("dr_region"); } catch { /* ignore */ }
      setRegionState(saved ?? j.region ?? "Other");
      if (typeof j.minAge === "number") setMinAge(j.minAge);
    }).catch(() => {});
  }, [load]);

  // First-run intro for new players, otherwise last week's recap if there is one.
  const hasPlayer = Boolean(player);
  useEffect(() => {
    if (!hasPlayer) return;
    if (!readFlag(KEYS.intro, false)) { setIntro(true); return; }
    fetch("/api/recap").then((r) => r.json()).then((j) => { if (j.recap) { setRecap(j.recap); track("recap_viewed"); } });
  }, [hasPlayer]);

  const fx = useRef({ sound: false, haptics: true });
  fx.current = { sound, haptics };
  const feel = useRef({
    sound: (k: SoundKind) => { if (fx.current.sound) playSound(k); },
    buzz: (p: number | number[]) => { if (fx.current.haptics) vibrate(p); },
  }).current;

  function toggleSound() {
    const next = !sound; setSound(next); writeFlag(KEYS.sound, next);
    if (next) playSound("tick");
  }
  function toggleHaptics() {
    const next = !haptics; setHaptics(next); writeFlag(KEYS.haptics, next);
    if (next) vibrate(15);
  }
  function closeIntro(skipped: boolean) {
    writeFlag(KEYS.intro, true); setIntro(false);
    track(skipped ? "intro_skipped" : "intro_completed");
  }
  function closeRecap() {
    setRecap(null);
    fetch("/api/recap", { method: "POST" }).catch(() => {});
  }

  if (loadError && (!cfg || player === undefined)) {
    return (
      <main className="app">
        <div className="panel" role="alert">
          <h2>We could not load the game</h2>
          <p>Check your connection, then try again.</p>
          <button className="btn" onClick={load}>Try again</button>
        </div>
      </main>
    );
  }
  if (!cfg || player === undefined) return <main className="app"><p className="muted small" role="status">Loading…</p></main>;

  const tabs: { k: Tab; label: string; icon: React.ReactNode }[] = [
    { k: "play", label: "Play", icon: <path d="M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm4 4v8m3-8v8m3-8v8" /> },
    { k: "collection", label: "Collection", icon: <path d="M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 0h7v7h-7z" /> },
    { k: "tier", label: "Tier", icon: <path d="M4 20V13m5 7V9m5 11V5m5 15V11" /> },
    { k: "rewards", label: "Rewards", icon: <path d="M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7C10 3 6 3 7 6c.4 1.2 2.6 1.2 5 1zm0 0c2-4 6-4 5-1-.4 1.2-2.6 1.2-5 1z" /> },
    { k: "friends", label: "Friends", icon: <path d="M12 3v4m0 0a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm-7 14a7 7 0 0 1 14 0" /> },
  ];

  return (
    <SkinContext.Provider value={skin}>
    <main className="app">
      <header className="top">
        <div className="brandwrap">
          <h1 className="brand">
            {player ? (
              <button className="brandbtn" onClick={() => goTab("play")} aria-label={`${skin.title}. Go to the game`}><BrandMark skin={skin} /></button>
            ) : (<BrandMark skin={skin} />)}
          </h1>
          {skin.brand.eyebrow && <div className="eyebrow" aria-hidden>{skin.brand.eyebrow}</div>}
        </div>
        {player && (
          <div className="tools">
            <button className="iconbtn" aria-pressed={sound} aria-label={sound ? "Sound on. Turn off" : "Sound off. Turn on"} onClick={toggleSound}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4 9v6h4l5 4V5L8 9z" />{sound ? <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /> : <path d="M17 9l5 6m0-6l-5 6" />}
              </svg>
            </button>
            {vibrates && (
              <button className="iconbtn" aria-pressed={haptics} aria-label={haptics ? "Vibration on. Turn off" : "Vibration off. Turn on"} onClick={toggleHaptics}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="8" y="3" width="8" height="18" rx="2" />{haptics ? <path d="M4 8v8M20 8v8" /> : <path d="M3 3l18 18" />}
                </svg>
              </button>
            )}
          </div>
        )}
      </header>

      {player === null ? (
        <AgeGate cfg={cfg} minAge={minAge} onDone={refresh} />
      ) : (
        <>
          {tab !== "play" && (
            <button className="backbar" onClick={() => goTab("play")}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 5l-7 7 7 7" /></svg>
              Back to the game
            </button>
          )}
          <button className="meter" onClick={() => { goTab("tier"); track("tier_viewed"); }} aria-label="Open weekly tier">
            <div className="row1">
              <b>{player.week.tier.name}{player.week.grand && <span className="chip" style={{ marginLeft: 8 }}>{cfg.trophies.tierLabel}</span>}</b>
              <span className="muted tnum">
                {player.week.nextTier ? `${player.week.points} of ${player.week.nextTier.minPoints} points to ${player.week.nextTier.name}` : `${player.week.points} points, top tier`}
              </span>
            </div>
            <div className="bar"><div style={{ width: `${tierPct(player)}%` }} /></div>
          </button>

          {tab === "play" && <Play cfg={cfg} player={player} setPlayer={setPlayer} refresh={refresh} feel={feel} onTierUp={setTierUp} onShare={() => setSharing(true)} onGrand={() => setGrandUp(true)} onBonus={() => setBonus(true)} region={region} minAge={minAge} onOpenRewards={() => goTab("rewards")} onNotify={notifyRewards} />}
          {tab === "collection" && <Collection cfg={cfg} player={player} />}
          {tab === "tier" && <Tier cfg={cfg} player={player} onShare={() => setSharing(true)} />}
          {tab === "friends" && (
            <Friends symbols={cfg.odds.symbols} minAge={cfg.minAge} minAgeUS={cfg.minAgeUS} bonusCap={cfg.bonusSpinsPerWeekCap} inviteCode={player.inviteCode} />
          )}
          {tab === "rewards" && (
            <RewardsScreen
              rw={cfg.rewards} region={region} setRegion={setRegion} daysPlayed={player.week.daysPlayed.length} points={player.week.points}
              tiers={cfg.tiers} tierName={player.week.tier.name} weeks={player.rewards} trophies={player.week.trophies}
            />
          )}

          <nav className="nav" aria-label="Main"><div className="in">
            {tabs.map((t) => (
              <button key={t.k} aria-current={tab === t.k ? "page" : undefined} onClick={() => { goTab(t.k); if (t.k === "tier") track("tier_viewed"); }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{t.icon}</svg>
                {t.label}
              </button>
            ))}
          </div></nav>
        </>
      )}

      {cfg.skin.allowSwitch && (
        <div className="skinswitch" role="group" aria-label="Skin">
          <span className="small muted">Skin</span>
          {Object.values(SKINS).map((s) => (
            <button key={s.id} className="pillbtn" aria-pressed={skinId === s.id} onClick={() => chooseSkin(s.id)}>{s.label}</button>
          ))}
        </div>
      )}
      <ResponsibleFooter rg={cfg.responsible} region={region} />

      {sharing && player && (
        <ShareDialog
          onClose={() => setSharing(false)}
          data={{
            inviteCode: player.inviteCode,
            tierName: player.week.tier.name,
            points: player.week.points,
            daysPlayed: player.week.daysPlayed.length,
            trophies: player.week.trophies,
            found: cfg.odds.symbols.filter((x) => (player.collection[x.id] ?? 0) > 0).map((x) => x.id),
          }}
        />
      )}
      {!intro && !recap && !bonus && !tierUp && grandUp && player && (
        <GrandDialog trophies={player.week.trophies} onClose={() => setGrandUp(false)} />
      )}
      {bonus && !intro && !recap && player && (
        <BonusRound
          bands={cfg.bonus.bands} skipPoints={cfg.bonus.skipPoints} feel={feel}
          onDone={(r) => { setBonus(false); if (r) { setPlayer(r.state as Player); if (r.tierUp) setTierUp(r.tierUp); } }}
        />
      )}
      {intro && <Intro onDone={() => closeIntro(false)} onSkip={() => closeIntro(true)} />}
      {!intro && recap && <RecapDialog recap={recap} onClose={closeRecap} />}
      {!intro && !recap && !bonus && tierUp && player && (
        <TierUp from={tierUp.from} to={tierUp.to} pointsToNext={player.week.pointsToNext} nextName={player.week.nextTier?.name ?? null} onClose={() => setTierUp(null)} />
      )}
    </main>
    </SkinContext.Provider>
  );
}

function tierPct(p: Player) {
  const { week } = p;
  if (!week.nextTier) return 100;
  const span = week.nextTier.minPoints - week.tier.minPoints;
  return Math.max(2, Math.min(100, Math.round(((week.points - week.tier.minPoints) / span) * 100)));
}

/* ------------------------------------------------------------------ */

function AgeGate({ cfg, minAge, onDone }: { cfg: Cfg; minAge: number; onDone: () => Promise<boolean> }) {
  const [dob, setDob] = useState("");
  const [err, setErr] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [invited, setInvited] = useState(false);
  useEffect(() => { setInvited(Boolean(new URLSearchParams(window.location.search).get("ref"))); }, []);
  const oldest = new Date(Date.now() - 120 * 365.25 * 864e5).toISOString().slice(0, 10);

  async function submit() {
    setBusy(true); setErr("");
    const ref = new URLSearchParams(window.location.search).get("ref") ?? "";
    const r = await fetch("/api/age-gate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dob, ref }) });
    const j = await r.json();
    setBusy(false);
    if (r.ok) {
      const stuck = !(await onDone());
      if (stuck) setErr("This game needs cookies to remember your age check. Turn cookies on for this site, then try again.");
      return;
    }
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
      {invited && <p className="invite-note"><b>A friend invited you.</b> You get your own three free spins a day. Friends who invite each other can compare collections on a friends board. It shows only a random nickname, your tier and your symbols.</p>}
      <p>{cfg.copy.tagline}</p>
      <p className="muted">You must be {minAge} or over. We check your date of birth and do not store it.</p>
      <label className="field" htmlFor="dob">Date of birth</label>
      <input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} min={oldest} max={new Date().toISOString().slice(0, 10)} />
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
    <div ref={winEl} className={"reel-win" + (hit ? " hit" : "") + (settle ? " settle" : "")} role="img" aria-label={first?.name}>
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

function formatLeft(ms: number) {
  if (ms <= 0) return "a moment";
  const m = Math.ceil(ms / 60000);
  if (m < 2) return "under a minute";
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${String(m % 60).padStart(2, "0")}m` : `${m}m`;
}

/** Counts down to a moment and calls onDone as soon as it passes. */
function useCountdown(target: string, onDone: () => void) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);
  // Wake up at the exact moment, so the Spin button comes alive straight after the reset rather than at the next 15 second tick.
  useEffect(() => {
    const ms = new Date(target).getTime() - Date.now();
    if (ms <= 0 || ms > 2_000_000_000) return;
    const t = setTimeout(() => setNow(Date.now()), ms + 300);
    return () => clearTimeout(t);
  }, [target]);
  const left = new Date(target).getTime() - now;
  // Once the moment has passed, ask the server. If it has not moved on yet (the two clocks disagree slightly), ask
  // again quickly at first (1.5s, 1.5s, 3s) and then every 5 seconds, so the wait is never long.
  const tries = useRef(0);
  useEffect(() => { tries.current = 0; }, [target]);
  useEffect(() => {
    if (left > 0) return;
    onDone();
    const wait = [1500, 1500, 3000][tries.current] ?? 5000;
    tries.current += 1;
    const t = setTimeout(() => setNow(Date.now()), wait);
    return () => clearTimeout(t);
  }, [left, onDone]);
  return left;
}

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Seven dots, one for each day of the week (a week starts on Sunday evening). A plain tally: missed days are never marked as lost. */
function WeekStrip({ week }: { week: Player["week"] }) {
  const played = new Set(week.daysPlayed);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.parse(week.start) + i * 86400000).toISOString().slice(0, 10);
    const dow = new Date(d + "T00:00:00Z").getUTCDay();
    return { letter: DAY_LETTERS[dow], name: DAY_NAMES[dow], played: played.has(d), today: d === week.today };
  });
  return (
    <div className="week">
      <div>
        <b>This week</b>
        <div className="small muted tnum">{week.daysPlayed.length === 0 ? "No days played yet" : `${week.daysPlayed.length} of 7 days played`}</div>
      </div>
      <div className="days" role="img" aria-label={`Days played this week: ${week.daysPlayed.length} of 7`}>
        {days.map((d, i) => (
          <div key={i} className={"day" + (d.played ? " played" : "") + (d.today ? " today" : "")} title={`${d.name}${d.played ? ", played" : ""}`}>
            <i />{d.letter}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Three trophy slots. A trophy is earned for each triple match; three in a week reach the Grand tier (a preview). */
function Trophies({ week, grandLabel }: { week: Player["week"]; grandLabel: string }) {
  const n = Math.min(week.trophies, week.trophiesNeeded);
  return (
    <div className="trophyrow">
      <div className="slots" role="img" aria-label={`${week.trophies} of ${week.trophiesNeeded} trophies this week`}>
        {Array.from({ length: week.trophiesNeeded }, (_, i) => (
          <span key={i} className={i < n ? "slot on" : "slot"}><RewardArt kind="trophy" size={30} /></span>
        ))}
      </div>
      <div className="small tnum">
        <b>{week.trophies} of {week.trophiesNeeded} trophies</b>
        <span className="muted"> this week. {week.grand ? `${grandLabel} reached (a preview, nothing is awarded).` : `Match three symbols to earn one. Three reach the ${grandLabel}.`}</span>
      </div>
    </div>
  );
}

type Feel = { sound: (k: SoundKind) => void; buzz: (p: number | number[]) => void };

function Play({ cfg, player, setPlayer, refresh, feel, onTierUp, onShare, onGrand, onBonus, region, minAge, onOpenRewards, onNotify }: {
  cfg: Cfg; player: Player; setPlayer: (p: Player) => void; refresh: () => void; feel: Feel; onTierUp: (t: { from: string; to: string }) => void; onShare: () => void; onGrand: () => void; onBonus: () => void;
  region: string; minAge: number; onOpenRewards: () => void; onNotify: () => Promise<string | null>;
}) {
  const last = player.today.at(-1);
  const start = last ? last.symbols : ["cherry", "lemon", "star"];
  const symById = useRef(new Map(cfg.odds.symbols.map((s) => [s.id, s]))).current;
  const reels = [useRef<ReelHandle>(null), useRef<ReelHandle>(null), useRef<ReelHandle>(null)];
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState<string[]>(start);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [newSets, setNewSets] = useState<{ id: string; name: string; points: number }[]>([]);
  const [hits, setHits] = useState<boolean[]>([false, false, false]);
  const [settled, setSettled] = useState<boolean[]>([false, false, false]);
  const [runKey, setRunKey] = useState(0);
  const [err, setErr] = useState("");
  const [showOdds, setShowOdds] = useState(false);
  const [fresh, setFresh] = useState(false);
  const [notice, setNotice] = useState("");
  const pts = useCountUp(result?.points ?? 0, runKey);
  const left = player.spins.remaining;
  const untilReset = useCountdown(player.spins.resetsAt, refresh);

  async function spin() {
    setErr(""); setNotice(""); setResult(null); setNewSets([]); setHits([false, false, false]); setSettled([false, false, false]); setFresh(false);
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

    const out = res.j.result as SpinResult;
    // DEMO OPTION, OFF BY DEFAULT: when the first two reels match, the third takes longer to stop. The result was already
    // decided and is the same either way. It is the "near miss on the third symbol" idea from the brief, and it can only be
    // switched on from the stats page in this browser, because it needs a responsible gambling and legal view first.
    let anticipate = false;
    try { anticipate = window.localStorage.getItem("dr_demo_anticipation") === "1"; } catch { /* off */ }
    const slowThird = anticipate && out.symbols[0] === out.symbols[1];
    await sleep(Math.max(0, 550 - (performance.now() - t0)));
    await Promise.all(
      reels.map((r, i) =>
        sleep(slowThird && i === 2 ? 1700 : i * 320).then(async () => {
          await r.current?.stop(out.symbols[i], slowThird && i === 2 ? 2000 : 900 + i * 220);
          feel.sound("stop"); feel.buzz(8);
          setSettled((s) => s.map((v, k) => (k === i ? true : v)));
          if (slowThird && i === 1) setHits([true, true, false]);
        }),
      ),
    );
    setShown(out.symbols);
    const counts = new Map<string, number>();
    out.symbols.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));
    setHits(out.symbols.map((id) => out.outcome !== "none" && (counts.get(id) ?? 0) >= 2));
    setResult(out); setRunKey((k) => k + 1);
    setNewSets(res.j.newSets ?? []);
    setPlayer(res.j.state);
    setFresh(true);
    setBusy(false);

    if (out.outcome === "triple") { feel.sound("match"); feel.buzz([30, 40, 30, 40, 60]); }
    else if (out.outcome === "pair") { feel.sound("match"); feel.buzz([20, 30, 20]); }
    if (res.j.bonusRound) { await sleep(1000); onBonus(); }
    if ((res.j.newSets ?? []).length) { await sleep(450); feel.sound("set"); feel.buzz([25, 50, 25]); }
    if (res.j.tierUp) {
      await sleep(900); feel.sound("tier"); feel.buzz([40, 60, 40, 60, 120]);
      onTierUp(res.j.tierUp);
    }
    if (res.j.grandReached) {
      await sleep(res.j.tierUp ? 300 : 900); feel.sound("tier"); feel.buzz([40, 60, 40, 60, 120]);
      onGrand();
    }
  }

  const featured = cfg.odds.symbols.find((s) => s.id === player.featured?.id);
  const resetTxt = formatLeft(untilReset);
  // "today" or "tomorrow", judged in the game's own time zone so it is right wherever the player is.
  const dayOf = (x: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: cfg.reset.timeZone }).format(x);
  const resetToday = dayOf(new Date()) === dayOf(new Date(player.spins.resetsAt));
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
              {(result.featuredHits ?? 0) > 0 && <div className="bonusline">Featured symbol: its points counted double.</div>}
              {result.outcome === "triple" && <div className="bonusline">Trophy earned. {player.week.trophies} of {player.week.trophiesNeeded} this week.</div>}
              {newSets.map((s) => <div key={s.id} className="bonusline">Set complete: {s.name}. +{s.points} bonus points</div>)}
            </>
          ) : busy ? (
            <div className="hint small">Spinning</div>
          ) : last ? (
            <div className="hint small">Your last spin today</div>
          ) : (
            <div className="hint small">Match two or three symbols to multiply your points.</div>
          )}
        </div>

        <div className="pips">
          {Array.from({ length: player.spins.perDay }, (_, i) => <span key={i} aria-hidden className={"pip" + (i >= baseUsed ? " on" : "")} />)}
          {Array.from({ length: bonusLeft }, (_, i) => <span key={"b" + i} aria-hidden className="pip bonus on" />)}
          <span className="label tnum">{left > 0 ? `${left} spin${left === 1 ? "" : "s"} left today` : `All spins used. New spins ${resetToday ? "today" : "tomorrow"} at ${cfg.reset.label}`}</span>
        </div>

        {featured && (
          <div className="featured">
            <Glyph id={featured.id} rarity={featured.rarity} title={featured.name} />
            <span className="small">Today's featured symbol is <b>{featured.name}</b>. Its points count double. Odds are unchanged.</span>
          </div>
        )}
        {notice && <div className="bonusline" role="status" style={{ textAlign: "center", marginBottom: 8 }}>{notice}</div>}
        <button className="btn" disabled={busy || left <= 0} onClick={spin}>
          {busy ? "Spinning" : left > 0 ? "Spin" : `New spins in ${resetTxt}`}
        </button>
        {err && <div className="err" role="alert">{err}</div>}
      </section>

      <div className="section links">
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap" }}>
          <button className="link" onClick={() => { setShowOdds(!showOdds); if (!showOdds) track("odds_viewed"); }} aria-expanded={showOdds}>
            {showOdds ? "Hide the odds" : "See the odds"}
          </button>
          <button className="link" onClick={onShare}>Share my week</button>
        </div>
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
              Each reel is an independent random draw made on our server. Today's featured symbol counts double in the points and never changes the odds. Per spin: {pct(cfg.odds.pair)} chance of exactly one pair (points x{cfg.odds.multipliers.pair}), {pct(cfg.odds.triple)} chance of three of a kind (points x{cfg.odds.multipliers.triple}), {pct(cfg.odds.none)} no match. Set bonuses are one-off and never change the odds.
            </p>
          </div>
        )}
      </div>

      {!player.emailSaved && (
        <EmailCard
          defaultOpen={fresh || left === 0}
          onSaved={async (bonus) => { await refresh(); setNotice(bonus ? "Saved. Your fourth spin is ready." : "Saved. Reminders are on."); }}
        />
      )}

      <WeekStrip week={player.week} />
      <Trophies week={player.week} grandLabel={cfg.trophies.tierLabel} />

      {(left === 0 || player.emailSaved) && (
        <RewardsTeaser
          rw={cfg.rewards} region={region} daysPlayed={player.week.daysPlayed.length} points={player.week.points} tiers={cfg.tiers}
          trophies={player.week.trophies} emailSaved={player.emailSaved} notified={player.rewardsNotify} onOpen={onOpenRewards} onNotify={onNotify}
        />
      )}
      {(fresh || left === 0) && cfg.partnerOffer && <Offer offer={cfg.partnerOffer} region={region} minAge={minAge} support={cfg.responsible.support[region] ?? cfg.responsible.support.Other} />}
    </>
  );
}

function EmailCard({ onSaved, defaultOpen }: { onSaved: (bonus: boolean) => void; defaultOpen: boolean }) {
  // Always on the play screen until an email is saved. It starts as a slim row, and opens by itself after a spin
  // or when the spins are used, so there is always an obvious place to add an email.
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => { if (defaultOpen) setOpen(true); }, [defaultOpen]);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState("");
  async function save() {
    setErr("");
    const r = await fetch("/api/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, consent }) });
    const j = await r.json();
    if (r.ok) onSaved(Boolean(j.bonus)); else setErr(j.message ?? "Something went wrong.");
  }
  if (!open) {
    return (
      <div className="panel emailteaser">
        <div>
          <h3>Get a fourth spin</h3>
          <p className="small muted" style={{ fontFamily: "var(--sans)", margin: "2px 0 0" }}>Save your email for one extra spin.</p>
        </div>
        <button className="btn quiet" style={{ width: "auto", padding: "10px 18px" }} onClick={() => setOpen(true)} aria-expanded={false}>Add my email</button>
      </div>
    );
  }
  return (
    <div className="panel">
      <h3>Get a fourth spin</h3>
      <p className="small muted" style={{ fontFamily: "var(--sans)" }}>Save your email to get a fourth spin, once, and a reminder when your daily spins are ready. Your collection is kept with your account. We use your email only for the reminder you tick below.</p>
      <a className="linkrow" href="/privacy">How we use your data</a>
      <label className="field" htmlFor="em">Email address</label>
      <input id="em" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      <label className="check">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>Send me a reminder when my daily spins are ready. I can unsubscribe at any time.</span>
      </label>
      {err && <div className="err" role="alert">{err}</div>}
      <button className="btn quiet" onClick={save}>Save my email</button>
    </div>
  );
}

function Offer({ offer, region, minAge, support }: { offer: NonNullable<Cfg["partnerOffer"]>; region: string; minAge: number; support: { name: string; url: string | null; line: string | null } }) {
  useEffect(() => { track("offer_viewed"); }, []);
  return (
    <div className="offer">
      <span className="tag">Partner offer · Advertisement</span>
      <h3 style={{ marginTop: 10 }}>{offer.headline}</h3>
      <p className="small muted" style={{ fontFamily: "var(--sans)" }}><b style={{ color: "var(--offwhite)" }}>{offer.sponsor}</b>. {offer.body}</p>
      <div style={{ height: 12 }} />
      <a className="btn quiet" href={offer.href} target="_blank" rel="sponsored noopener noreferrer" onClick={() => track("offer_clicked", { region })}>{offer.cta}</a>
      <p className="small muted" style={{ fontFamily: "var(--sans)", marginBottom: 0 }}>{advertDisclosure(minAge, support)}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Collection({ cfg, player }: { cfg: Cfg; player: Player }) {
  const byId = new Map(cfg.odds.symbols.map((s) => [s.id, s]));
  const owned = cfg.odds.symbols.filter((s) => (player.collection[s.id] ?? 0) > 0).length;
  return (
    <div className="section">
      <h2>Collection</h2>
      <p className="muted">{owned} of {cfg.odds.symbols.length} symbols found. Complete a set for a one-off bonus.</p>

      <div>
        {player.sets.map((set) => (
          <div key={set.id} className={"setrow" + (set.complete ? " done" : "")}>
            <div className="head">
              <b>{set.name}</b>
              {set.complete ? <span className="chip">Complete</span> : <span className="chip dim tnum">{set.found} of {set.total}</span>}
            </div>
            <div className="small muted tnum">{set.complete ? `+${set.points} bonus points earned` : `Bonus: ${set.points} points`}</div>
            <div className="glyphs">
              {set.symbols.map((id) => {
                const s = byId.get(id)!;
                const have = (player.collection[id] ?? 0) > 0;
                return <span key={id} className={have ? "" : "missing"} title={s.name}><Glyph id={s.id} rarity={s.rarity} title={have ? s.name : `${s.name}, not found yet`} /></span>;
              })}
            </div>
          </div>
        ))}
      </div>

      <h3 style={{ marginTop: 22 }}>All symbols</h3>
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

function Tier({ cfg, player, onShare }: { cfg: Cfg; player: Player; onShare: () => void }) {
  const { week } = player;
  return (
    <div className="section">
      <h2>{week.tier.name} this week</h2>
      <p className="muted tnum">
        {week.points} points this week.{" "}
        {week.nextTier ? `${week.pointsToNext} more to reach ${week.nextTier.name}.` : "You have reached the top tier."}
      </p>
      <WeekStrip week={week} />
      <Trophies week={week} grandLabel={cfg.trophies.tierLabel} />
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
      <button className="btn quiet" style={{ marginTop: 16 }} onClick={onShare}>Share my week</button>
      <p className="small muted" style={{ fontFamily: "var(--sans)" }}>Tiers start again every Sunday at {cfg.reset.label}. Missing a day never removes points you have already earned.</p>
    </div>
  );
}
