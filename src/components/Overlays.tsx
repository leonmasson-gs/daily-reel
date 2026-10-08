"use client";

import { useEffect, useRef, useState } from "react";

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>("button, a, input")?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title} ref={box}>{children}</div>
    </div>
  );
}

const MEDAL: Record<string, string> = { bronze: "#c27c45", silver: "#d3dcdd", gold: "#ffd200", platinum: "#32cbf0" };

export function Medal({ tier }: { tier: string }) {
  const c = MEDAL[tier.toLowerCase()] ?? "#ffd200";
  return (
    <svg className="medal" viewBox="0 0 96 96" role="img" aria-label={`${tier} tier`}>
      <path d="M30 4h14l8 28H38z" fill="#32cbf0" opacity=".85" />
      <path d="M66 4H52l-8 28h14z" fill="#ffd200" opacity=".85" />
      <circle cx="48" cy="60" r="32" fill={c} />
      <circle cx="48" cy="60" r="23" fill="none" stroke="#14201f" strokeOpacity=".4" strokeWidth="3" />
      <polygon points="48,45 52.6,55.4 63.9,56.1 55.3,63.5 58,74.4 48,68.5 38,74.4 40.7,63.5 32.1,56.1 43.4,55.4" fill="#14201f" fillOpacity=".5" />
    </svg>
  );
}

export function Intro({ onDone, onSkip }: { onDone: () => void; onSkip: () => void }) {
  const [i, setI] = useState(0);
  const steps = [
    { h: "Three free spins a day", p: "Spin the reels up to three times. Your spins refill every day, and the reels only ever show what you drew." },
    { h: "Collect symbols and sets", p: "Every symbol you land joins your collection. Complete a set for a one-off bonus." },
    { h: "Build your weekly tier", p: "Points count towards a tier that starts again every Monday. This game is free to play with no stake and no prizes. The odds are one tap away on the play screen." },
  ];
  const s = steps[i];
  return (
    <Modal title="How Daily Reel works" onClose={onSkip}>
      <div className="steps" aria-hidden>{steps.map((_, k) => <span key={k} className={k === i ? "on" : ""} />)}</div>
      <h2>{s.h}</h2>
      <p>{s.p}</p>
      <div style={{ height: 8 }} />
      <button className="btn" onClick={() => (i < steps.length - 1 ? setI(i + 1) : onDone())}>{i < steps.length - 1 ? "Next" : "Start playing"}</button>
      {i < steps.length - 1 && <button className="link" style={{ display: "block", margin: "10px auto 0" }} onClick={onSkip}>Skip</button>}
    </Modal>
  );
}

export function TierUp({ from, to, pointsToNext, nextName, onClose }: { from: string; to: string; pointsToNext: number; nextName: string | null; onClose: () => void }) {
  return (
    <Modal title={`${to} reached`} onClose={onClose}>
      <div className="center">
        <Medal tier={to} />
        <h2>{to} reached</h2>
        <p>You moved up from {from} this week.{nextName ? ` ${pointsToNext} more points to reach ${nextName}.` : " That is the top tier."}</p>
      </div>
      <button className="btn" onClick={onClose}>Continue</button>
    </Modal>
  );
}

export type Recap = {
  weekStart: string; tier: string; points: number; daysPlayed: number; spins: number;
  pairs: number; triples: number; symbolsDiscovered: number; setsCompleted: number;
};

export function RecapDialog({ recap, onClose }: { recap: Recap; onClose: () => void }) {
  const rows: [string, string][] = [
    ["Points", String(recap.points)],
    ["Days played", `${recap.daysPlayed} of 7`],
    ["Spins", String(recap.spins)],
    ["Matched pairs", String(recap.pairs)],
    ["Triples", String(recap.triples)],
    ["New symbols found", String(recap.symbolsDiscovered)],
    ["Sets completed", String(recap.setsCompleted)],
  ];
  return (
    <Modal title="Your week" onClose={onClose}>
      <div className="center"><Medal tier={recap.tier} /><h2>Last week: {recap.tier}</h2></div>
      <table className="odds" style={{ marginTop: 6 }}>
        <tbody>{rows.map(([k, v]) => <tr key={k}><td>{k}</td><td className="tnum" style={{ textAlign: "right", fontWeight: 700 }}>{v}</td></tr>)}</tbody>
      </table>
      <p className="small muted" style={{ fontFamily: "var(--sans)" }}>Your tier has started again. Missing a day never removes points you have already earned.</p>
      <button className="btn" onClick={onClose}>Start this week</button>
    </Modal>
  );
}
