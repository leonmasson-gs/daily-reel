// End-to-end checks against a running server. Usage: BASE=http://localhost:3000 node scripts/smoke.mjs
const BASE = process.env.BASE || "http://localhost:3000";
let failed = 0;
const pass = (l) => console.log("PASS", l);
const fail = (l, extra) => { failed++; console.log("FAIL", l, extra ?? ""); };
const expect = (l, cond, extra) => (cond ? pass(l) : fail(l, extra));

class Client {
  cookie = "";
  async call(path, method = "GET", body, headers = {}) {
    const res = await fetch(BASE + path, {
      method,
      headers: { "Content-Type": "application/json", ...(this.cookie ? { cookie: this.cookie } : {}), ...headers },
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
const pointsSum = results.reduce((n, x) => n + x.json.result.points + (x.json.newSets ?? []).reduce((m, s) => m + s.points, 0), 0);
expect("weekly points equal spin points plus any set bonuses", st.week.points === pointsSum, [st.week.points, pointsSum]);
expect("spin response carries newSets and tierUp", results.every((x) => Array.isArray(x.json.newSets) && "tierUp" in x.json));
expect("state lists the four sets", st.sets.length === 4 && st.sets.every((s) => s.total >= 2));
expect("today counts as a day played", st.week.daysPlayed.includes(st.week.today) && st.week.daysPlayed.length === 1, st.week.daysPlayed);
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

// recap
expect("no recap for a player in their first week", (await inviter.call("/api/recap")).json.recap === null);
expect("recap needs an age-gated player (401 on mark seen)", (await new Client().call("/api/recap", "POST")).status === 401);

// email + events
r = await inviter.call("/api/email", "POST", { email: "nope", consent: true });
expect("bad email is refused", r.status === 400);
r = await inviter.call("/api/email", "POST", { email: "Test@Example.com", consent: false });
expect("email without consent is refused", r.status === 400);
r = await inviter.call("/api/email", "POST", { email: "Test@Example.com", consent: true });
expect("valid email with consent is saved", r.status === 200 && (await inviter.call("/api/state")).json.player.emailSaved === true);
expect("unknown client event is refused", (await inviter.call("/api/event", "POST", { name: "drop_table" })).status === 400);
expect("intro events are accepted", (await inviter.call("/api/event", "POST", { name: "intro_completed" })).status === 200);
expect("known client event is accepted", (await inviter.call("/api/event", "POST", { name: "tier_viewed" })).status === 200);

// share + tracking events
expect("offer_viewed and share_card events are accepted",
  (await inviter.call("/api/event", "POST", { name: "offer_viewed" })).status === 200 &&
  (await inviter.call("/api/event", "POST", { name: "share_card" })).status === 200);

// share cards
for (const [label, path, w, h] of [
  ["week card", "/api/card?kind=week&tier=Silver&pts=131&days=3&found=cherry,bell,lemon", 1080, 1080],
  ["invite card", "/api/card?kind=invite", 1200, 630],
  ["card ignores junk input safely", "/api/card?kind=week&tier=%3Cscript%3E&pts=99999999999&days=999&found=evil", 1080, 1080],
]) {
  const res = await fetch(BASE + path);
  const buf = Buffer.from(await res.arrayBuffer());
  const isPng = buf.slice(0, 8).toString("hex") === "89504e470d0a1a0a";
  const width = buf.readUInt32BE(16), height = buf.readUInt32BE(20);
  expect(`${label} is a ${w}x${h} PNG`, res.status === 200 && isPng && width === w && height === h, [res.status, width, height]);
}

// link preview for invited visitors
const html = await (await fetch(BASE + "/?ref=abc123")).text();
expect("invite page carries a link-preview image tag", /property="og:image"[^>]*\/api\/card\?kind=invite/.test(html) || /\/api\/card\?kind=invite[^>]*property="og:image"/.test(html), html.slice(0, 200));
expect("invite page title mentions the friend invite", html.includes("A friend invited you to Daily Reel"));

// rewards preview
{
  const region = async (c) => (await (await fetch(BASE + "/api/region", { headers: c ? { "x-vercel-ip-country": c } : {} })).json()).region;
  expect("region: GB maps to UK, IE to IE, US to US, others to Other",
    (await region("GB")) === "UK" && (await region("IE")) === "IE" && (await region("US")) === "US" && (await region("FR")) === "Other" && (await region(null)) === "Other");
  expect("config carries the rewards preview with sample prizes for every region",
    cfg.rewards?.draw?.prizes?.length === 4 && ["UK", "IE", "US", "Other"].every((r) => cfg.rewards.draw.prizes.every((p) => p.value[r]) && cfg.rewards.partner.offers[r]));
  expect("config carries responsible gambling wording and support for every region",
    typeof cfg.responsible?.status === "string" && ["UK", "IE", "US", "Other"].every((r) => cfg.responsible.support[r]?.name), cfg.responsible);
  const rp = new Client();
  await rp.call("/api/age-gate", "POST", { dob: ADULT });
  const rs = (await rp.call("/api/state")).json.player;
  expect("state carries regular-week counts and opt-in flag", rs.rewards.weeksRegular === 0 && rs.rewardsNotify === false, rs.rewards);
  expect("reward events accept a rung and region", (await rp.call("/api/event", "POST", { name: "reward_interest", rung: "draw", region: "UK" })).status === 200 && (await rp.call("/api/event", "POST", { name: "rewards_viewed", region: "IE" })).status === 200);
  expect("rewards opt-in needs a saved email first (400)", (await rp.call("/api/rewards/notify", "POST")).status === 400);
  await rp.call("/api/email", "POST", { email: "rewards@example.org", consent: true });
  expect("rewards opt-in works once an email is saved", (await rp.call("/api/rewards/notify", "POST")).status === 200 && (await rp.call("/api/state")).json.player.rewardsNotify === true);
  expect("rewards opt-in refuses a visitor without an age check (401)", (await new Client().call("/api/rewards/notify", "POST")).status === 401);
}

// fixes from the persona test
{
  const priv = await fetch(BASE + "/privacy");
  const ptxt = await priv.text();
  expect("the privacy notice page loads and is marked as placeholder wording", priv.status === 200 && /Placeholder wording/.test(ptxt) && /dr_pid/.test(ptxt), priv.status);
  const hh = (await fetch(BASE + "/")).headers;
  expect("security headers are set (nosniff, frame deny, referrer policy)", hh.get("x-content-type-options") === "nosniff" && hh.get("x-frame-options") === "DENY" && !!hh.get("referrer-policy"));
  expect("the server no longer names its framework", !hh.get("x-powered-by"), hh.get("x-powered-by"));
  expect("an age of 126 is refused (400)", (await new Client().call("/api/age-gate", "POST", { dob: "1900-01-01" })).status === 400);
  const ec = new Client(); await ec.call("/api/age-gate", "POST", { dob: ADULT });
  expect("an email made of HTML is refused (400)", (await ec.call("/api/email", "POST", { email: "\"><script>alert(1)</script>@x.co", consent: true })).status === 400);
  expect("a normal email with an apostrophe is accepted", (await ec.call("/api/email", "POST", { email: "o'brien@example.org", consent: true })).status === 200);
  expect("events from a visitor with no player are ignored but answered 200", (await new Client().call("/api/event", "POST", { name: "tier_viewed" })).status === 200);
}

// ---- the fourth spin for an email, US 21+, trophies, the friends board, the 18:00 reset ----
{
  expect("config carries the reset time, trophies and the US age", cfg.reset?.hour === 18 && cfg.reset?.timeZone === "Europe/London" && cfg.trophies?.needed === 3 && cfg.minAgeUS === 21, [cfg.reset, cfg.trophies, cfg.minAgeUS]);
  expect("Ireland's footer names BeGambleAware (as the brief does)", cfg.responsible.support.IE.name === "BeGambleAware" && !!cfg.responsible.support.IE.url, cfg.responsible.support.IE);
  expect("the footer states 18+ and 21+ where US rules require", /18\+ in the UK and Ireland, 21\+ where US rules require/.test(cfg.responsible.intro), cfg.responsible.intro);
  const reg = async (c) => (await (await fetch(BASE + "/api/region", { headers: c ? { "x-vercel-ip-country": c } : {} })).json());
  expect("US visitors are told 21, everyone else 18", (await reg("US")).minAge === 21 && (await reg("GB")).minAge === 18 && (await reg(null)).minAge === 18);
  const us = new Client(), uk = new Client();
  const r19us = await us.call("/api/age-gate", "POST", { dob: yearsAgo(19) }, { "x-vercel-ip-country": "US" });
  expect("a 19-year-old connecting from the US is refused with the 21 message", r19us.status === 403 && /21/.test(r19us.json.message) && !us.cookie, [r19us.status, r19us.json]);
  const r19uk = await uk.call("/api/age-gate", "POST", { dob: yearsAgo(19) }, { "x-vercel-ip-country": "GB" });
  expect("a 19-year-old connecting from the UK is let in", r19uk.status === 200 && !!uk.cookie, r19uk.status);
  const r22us = await new Client().call("/api/age-gate", "POST", { dob: yearsAgo(22) }, { "x-vercel-ip-country": "US" });
  expect("a 22-year-old connecting from the US is let in", r22us.status === 200, r22us.status);

  // fourth spin for an email
  const em = new Client(); await em.call("/api/age-gate", "POST", { dob: ADULT });
  for (let i = 0; i < 3; i++) await em.call("/api/spin", "POST");
  expect("before an email there is no fourth spin (429)", (await em.call("/api/spin", "POST")).status === 429);
  const save1 = await em.call("/api/email", "POST", { email: "fourth-spin@example.test", consent: true });
  expect("saving an email earns the fourth spin", save1.status === 200 && save1.json.bonus === true, save1.json);
  expect("the state says a signup spin is waiting", (await em.call("/api/state")).json.player.spins.signupBonusRemaining === 1);
  const fourth = await em.call("/api/spin", "POST");
  expect("the fourth spin works and is flagged as a bonus", fourth.status === 200 && fourth.json.result.isBonus === true, fourth.status);
  expect("there is no fifth spin from the same email", (await em.call("/api/spin", "POST")).status === 429);
  const again = await em.call("/api/email", "POST", { email: "fourth-spin@example.test", consent: true });
  expect("saving the same email again earns nothing more", again.status === 200 && again.json.bonus === false, again.json);
  const other = new Client(); await other.call("/api/age-gate", "POST", { dob: ADULT });
  const dup = await other.call("/api/email", "POST", { email: "Fourth-Spin@Example.test", consent: true });
  expect("a second player using the same email does not farm another spin", dup.status === 200 && dup.json.bonus === false, dup.json);

  // trophies
  const tp = (await em.call("/api/state")).json.player.week;
  expect("state carries trophies and the Grand tier flag", typeof tp.trophies === "number" && tp.trophiesNeeded === 3 && typeof tp.grand === "boolean" && !!tp.resetsAt, tp);
  expect("a spin response says whether a trophy or the Grand tier was earned", "trophy" in fourth.json && "grandReached" in fourth.json);

  // friends board
  const host = new Client(); await host.call("/api/age-gate", "POST", { dob: ADULT });
  const hostCode = (await host.call("/api/state")).json.player.inviteCode;
  const guest = new Client(); await guest.call("/api/age-gate", "POST", { dob: ADULT, ref: hostCode });
  const stranger = new Client(); await stranger.call("/api/age-gate", "POST", { dob: ADULT });
  await guest.call("/api/spin", "POST");
  const hb = (await host.call("/api/friends")).json, gb = (await guest.call("/api/friends")).json, sb = (await stranger.call("/api/friends")).json;
  expect("the host sees the guest on the friends board", hb.friends.length === 1 && hb.friends[0].found.length >= 1, hb);
  expect("the guest sees the host", gb.friends.length === 1, gb);
  expect("a stranger sees nobody", sb.friends.length === 0, sb);
  expect("nicknames are generated words and numbers", /^[A-Z][a-z]+ [A-Z][a-z]+ \d{2}$/.test(hb.me.nickname), hb.me.nickname);
  expect("the board contains no email address", !JSON.stringify([hb, gb]).includes("@"));
  expect("the friends board needs an age check (401)", (await new Client().call("/api/friends")).status === 401);
  const before = hb.me.nickname; let changed = false;
  for (let i = 0; i < 8 && !changed; i++) { await host.call("/api/friends/nickname", "POST"); changed = (await host.call("/api/friends")).json.me.nickname !== before; }
  expect("a nickname can be shuffled", changed);
  expect("the nickname cannot be typed in (only shuffled)", (await host.call("/api/friends/nickname", "POST", { nickname: "<script>" })).json.nickname !== "<script>");
  await guest.call("/api/friends/visibility", "POST", { visible: false });
  const hb2 = (await host.call("/api/friends")).json;
  expect("a friend who hides appears as Private friend", hb2.friends[0].hidden === true && hb2.friends[0].nickname === "Private friend" && hb2.friends[0].found === undefined, hb2.friends[0]);
  expect("a bad visibility request is refused (400)", (await guest.call("/api/friends/visibility", "POST", { visible: "yes" })).status === 400);
}

// admin stats are locked
const nobody = new Client();
expect("stats are refused without signing in (401)", (await nobody.call("/api/admin/stats")).status === 401);
if (process.env.ADMIN_KEY) {
  const admin = new Client();
  const bad = await admin.call("/api/admin/login", "POST", { key: "not-the-key" });
  expect("wrong admin key is refused and sets no cookie", bad.status === 401 && !admin.cookie, bad.status);
  expect("a player's cookie does not open the stats", (await inviter.call("/api/admin/stats")).status === 401);
  const good = await admin.call("/api/admin/login", "POST", { key: process.env.ADMIN_KEY });
  expect("correct admin key signs in", good.status === 200 && !!admin.cookie, good.status);
  const sharesBefore = (await admin.call("/api/admin/stats")).json.answers.friends.shares;
  const flooder = new Client(); await flooder.call("/api/age-gate", "POST", { dob: ADULT });
  for (let i = 0; i < 40; i++) await flooder.call("/api/event", "POST", { name: "share_card" });
  const sharesAfter = (await admin.call("/api/admin/stats")).json.answers.friends.shares;
  expect("one player repeating an event 40 times is counted at most 6 times", sharesAfter - sharesBefore <= 6 && sharesAfter - sharesBefore >= 1, sharesAfter - sharesBefore);
  const st2 = await admin.call("/api/admin/stats");
  expect("stats return the five answers", st2.status === 200 && ["enjoyable", "comeBack", "email", "friends", "monetise"].every((k) => k in st2.json.answers), Object.keys(st2.json.answers ?? {}));
  const blob = JSON.stringify(st2.json);
  expect("stats contain no email addresses or player cookies", !blob.includes("example.com") && !blob.includes("@") && !blob.includes("dr_pid"));
  expect("stats counted the emails captured above", st2.json.answers.email.captured >= 1);
  const forged = new Client(); forged.cookie = "dr_admin=" + Date.now() + ".AAAA";
  expect("a forged admin cookie is refused", (await forged.call("/api/admin/stats")).status === 401);
  await admin.call("/api/admin/logout", "POST");
  expect("signing out closes access", (await admin.call("/api/admin/stats")).status === 401);
} else {
  console.log("SKIP admin sign-in checks (set ADMIN_KEY to run them)");
}

console.log(failed ? `\n${failed} check(s) FAILED` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
