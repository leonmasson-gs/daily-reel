// Sound and vibration. Both are optional. Sound is off by default and only starts after a tap.
export const KEYS = { sound: "dr_sound", haptics: "dr_haptics", intro: "dr_intro_seen" } as const;

export function readFlag(key: string, fallback: boolean): boolean {
  try {
    const v = window.localStorage.getItem(key);
    return v === null ? fallback : v === "1";
  } catch { return fallback; }
}
export function writeFlag(key: string, value: boolean) {
  try { window.localStorage.setItem(key, value ? "1" : "0"); } catch { /* storage unavailable: setting just won't persist */ }
}

export const canVibrate = () => typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
export function vibrate(pattern: number | number[]) {
  if (canVibrate()) navigator.vibrate(pattern);
}

let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx ??= new AC();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}
function tone(freq: number, start: number, dur: number, gain = 0.05, type: OscillatorType = "sine") {
  const c = audio(); if (!c) return;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.value = freq;
  const t = c.currentTime + start;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

export type SoundKind = "tick" | "stop" | "match" | "set" | "tier";
export function playSound(kind: SoundKind) {
  switch (kind) {
    case "tick": tone(880, 0, 0.06, 0.04); break;
    case "stop": tone(300, 0, 0.09, 0.05, "triangle"); break;
    case "match": tone(523, 0, 0.14); tone(659, 0.1, 0.18); break;
    case "set": tone(587, 0, 0.12); tone(740, 0.1, 0.12); tone(880, 0.2, 0.2); break;
    case "tier": tone(523, 0, 0.14); tone(659, 0.12, 0.14); tone(784, 0.24, 0.14); tone(1047, 0.36, 0.3); break;
  }
}
