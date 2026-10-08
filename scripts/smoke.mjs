// End-to-end checks against a running server. Usage: BASE=http://localhost:3000 node scripts/smoke.mjs
const BASE = process.env.BASE || "http://localhost:3000";
let failed = 0;
const pass = (l) => console.log("PASS", l);
const fail = (l, extra) => { failed++; console.log("FAIL", l, extra ?? ""); };
const expect = (l, cond, extra) => (cond ? pass(l) : fail(l, extra));

class Client {
  cookie = "";
  async call(path, method = "GET", body) {
    const res = await fetch(BASE + path, {
      method,
      headers: { "Content-Type": "application/json", ...(this.cookie ? { cookie: this.cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get("set-cookie");
    if (set) this.cookie = set.split(";")[0];
    return { status: res.status, json: await res.json().catch(() => ({})) };
  }
}
const ADULT = "1990-05-17";
const yearsAgo = (y, plusDays = 0) => { const d = new Date(); d.setUTCFullYear(d.getUTCFullYear() - y); d.setUTCDate(d.getUTCDate() + plusDays); return d.toISOString().slice(0, 10); };

// config + odds
const cfg = (await new Client().call("/api/config")).json;
const totalChance = cfg.odds.symbols.reduce((n, s) => n + s.chancePerReel, 0);
expect("published odds add up to 100%", Math.abs(totalChance - 1) < 1e-9, totalChance);
expect("published none+pair+triple = 100%", Math.abs(cfg.odds.none + cfg.odds.pair + cfg.odds.triple - 1) < 1e-9);

// no cookie
let c = new Client();
expect("state without age gate has no player", (await c.call("/api/state")).json.player === null);
let r = await c.call("/api/spin", "POST");
expect("spin before age gate is refused (401)", r.status === 401, r.status);

// age gate
r = await c.call("/api/age-gate", "POST", { dob: yearsAgo(17, 1) });
expect("17 years 364 days old is refused (403)", r.status === 403 && !c.cookie, r.status);
r = await c.call("/api/age-gate", "POST", { dob: "not-a-date" });
expect("garbage date of birth is refused (400)", r.status === 400, r.status);
r = await c.call("/api/age-gate", "POST", { dob: yearsAgo(18) });
expect("exactly 18 today is accepted", r.status === 200 && !!c.cookie, r.status);

// tampered cookie
const forged = new Client();
forged.cookie = c.cookie.replace(/\.[^.]+$/, ".AAAA");
expect("forged cookie signature is ignored", (await forged.call("/api/state")).json.player === null);
const forged2 = new Client();
forged2.cookie = "dr_pid=00000000-0000-4000-8000-000000000000.AAAA";
expect("made-up player id is ignored", (await forged2.call("/api/spin", "POST")).status === 401);

// three spins, then blocked
c = new Client();
await c.call("/api/age-gate", "POST", { dob: ADULT });
const results = [];
for (let i = 0; i < 3; i++) results.push(await c.call("/api/spin", "POST"));
expect("first three spins succeed", results.every((x) => x.status === 200 && x.json.result?.symbols?.length === 3), results.map((x) => x.status));
expect("remaining counts down to 0", results[2].json.state.spins.remaining === 0);
r = await c.call("/api/spin", "POST");
expect("fourth spin is refused (429) with a reset time", r.status === 429 && !!r.json.resetsAt, r.status);
const st = (await c.call("/api/state")).json.player;
expect("limit survives a reload (state still 0 left)", st.spins.remaining === 0 && st.today.length === 3);
const pointsSum = results.reduce((n, x) => n + x.json.result.points, 0);
expect("weekly points equal the sum of spins", st.week.points === pointsSum, [st.week.points, pointsSum]);
const collected = Object.values(st.collection).reduce((a, b) => a + b, 0);
expect("collection holds 9 symbols after 3 spins", collected === 9, collected);

// parallel spins cannot beat the limit
const racer = new Client();
await racer.call("/api/age-gate", "POST", { dob: ADULT });
const burst = await Promise.all(Array.from({ length: 8 }, () => racer.call("/api/spin", "POST")));
const okCount = burst.filter((x) => x.status === 200).length;
expect("8 parallel spins give at most 3 results", okCount <= 3 && okCount >= 1, burst.map((x) => x.status));
const after = (await racer.call("/api/state")).json.player;
expect("database never holds more than 3 spins today", after.today.length <= 3, after.today.length);

// invites
const inviter = new Client();
await inviter.call("/api/age-gate", "POST", { dob: ADULT });
const code = (await inviter.call("/api/state")).json.player.inviteCode;
for (let i = 0; i < 3; i++) await inviter.call("/api/spin", "POST");
const friend1 = new Client();
await friend1.call("/api/age-gate", "POST", { dob: ADULT, ref: code });
expect("no bonus just for a friend joining", (await inviter.call("/api/state")).json.player.spins.bonusRemaining === 0);
await friend1.call("/api/spin", "POST");
expect("friend's first spin gives inviter 1 bonus spin", (await inviter.call("/api/state")).json.player.spins.bonusRemaining === 1);
await friend1.call("/api/spin", "POST");
expect("friend's second spin gives nothing more", (await inviter.call("/api/state")).json.player.spins.bonusRemaining === 1);
const under = new Client();
r = await under.call("/api/age-gate", "POST", { dob: yearsAgo(16), ref: code });
expect("under-18 friend gets no player and no bonus", r.status === 403);
for (let i = 0; i < 3; i++) { const f = new Client(); await f.call("/api/age-gate", "POST", { dob: ADULT, ref: code }); await f.call("/api/spin", "POST"); }
let s = (await inviter.call("/api/state")).json.player;
expect("bonus spins are capped at 2 a week", s.spins.bonusRemaining === 2, s.spins.bonusRemaining);
const b1 = await inviter.call("/api/spin", "POST");
const b2 = await inviter.call("/api/spin", "POST");
const b3 = await inviter.call("/api/spin", "POST");
expect("inviter can use exactly 2 bonus spins", b1.status === 200 && b2.status === 200 && b3.status === 429, [b1.status, b2.status, b3.status]);
expect("bonus spins are flagged", b1.json.result.isBonus && b2.json.result.isBonus);

// email + events
r = await inviter.call("/api/email", "POST", { email: "nope", consent: true });
expect("bad email is refused", r.status === 400);
r = await inviter.call("/api/email", "POST", { email: "Test@Example.com", consent: false });
expect("email without consent is refused", r.status === 400);
r = await inviter.call("/api/email", "POST", { email: "Test@Example.com", consent: true });
expect("valid email with consent is saved", r.status === 200 && (await inviter.call("/api/state")).json.player.emailSaved === true);
expect("unknown client event is refused", (await inviter.call("/api/event", "POST", { name: "drop_table" })).status === 400);
expect("known client event is accepted", (await inviter.call("/api/event", "POST", { name: "tier_viewed" })).status === 200);

console.log(failed ? `\n${failed} check(s) FAILED` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
