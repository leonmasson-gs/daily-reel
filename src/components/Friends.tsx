"use client";

import { useCallback, useEffect, useState } from "react";
import { Glyph } from "./Glyph";

type Sym = { id: string; name: string; rarity: string };
type Entry = { nickname: string; you: boolean; hidden: boolean; tier?: string; points?: number; trophies?: number; sets?: number; found?: string[] };
type Board = { me: Entry; friends: Entry[]; visible: boolean };

const track = (name: string) =>
  fetch("/api/event", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }).catch(() => {});

function Row({ e, symbols }: { e: Entry; symbols: Sym[] }) {
  if (e.hidden) {
    return (
      <li className="boardrow hidden">
        <div className="who"><b>{e.nickname}</b></div>
        <p className="small muted" style={{ fontFamily: "var(--sans)", margin: "4px 0 0" }}>This friend keeps their progress private.</p>
      </li>
    );
  }
  const found = new Set(e.found ?? []);
  return (
    <li className={"boardrow" + (e.you ? " me" : "")}>
      <div className="who">
        <b>{e.nickname}</b>
        {e.you && <span className="chip">You</span>}
        <span className="chip dim">{e.tier}</span>
        <span className="small muted tnum">{e.points} points</span>
      </div>
      <div className="strip8" role="img" aria-label={`${found.size} of ${symbols.length} symbols found`}>
        {symbols.map((s) => (
          <span key={s.id} className={found.has(s.id) ? "" : "missing"} title={s.name}>
            <Glyph id={s.id} rarity={s.rarity} title={s.name} />
          </span>
        ))}
      </div>
      <div className="small muted tnum" style={{ fontFamily: "var(--sans)" }}>
        {found.size} of {symbols.length} symbols. {e.trophies ?? 0} {(e.trophies ?? 0) === 1 ? "trophy" : "trophies"} this week. {e.sets ?? 0} {(e.sets ?? 0) === 1 ? "set" : "sets"} complete.
      </div>
    </li>
  );
}

export function Friends({ symbols, minAge, minAgeUS, bonusCap, inviteCode }: { symbols: Sym[]; minAge: number; minAgeUS: number; bonusCap: number; inviteCode: string }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const link = typeof window === "undefined" ? "" : `${window.location.origin}/?ref=${inviteCode}`;

  const load = useCallback(async () => {
    setErr("");
    try {
      const r = await fetch("/api/friends", { cache: "no-store" });
      if (!r.ok) throw new Error("board");
      setBoard(await r.json());
    } catch {
      setErr("We could not load your friends board.");
    }
  }, []);
  useEffect(() => { load(); track("friends_viewed"); }, [load]);

  async function share() {
    track("invite_copied");
    if (navigator.share) { try { await navigator.share({ title: "Daily Reel", text: "Free to play. 18+ (21+ where US rules require).", url: link }); return; } catch {} }
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* the link is on screen to copy by hand */ }
  }
  async function shuffle() {
    await fetch("/api/friends/nickname", { method: "POST" });
    load();
  }
  async function toggle(visible: boolean) {
    // Flip the switch straight away so a slow connection never makes a tap look ignored. Undo it if the server says no.
    setBoard((b) => (b ? { ...b, visible } : b));
    try {
      const r = await fetch("/api/friends/visibility", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visible }) });
      if (!r.ok) throw new Error("visibility");
    } catch {
      setBoard((b) => (b ? { ...b, visible: !visible } : b));
      setErr("We could not save that. Try again.");
      return;
    }
    load();
  }

  return (
    <div className="section">
      <h2>Friends</h2>
      <p>When a friend aged {minAge} or over ({minAgeUS} or over where US rules require) joins with your link and takes their first spin, you get one bonus spin. The limit is {bonusCap} bonus spins a week.</p>
      <label className="field" htmlFor="lnk">Your invite link</label>
      <input id="lnk" type="text" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
      <div style={{ height: 12 }} />
      <button className="btn" onClick={share}>{copied ? "Link copied" : "Share your link"}</button>
      <p className="small muted" style={{ fontFamily: "var(--sans)" }}>Only share it with people who meet the age rule.</p>

      <h3 style={{ marginTop: 26 }}>Friends board</h3>
      <p className="small muted" style={{ fontFamily: "var(--sans)", marginTop: 4 }}>
        Compare collections with the people you invited and the person who invited you. Friends see only a random nickname, your tier, your points and which symbols you have found. Never your email.
      </p>

      {err && <div className="err" role="alert">{err} <button className="link" onClick={load}>Try again</button></div>}
      {!board && !err && <p className="small muted" role="status">Loading…</p>}
      {board && (
        <>
          <ul className="board">
            <Row e={board.me} symbols={symbols} />
            {board.friends.map((f, i) => <Row key={i} e={f} symbols={symbols} />)}
          </ul>
          {board.friends.length === 0 && (
            <p className="muted">No friends here yet. When a friend joins with your link, they appear here and you can compare collections.</p>
          )}
          <div className="boardtools">
            <button className="btn quiet" onClick={shuffle}>Shuffle my nickname</button>
            <label className="check">
              <input type="checkbox" checked={board.visible} onChange={(e) => toggle(e.target.checked)} />
              <span>Show my progress on my friends' boards. If you turn this off they see you as "Private friend".</span>
            </label>
          </div>
        </>
      )}
    </div>
  );
}
