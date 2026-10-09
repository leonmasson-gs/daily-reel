# Daily Reel

Free-to-play daily reel game for the GDC AdTech hackathon (Brief 6). No stake, no purchase, no prizes, 18+.

## What it does
- Age check before the first spin: 18+ (21+ for visitors connecting from the US). The date of birth is checked and discarded, never stored.
- Three spins a day. Every result is decided on the server and the limit is enforced in the database. A day runs 18:00 to 18:00 UK time (it follows daylight saving), so spins refill every evening at 18:00.
- Symbols you land go into your collection. Points build a weekly tier. A week runs from Sunday 18:00 to the next Sunday 18:00, so the weekly reset and the Sunday draw land together.
- Saving an email earns one extra spin (once, and not again for an address that already earned one). Reminders are logged, not sent.
- Invite a friend (18+/21+): you get 1 bonus spin when they take their first spin, max 2 a week. Friends who invited each other appear on a friends board showing a random nickname, tier, points, trophies and symbols found. Never an email. Nicknames are generated, and anyone can hide from the board.
- A trophy for every triple match. Three trophies in a week reach the Grand tier (a preview: nothing is awarded).
- A rewards preview (loyalty badge, partner offer, Sunday draw, Grand tier) with sample prizes and sample wording. Clearly labelled "Preview. Not live".
- Odds are shown on the play screen, generated from the same weights the engine uses.
- A placeholder responsible gambling block and privacy notice, and a private stats page at `/admin` (needs the `ADMIN_KEY` setting).

## Run it locally
```
npm install
npm run dev        # http://localhost:3000, uses a throwaway in-memory database
```
For a real database, copy `.env.example` to `.env.local` and fill in `DATABASE_URL` and `AUTH_SECRET`.

## Tests
```
npm run verify:engine                      # odds, scoring, the 18:00 reset across daylight saving, age rules
npm run verify:game                        # sets, tier-ups, trophies, the fourth spin, the friends board, recap
npm run verify:stats                       # the stats page numbers against known data
npm run build && npm start &               # then:
npm run verify:smoke                       # end-to-end checks against http://localhost:3000
```

## Deploying on Vercel
1. Import this repo into the `daily-reel` Vercel project.
2. Add a Postgres database from the Marketplace (Neon). It adds `DATABASE_URL` for you.
3. Add `AUTH_SECRET` and `ADMIN_KEY` under Settings > Environment Variables (any long random strings).
4. Redeploy.

## Change the game without touching code
Everything tunable lives in `config/reel.json`: symbols and weights, points, tier thresholds,
spins per day, bonus cap, copy, and the partner-offer card.

## Known limitations (prototype)
- No real prizes. Anything involving prizes needs legal sign-off per market first.
- `nearMiss` in the config is a placeholder switch. The engine does not tune near-misses at all. Needs a responsible gambling / legal decision before anything is added.
- Age check is self-declared, not verified. The US needs 21; the country comes from the visitor's connection, which a VPN can change.
- Players are identified by a signed cookie. Clearing cookies creates a new player (fine with no prizes). Email capture is the path to a durable identity.
- Reminder emails are logged, not sent.
- Self-invite by clearing cookies is possible but capped at 2 bonus spins a week.
