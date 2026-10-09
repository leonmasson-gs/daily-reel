"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "./Overlays";
import { useSkin } from "./SkinContext";

type Band = { min: number; label: string; points: number };
export type BonusResult = { label: string; points: number; tierUp: { from: string; to: string } | null; state: unknown };
type Feel = { sound: (k: "tick" | "stop" | "match" | "set" | "tier") => void; buzz: (p: number | number[]) => void };

const SWEEP_MS = 1100; // one sweep of the marker, edge to edge

/**
 * The bonus round for a triple match. A marker sweeps across a bar and the player stops it in the middle. Skill counts:
 * closer to the middle is worth more. Anyone who cannot or does not want to time it can take the standard bonus,
 * which is worth about the same as a good stop, so nobody is punished for not playing.
 */
export function BonusRound({ bands, skipPoints, onDone, feel }: { bands: Band[]; skipPoints: number; onDone: (r: BonusResult | null) => void; feel: Feel }) {
  const skin = useSkin();
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [phase, setPhase] = useState<"play" | "sending" | "result" | "error">("play");
  const [result, setResult] = useState<BonusResult | null>(null);
  const [err, setErr] = useState("");
  const marker = useRef<HTMLDivElement>(null);
  const pos = useRef(0);
  const raf = useRef(0);
  const lastTry = useRef<{ accuracy?: number; skip?: boolean }>({});

  useEffect(() => {
    if (reduced || phase !== "play") return;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = ((t - t0) / SWEEP_MS) % 2;
      pos.current = p < 1 ? p : 2 - p;
      if (marker.current) marker.current.style.left = `${pos.current * 100}%`;
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [reduced, phase]);

  async function claim(body: { accuracy?: number; skip?: boolean }) {
    lastTry.current = body;
    setPhase("sending"); setErr("");
    try {
      const r = await fetch("/api/bonus", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(j.message ?? "We could not save the bonus."); setPhase("error"); return; }
      setResult(j); setPhase("result");
      if (j.label === "Perfect") { feel.sound("match"); feel.buzz([30, 40, 30]); } else feel.buzz(15);
    } catch {
      setErr("We could not reach the game. Check your connection and try again."); setPhase("error");
    }
  }
  function stop() {
    cancelAnimationFrame(raf.current);
    feel.sound("tick"); feel.buzz(12);
    claim({ accuracy: 1 - Math.abs(pos.current - 0.5) * 2 });
  }
  // Closing the dialog (Escape, or tapping outside) takes the standard bonus, so a round is never lost by accident.
  const close = () => {
    if (phase === "play") claim({ skip: true });
    else if (phase === "result") onDone(result);
    else if (phase === "error") onDone(null);
  };

  const zones = [...bands].filter((b) => b.min > 0).sort((a, b) => a.min - b.min); // widest first, narrowest on top

  return (
    <Modal title={skin.bonus.title} onClose={close}>
      <h2>{skin.bonus.title}</h2>
      <p>{skin.bonus.intro}</p>

      {phase !== "result" && (
        <>
          {!reduced && (
            <>
              <div className="btrack" role="img" aria-label={`A marker sweeps across a bar. Press ${skin.bonus.stop} when it is in the ${skin.bonus.zone}, in the middle.`}>
                {zones.map((z, i) => <div key={z.label} className={`bzone z${i}`} style={{ width: `${(1 - z.min) * 100}%` }} />)}
                <div className={"bmarker" + (skin.bonus.marker === "ball" ? " ball" : "")} ref={marker} />
              </div>
              <div className="blabels small muted" aria-hidden>
                {zones.slice().reverse().map((z) => <span key={z.label}>{z.label} {z.points}</span>)}
              </div>
              <button className="btn" autoFocus onClick={stop} disabled={phase !== "play"}>{phase === "sending" ? "Saving…" : skin.bonus.stop}</button>
              <div style={{ height: 10 }} />
            </>
          )}
          {reduced && <p className="small muted" style={{ fontFamily: "var(--sans)" }}>Reduced motion is on, so there is no moving marker. Take the standard bonus.</p>}
          <button className={reduced ? "btn" : "btn quiet"} autoFocus={reduced} onClick={() => claim({ skip: true })} disabled={phase !== "play"}>
            Take the standard bonus (+{skipPoints})
          </button>
          {phase === "error" && (
            <div className="err" role="alert">
              {err} <button className="link" onClick={() => claim(lastTry.current)}>Try again</button> <button className="link" onClick={() => onDone(null)}>Close</button>
            </div>
          )}
        </>
      )}

      {phase === "result" && result && (
        <div className="center" role="status">
          <div className="bresult">{result.label}</div>
          <div className="pts tnum" style={{ fontSize: "1.75rem", fontWeight: 800 }}>+{result.points} points</div>
          <div style={{ height: 14 }} />
          <button className="btn" autoFocus onClick={() => onDone(result)}>Continue</button>
        </div>
      )}
    </Modal>
  );
}
