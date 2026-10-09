"use client";

import { useState } from "react";
import { Modal } from "./Overlays";
import { useSkin } from "./SkinContext";

type ShareInput = {
  inviteCode: string;
  tierName: string;
  points: number;
  daysPlayed: number;
  trophies: number;
  found: string[];
};

const track = (name: string) =>
  fetch("/api/event", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }).catch(() => {});

export function ShareDialog({ data, onClose }: { data: ShareInput; onClose: () => void }) {
  const [status, setStatus] = useState("");
  const skin = useSkin();
  const qs = new URLSearchParams({ kind: "week", tier: data.tierName, pts: String(data.points), days: String(data.daysPlayed), trophies: String(data.trophies), skin: skin.id, found: data.found.join(",") });
  const cardPath = `/api/card?${qs}`;
  const link = typeof window === "undefined" ? "" : `${window.location.origin}/?ref=${data.inviteCode}`;
  const text = `I'm ${data.tierName} on Daily Reel this week. Free to play. 18+ (21+ where US rules require).`;
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function getFile() {
    const blob = await fetch(cardPath).then((r) => r.blob());
    return new File([blob], "daily-reel-week.png", { type: "image/png" });
  }

  async function share() {
    setStatus("");
    try {
      const file = await getFile();
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text, url: link });
      else await navigator.share({ text, url: link });
      track("share_card");
    } catch (e) {
      if ((e as Error).name !== "AbortError") setStatus("Sharing did not work on this device. Use Save image or Copy link instead.");
    }
  }
  async function save() {
    try {
      const file = await getFile();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(file); a.download = file.name; a.click();
      URL.revokeObjectURL(a.href);
      track("share_card"); setStatus("Image saved.");
    } catch { setStatus("Could not save the image. Try again."); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(`${text} ${link}`); track("share_card"); setStatus("Link copied."); }
    catch { setStatus("Could not copy. Select the link on the Invite tab instead."); }
  }

  return (
    <Modal title="Share your week" onClose={onClose}>
      <h2>Share your week</h2>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={cardPath} alt={`Your week card: ${data.tierName}, ${data.points} points`} style={{ width: "100%", borderRadius: 12, display: "block", margin: "12px 0", background: "#081A31", aspectRatio: "1 / 1" }} />
      <p className="small muted" style={{ fontFamily: "var(--sans)", margin: "0 0 12px" }}>The card shows your tier, points and symbols. It never shows your email. Your invite link is added when you share.</p>
      {canShare && <button className="btn" onClick={share}>Share</button>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: canShare ? 10 : 0 }}>
        <button className="btn quiet" onClick={save}>Save image</button>
        <button className="btn quiet" onClick={copy}>Copy link</button>
      </div>
      {status && <div className="small" role="status" style={{ marginTop: 10, color: "var(--carolina)" }}>{status}</div>}
      <button className="link" style={{ display: "block", margin: "12px auto 0" }} onClick={onClose}>Close</button>
    </Modal>
  );
}
