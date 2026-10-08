"use client";

import { useCallback, useEffect, useState } from "react";

type Stats = {
  generatedAt: string; today: string;
  totals: { players: number; spinners: number; totalSpins: number; spinsToday: number };
  answers: {
    enjoyable: { spinsPerPlayer: number | null; fullDayShare: number | null; playerDays: number };
    comeBack: { returnRate: number | null; eligible: number; returned: number; multiDayPlayers: number; multiDayShare: number | null };
    email: { captured: number; rate: number | null };
    friends: { copies: number; joinedViaInvite: number; redeemed: number; shares: number };
    monetise: { views: number; clicks: number; ctr: number | null; byRegion: { region: string; clicks: number }[] };
  };
  daily: { date: string; active: number; joined: number }[];
  rewards: { viewers: number; notifyOptIns: number; viewersByRegion: { region: string; players: number }[]; interest: { rung: string; label: string; players: number }[] };
  daysPlayedThisWeek: { days: number; players: number }[];
  progress: { tiersThisWeek: { name: string; players: number }[]; sets: { name: string; completed: number }[]; introCompleted: number; introSkipped: number; tierUps: number; recapsViewed: number };
  fairness: { spins: number; pair: { observed: number | null; published: number }; triple: { observed: number | null; published: number }; reels: { name: string; observed: number | null; published: number }[] };
  guardrails: { agePassed: number; ageBlocked: number; oddsViewed: number };
};

const pct = (v: number | null, d = 0) => (v == null ? "no data yet" : `${(v * 100).toFixed(d)}%`);
const num1 = (v: number | null) => (v == null ? "no data yet" : v.toFixed(1));

function Bars({ values, labels, color }: { values: number[]; labels: string[]; color: string }) {
  const max = Math.max(1, ...values);
  return (
    <div className="minibars" role="img" aria-label={`Daily values: ${values.join(", ")}`}>
      {values.map((v, i) => (
        <div key={i} className="mb">
          <span className="tnum small">{v || ""}</span>
          <i style={{ height: `${Math.max(3, (v / max) * 100)}%`, background: v ? color : "var(--line-soft)" }} />
          <span className="small muted">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

function Tile({ title, big, line, children }: { title: string; big: string; line: string; children?: React.ReactNode }) {
  return (
    <div className="tile">
      <div className="small muted">{title}</div>
      <div className={"bigstat tnum" + (big.length > 9 ? " small-stat" : "")}>{big}</div>
      <div className="small">{line}</div>
      {children}
    </div>
  );
}

export default function AdminStats() {
  const [state, setState] = useState<"loading" | "login" | "off" | "ready">("loading");
  const [stats, setStats] = useState<Stats | null>(null);
  const [key, setKey] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/stats", { cache: "no-store" });
    if (r.status === 401) { setState("login"); return; }
    setStats(await r.json()); setState("ready");
  }, []);

  useEffect(() => {
    // A 404 from login means the page is switched off on the server.
    fetch("/api/admin/stats", { cache: "no-store" }).then(async (r) => {
      if (r.status === 401) {
        const p = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "" }) });
        setState(p.status === 404 ? "off" : "login");
      } else { setStats(await r.json()); setState("ready"); }
    });
  }, []);

  async function login() {
    setErr("");
    const r = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) });
    const j = await r.json();
    if (r.ok) { setKey(""); load(); } else setErr(j.message ?? "Could not sign in.");
  }
  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setStats(null); setState("login");
  }

  if (state === "loading") return <main className="app wide"><p className="muted small">Loading…</p></main>;
  if (state === "off") return <main className="app wide"><div className="panel"><h2>Stats are switched off</h2><p>Set the ADMIN_KEY setting on the server to turn this page on.</p></div></main>;
  if (state === "login" || !stats) {
    return (
      <main className="app">
        <h1 className="brand" style={{ marginBottom: 12 }}><i aria-hidden />Daily Reel stats</h1>
        <div className="panel">
          <h2>Team access</h2>
          <p className="muted">Enter the admin key to see the numbers.</p>
          <label className="field" htmlFor="k">Admin key</label>
          <input id="k" type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} onKeyDown={(e) => e.key === "Enter" && login()} />
          {err && <div className="err" role="alert">{err}</div>}
          <div style={{ height: 14 }} />
          <button className="btn" disabled={!key} onClick={login}>Open stats</button>
        </div>
      </main>
    );
  }

  const a = stats.answers;
  const labels = stats.daily.map((d) => d.date.slice(8));
  const f = stats.fairness;
  const lowData = f.spins < 300;

  return (
    <main className="app wide">
      <header className="top">
        <h1 className="brand"><i aria-hidden />Daily Reel stats</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn quiet" style={{ width: "auto", minHeight: 44, padding: "8px 16px" }} onClick={load}>Refresh</button>
          <button className="btn quiet" style={{ width: "auto", minHeight: 44, padding: "8px 16px" }} onClick={logout}>Sign out</button>
        </div>
      </header>
      <p className="small muted tnum">
        {stats.totals.players} players, {stats.totals.spinners} have spun, {stats.totals.totalSpins} spins in total, {stats.totals.spinsToday} today. All dates are UTC. Updated {new Date(stats.generatedAt).toLocaleTimeString()}.
      </p>

      <h2 style={{ margin: "18px 0 10px" }}>The five answers</h2>
      <div className="tiles">
        <Tile title="1. Enjoyable" big={a.enjoyable.spinsPerPlayer == null ? "–" : `${num1(a.enjoyable.spinsPerPlayer)} spins`} line={`per player. ${pct(a.enjoyable.fullDayShare)} of player-days used all three spins.`}>
          <div className="small muted">Based on {a.enjoyable.playerDays} player-days.</div>
        </Tile>
        <Tile title="2. Come back" big={pct(a.comeBack.returnRate)} line={a.comeBack.eligible === 0 ? "of players returned on a later day. Nobody has had a second day to return yet." : `of players returned on a later day (${a.comeBack.returned} of ${a.comeBack.eligible} who started before today).`}>
          <div className="small muted">{a.comeBack.multiDayPlayers} players have played on 2 or more days ({pct(a.comeBack.multiDayShare)}).</div>
        </Tile>
        <Tile title="3. Email incentive" big={pct(a.email.rate)} line={`of players who spun left an email. ${a.email.captured} captured.`} />
        <Tile title="4. With friends" big={`${a.friends.redeemed} joined`} line={`and played through an invite. ${a.friends.copies} invite link${a.friends.copies === 1 ? "" : "s"} shared, ${a.friends.shares} week card${a.friends.shares === 1 ? "" : "s"} shared.`}>
          <div className="small muted">{a.friends.joinedViaInvite} sign-ups arrived through a link.</div>
        </Tile>
        <Tile title="5. Monetise later" big={pct(a.monetise.ctr, 1)} line={`partner offer click-through. ${a.monetise.clicks} click${a.monetise.clicks === 1 ? "" : "s"} from ${a.monetise.views} view${a.monetise.views === 1 ? "" : "s"}.`}>
          {a.monetise.byRegion.length > 0 && <div className="small muted">{a.monetise.byRegion.map((r) => `${r.region}: ${r.clicks}`).join(", ")}</div>}
        </Tile>
      </div>

      <div className="twocol">
        <div className="panel">
          <h3>Active players per day</h3>
          <Bars values={stats.daily.map((d) => d.active)} labels={labels} color="var(--gold)" />
        </div>
        <div className="panel">
          <h3>New players per day</h3>
          <Bars values={stats.daily.map((d) => d.joined)} labels={labels} color="var(--sky)" />
        </div>
      </div>

      <div className="twocol">
        <div className="panel">
          <h3>Progress this week</h3>
          <table className="odds"><tbody>
            {stats.progress.tiersThisWeek.map((t) => <tr key={t.name}><td>{t.name}</td><td className="tnum" style={{ textAlign: "right" }}>{t.players} players</td></tr>)}
          </tbody></table>
          <h3 style={{ marginTop: 16 }}>Days played this week</h3>
          <table className="odds"><tbody>
            {stats.daysPlayedThisWeek.length === 0 ? <tr><td className="muted">No play yet this week</td></tr> : stats.daysPlayedThisWeek.map((d) => <tr key={d.days}><td>{d.days} day{d.days === 1 ? "" : "s"}</td><td className="tnum" style={{ textAlign: "right" }}>{d.players} players</td></tr>)}
          </tbody></table>
        </div>
        <div className="panel">
          <h3>Sets completed</h3>
          <table className="odds"><tbody>
            {stats.progress.sets.map((s) => <tr key={s.name}><td>{s.name}</td><td className="tnum" style={{ textAlign: "right" }}>{s.completed}</td></tr>)}
          </tbody></table>
          <h3 style={{ marginTop: 16 }}>Moments</h3>
          <table className="odds"><tbody>
            <tr><td>Intro completed / skipped</td><td className="tnum" style={{ textAlign: "right" }}>{stats.progress.introCompleted} / {stats.progress.introSkipped}</td></tr>
            <tr><td>Tier-ups</td><td className="tnum" style={{ textAlign: "right" }}>{stats.progress.tierUps}</td></tr>
            <tr><td>Weekly recaps viewed</td><td className="tnum" style={{ textAlign: "right" }}>{stats.progress.recapsViewed}</td></tr>
          </tbody></table>
        </div>
      </div>

      <div className="panel">
        <h3>Rewards preview: what do players want?</h3>
        <p className="small muted" style={{ fontFamily: "var(--sans)" }}>
          {stats.rewards.viewers} player{stats.rewards.viewers === 1 ? "" : "s"} opened the preview and {stats.rewards.notifyOptIns} asked to hear when rewards launch. Each player counts once per reward.
          {stats.rewards.viewersByRegion.length > 0 && ` Viewed from: ${stats.rewards.viewersByRegion.map((r) => `${r.region} ${r.players}`).join(", ")}.`}
        </p>
        <table className="odds"><tbody>
          {stats.rewards.interest.map((r) => <tr key={r.rung}><td>{r.label}: "I'd play for this"</td><td className="tnum" style={{ textAlign: "right" }}>{r.players}</td></tr>)}
        </tbody></table>
      </div>

      <div className="panel">
        <h3>Guardrails in action</h3>
        <table className="odds"><tbody>
          <tr><td>Age checks passed</td><td className="tnum" style={{ textAlign: "right" }}>{stats.guardrails.agePassed}</td></tr>
          <tr><td>Under-18 attempts blocked (counted, nothing stored about them)</td><td className="tnum" style={{ textAlign: "right" }}>{stats.guardrails.ageBlocked}</td></tr>
          <tr><td>Times the odds were opened</td><td className="tnum" style={{ textAlign: "right" }}>{stats.guardrails.oddsViewed}</td></tr>
        </tbody></table>
      </div>

      <div className="panel">
        <h3>Do the real results match the published odds?</h3>
        <p className="small muted" style={{ fontFamily: "var(--sans)" }}>
          {lowData ? `Only ${f.spins} spins so far, so small gaps are normal. Check again once there are a few hundred.` : `Across ${f.spins} spins.`}
        </p>
        <table className="odds">
          <thead><tr><th>Result</th><th style={{ textAlign: "right" }}>Published</th><th style={{ textAlign: "right" }}>Observed</th></tr></thead>
          <tbody>
            <tr><td>Exactly one pair, per spin</td><td className="tnum" style={{ textAlign: "right" }}>{pct(f.pair.published, 1)}</td><td className="tnum" style={{ textAlign: "right" }}>{pct(f.pair.observed, 1)}</td></tr>
            <tr><td>Three of a kind, per spin</td><td className="tnum" style={{ textAlign: "right" }}>{pct(f.triple.published, 1)}</td><td className="tnum" style={{ textAlign: "right" }}>{pct(f.triple.observed, 1)}</td></tr>
            {f.reels.map((r) => <tr key={r.name}><td>{r.name}, per reel</td><td className="tnum" style={{ textAlign: "right" }}>{pct(r.published, 1)}</td><td className="tnum" style={{ textAlign: "right" }}>{pct(r.observed, 1)}</td></tr>)}
          </tbody>
        </table>
      </div>
    </main>
  );
}
