// All "days" and "weeks" are computed on the server in UTC.
export function utcDate(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Monday of the current UTC week, as YYYY-MM-DD. */
export function utcWeekStart(d = new Date()): string {
  const day = d.getUTCDay(); // 0 = Sunday
  const diff = (day + 6) % 7;
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diff));
  return monday.toISOString().slice(0, 10);
}

export function nextUtcMidnight(d = new Date()): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1)).toISOString();
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
  return age;
}
