import { config } from "./config";

/*
  A "day" in Daily Reel runs from 18:00 to 18:00 UK time (config.reset). A "week" runs from Sunday 18:00 to the
  next Sunday 18:00, so the weekly reset and the Sunday draw happen at the same moment as the evening spin reset.

  A day is named by the calendar date it ENDS on, because that is the day most of it falls on. Spins taken on
  Friday morning belong to the day that began on Thursday at 18:00 and ends on Friday at 18:00, so it is "Friday".
  A play through Friday 18:00 starts "Saturday". The week is therefore Monday to Sunday: it starts at 18:00 on
  Sunday and the Sunday day ends at the next 18:00, which is when the weekly reset and the Sunday draw happen.
  All of this is computed on the server.
*/

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const fmt = (timeZone: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** The wall-clock time in the game's time zone, expressed as if it were UTC. */
function wall(d: Date, timeZone = config.reset.timeZone): number {
  const parts = fmt(timeZone).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
}

/** Turns a wall-clock time in the game's zone back into a real instant, allowing for clock changes. */
function wallToUtc(wallMs: number, timeZone = config.reset.timeZone): Date {
  let offset = wall(new Date(wallMs), timeZone) - wallMs;
  let utc = wallMs - offset;
  const offset2 = wall(new Date(utc), timeZone) - utc;
  if (offset2 !== offset) { offset = offset2; utc = wallMs - offset; }
  return new Date(utc);
}

export function addDays(dateStr: string, n: number): string {
  return new Date(Date.parse(dateStr + "T00:00:00Z") + n * DAY).toISOString().slice(0, 10);
}

/** The play day a moment belongs to, as YYYY-MM-DD: the date that day ENDS on. */
export function playDate(d = new Date()): string {
  return new Date(wall(d) + (24 - config.reset.hour) * HOUR).toISOString().slice(0, 10);
}

/** The first play day of the current week: the Monday. (It begins on Sunday at 18:00.) */
export function weekStart(d = new Date()): string {
  const pd = playDate(d);
  const sinceMonday = (new Date(pd + "T00:00:00Z").getUTCDay() + 6) % 7; // 0 = Monday
  return addDays(pd, -sinceMonday);
}

export function previousWeekStart(d = new Date()): string {
  return addDays(weekStart(d), -7);
}

/** The real instant a play day (named by the date it ends on) ends: 18:00 that evening. */
function playDayEnd(dateStr: string): Date {
  return wallToUtc(Date.parse(dateStr + "T00:00:00Z") + config.reset.hour * HOUR);
}

/** When the next daily reset happens, as an ISO string. */
export function nextReset(d = new Date()): string {
  return playDayEnd(playDate(d)).toISOString();
}

/** When the current week ends and the next one begins: the Sunday day ends at 18:00. */
export function nextWeekReset(d = new Date()): string {
  return playDayEnd(addDays(weekStart(d), 6)).toISOString();
}

/** Is the next reset later today (in the game's time zone) or tomorrow? Used to say "today" or "tomorrow". */
export function resetIsToday(d = new Date()): boolean {
  const day = (x: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: config.reset.timeZone }).format(x);
  return day(d) === day(new Date(nextReset(d)));
}

export function ageOn(dob: string, today = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null;
  const [y, m, d] = dob.split("-").map(Number);
  const birth = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(birth.getTime()) || birth.getUTCMonth() !== m - 1) return null;
  if (birth > today) return null;
  let age = today.getUTCFullYear() - y;
  const hadBirthday =
    today.getUTCMonth() > m - 1 || (today.getUTCMonth() === m - 1 && today.getUTCDate() >= d);
  if (!hadBirthday) age -= 1;
  if (age > 120) return null; // not a real age: treat as a typing mistake
  return age;
}

/** The age a visitor must be, by the country they connect from. The US needs 21 where state rules require it. */
export function minAgeFor(country: string | null | undefined): number {
  return (country ?? "").toUpperCase() === "US" ? config.minAgeUS : config.minAge;
}
