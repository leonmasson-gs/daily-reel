"use client";

import { useEffect, useState } from "react";
import { RewardArt, type ArtKind } from "./RewardArt";
import { drawProgress, partnerProgress, regularProgress, type RewardsCfg } from "@/lib/rewards";

type Tier = { name: string; minPoints: number };
type Base = { rw: RewardsCfg; region: string; daysPlayed: number; points: number; tiers: Tier[] };

const track = (name: string, extra?: object) =>
  fetch("/api/event", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, ...extra }) }).catch(() => {});

const VOTES = "dr_reward_votes";
function readVotes(): string[] {
  try { return JSON.parse(window.localStorage.getItem(VOTES) ?? "[]"); } catch { return []; }
}
function writeVotes(v: string[]) {
  try { window.localStorage.setItem(VOTES, JSON.stringify(v)); } catch { /* not saved */ }
}

function Progress({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = Math.max(max ? 3 : 0, Math.min(100, Math.round((value / max) * 100)));
  return (
    <div>
      <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(value, max)} aria-label={label}><div style={{ width: `${pct}%` }} /></div>
      <div className="small muted tnum" style={{ marginTop: 6 }}>{label}</div>
    </div>
  );
}

function Vote({ rung, region }: { rung: "regular" | "partner" | "draw"; region: string }) {
  const [voted, setVoted] = useState(false);
  useEffect(() => { setVoted(readVotes().includes(rung)); }, [rung]);
  return (
    <button className="btn quiet" style={{ marginTop: 14 }} disabled={voted} onClick={() => { setVoted(true); writeVotes([...readVotes(), rung]); track("reward_interest", { rung, region }); }}>
      {voted ? "Noted, thanks" : "I'd play for this"}
    </button>
  );
}

export function RewardsScreen({
  rw, region, setRegion, daysPlayed, points, tiers, tierName, weeks,
}: Base & { setRegion: (r: string) => void; tierName: string; weeks: { weeksRegular: number; weeksFull: number } }) {
  useEffect(() => { track("rewards_viewed", { region }); }, []); // once per visit
  const reg = regularProgress(daysPlayed, rw);
  const par = partnerProgress(points, tiers, rw);
  const dr = drawProgress(daysPlayed, rw);
  const offer = rw.partner.offers[region as keyof typeof rw.partner.offers] ?? rw.partner.offers.Other;

  return (
    <div className="section">
      <h2>Rewards preview</h2>
      <div className="previewtag" role="note">
        <b>Preview. Not live.</b> Nothing is awarded in this version. Every reward, prize and piece of wording below is a sample for review.
      </div>

      <div className="poolrow">
        <label htmlFor="region" className="small muted">Your pool</label>
        <select id="region" value={region} onChange={(e) => setRegion(e.target.value)}>
          {rw.regions.map((r) => <option key={r}>{r}</option>)}
        </select>
        <b className="small">{rw.product}</b>
      </div>
      <p className="small muted" style={{ fontFamily: "var(--sans)", marginTop: 6 }}>
        We pick your region from your connection. Change it to see the examples for other regions. Pools are split by region and by product.
      </p>

      {/* Loyalty */}
      <article className="rung">
        <div className="rung-head">
          <RewardArt kind="badge" size={52} />
          <div><span className="chip dim">Loyalty</span><h3>{rw.regular.title} badge</h3></div>
        </div>
        <p>Play on {rw.regular.daysNeeded} days in a week. They do not need to be in a row.</p>
        <Progress value={reg.days} max={reg.need} label={`${reg.days} of ${reg.need} days this week${reg.earned ? ". Earned in this preview" : ""}`} />
        <p className="small" style={{ fontFamily: "var(--sans)", marginBottom: 0 }}>{rw.regular.perk}</p>
        <p className="small muted tnum" style={{ fontFamily: "var(--sans)", margin: "6px 0 0" }}>
          Regular weeks so far: {weeks.weeksRegular}. Full weeks ({rw.regular.fullWeekDays} of 7 days): {weeks.weeksFull}.
        </p>
        <Vote rung="regular" region={region} />
      </article>

      {/* Incentive */}
      <article className="rung">
        <div className="rung-head">
          <RewardArt kind="gift" size={52} />
          <div><span className="chip dim">Incentive</span><h3>{rw.partner.title}</h3></div>
        </div>
        <p>Reach {rw.partner.tier} tier in a week to unlock an offer from our main sponsor.</p>
        <Progress value={par.points} max={par.need} label={`${par.points} of ${par.need} points. You are ${tierName} this week${par.earned ? ". Unlocked in this preview" : ""}`} />
        <div className="offer" style={{ marginBottom: 0 }}>
          <span className="tag">Sample partner offer · Advertisement</span>
          <h3 style={{ marginTop: 10 }}>{offer.headline}</h3>
          <p className="small" style={{ fontFamily: "var(--sans)", margin: "4px 0" }}><b>{rw.partner.sponsor}</b></p>
          <p className="small muted" style={{ fontFamily: "var(--sans)", margin: 0 }}>{offer.body}</p>
          <div className="small" style={{ marginTop: 10, color: par.earned ? "var(--sky)" : "var(--muted)", fontWeight: 700 }}>
            {par.earned ? "Unlocked in this preview" : `Locked until ${rw.partner.tier}`}
          </div>
        </div>
        <Vote rung="partner" region={region} />
      </article>

      {/* Draw */}
      <article className="rung">
        <div className="rung-head">
          <RewardArt kind="voucher" size={52} />
          <div><span className="chip dim">Draw</span><h3>{rw.draw.title}</h3></div>
        </div>
        <p>Play on at least {rw.draw.minDays} days in a week to enter. You get one entry for each day you play, up to {rw.draw.maxEntries}. It rewards coming back, not spinning more.</p>
        <Progress value={dr.days} max={dr.need} label={dr.qualifies ? `${dr.entries} of ${dr.maxEntries} entries this week` : `${dr.days} of ${dr.need} days to enter. No entries yet`} />
        <p className="small muted" style={{ fontFamily: "var(--sans)", margin: "10px 0 0" }}>Draw: {rw.draw.schedule}. One winner per pool, so this is the {region} pool for {rw.product.toLowerCase()}.</p>

        <h3 style={{ marginTop: 16 }}>Sample prizes for {region}</h3>
        <div className="prizes" tabIndex={0} aria-label="Sample prizes">
          {rw.draw.prizes.map((p) => (
            <div key={p.id} className="prize">
              <RewardArt kind={p.art as ArtKind} size={56} />
              <b>{p.name}</b>
              <span className="small muted">{p.value[region as keyof typeof p.value] ?? p.value.Other}</span>
              <span className="tag">Sample</span>
            </div>
          ))}
        </div>

        <div className="samplewinner">
          <RewardArt kind="star" size={36} />
          <div className="small">{rw.sampleWinner}</div>
        </div>

        <details className="terms">
          <summary>Sample draw wording, for legal review</summary>
          <ul>{rw.terms.map((t) => <li key={t}>{t}</li>)}</ul>
          <p className="small muted" style={{ fontFamily: "var(--sans)" }}>Placeholder wording. It has not been reviewed by legal and must not be used as live terms.</p>
        </details>
        <Vote rung="draw" region={region} />
      </article>

      <p className="small muted" style={{ fontFamily: "var(--sans)" }}>
        Free to play. 18+ only. Sample prizes, offers and wording are placeholders for review. Nothing here can be won or claimed in this version.
      </p>
    </div>
  );
}

/** Compact card on the Play screen, shown once the spins are used or an email is saved. */
export function RewardsTeaser({
  rw, region, daysPlayed, points, tiers, emailSaved, notified, onOpen, onNotify,
}: Base & { emailSaved: boolean; notified: boolean; onOpen: () => void; onNotify: () => Promise<string | null> }) {
  const reg = regularProgress(daysPlayed, rw);
  const par = partnerProgress(points, tiers, rw);
  const dr = drawProgress(daysPlayed, rw);
  const [msg, setMsg] = useState("");
  return (
    <div className="panel">
      <span className="tag">Preview. Not live.</span>
      <h3 style={{ marginTop: 10 }}>Rewards we are considering</h3>
      <ul className="miniladder">
        <li><span>{rw.regular.title} badge</span><span className="tnum">{reg.days} of {reg.need} days</span></li>
        <li><span>{rw.partner.tier} partner offer</span><span className="tnum">{par.points} of {par.need} points</span></li>
        <li><span>{rw.draw.title}</span><span className="tnum">{dr.qualifies ? `${dr.entries} entries` : `${dr.days} of ${dr.need} days to enter`}</span></li>
      </ul>
      <p className="small muted" style={{ fontFamily: "var(--sans)", margin: "8px 0" }}>Nothing is awarded in this version. These are examples for the {region} pool.</p>

      {emailSaved && !notified && (
        <div className="notify">
          <p className="small" style={{ fontFamily: "var(--sans)", margin: "0 0 8px" }}>
            Your email is saved for spin reminders only. Want one email if rewards go live? That is a separate choice.
          </p>
          <button className="btn quiet" onClick={async () => setMsg((await onNotify()) ?? "")}>Tell me if rewards launch</button>
          {msg && <div className="err" role="alert">{msg}</div>}
        </div>
      )}
      {emailSaved && notified && <p className="small" style={{ color: "var(--sky)", fontWeight: 700, margin: "0 0 10px" }}>Thanks. We will email you once if rewards go live.</p>}

      <button className="btn" onClick={onOpen}>See the rewards preview</button>
    </div>
  );
}
