# Daily Reel

Free-to-play daily reel game for the GDC AdTech hackathon (Brief 6). No stake, no purchase, no prizes, 18+.

## What it does
- Age gate before the first spin. The date of birth is checked and discarded, never stored.
- 3 spins a day. Every result is decided on the server. The limit is enforced in the database.
- Symbols you land are added to your collection. Points build a weekly tier (resets Monday, UTC).
- Invite a friend (18+): you get 1 bonus spin when they take their first spin, max 2 a week.
- Email capture (reminders are logged only, never sent) and one clearly labelled, fictional partner-offer card.
- Odds are shown on the play screen, generated from the same weights the engine uses.

## Run it locally
```
npm install
npm run dev        # http://localhost:3000, uses a throwaway in-memory database
```
For a real database, copy `.env.example` to `.env.local` and fill in `DATABASE_URL` and `AUTH_SECRET`.

## Tests
```
npm run verify:engine                      # checks the odds match the weights
npm run build && npm start &               # then:
npm run verify:smoke                       # end-to-end checks against http://localhost:3000
```

## Deploying on Vercel
1. Import this repo into the `daily-reel` Vercel project.
2. Add a Postgres database from the Marketplace (Neon). It adds `DATABASE_URL` for you.
3. Add `AUTH_SECRET` under Settings > Environment Variables (any long random string).
4. Redeploy.

## Change the game without touching code
Everything tunable lives in `config/reel.json`: symbols and weights, points, tier thresholds,
spins per day, bonus cap, copy, and the partner-offer card.

## Known limitations (prototype)
- No real prizes. Anything involving prizes needs legal sign-off per market first.
- `nearMiss` in the config is a placeholder switch. The engine does not tune near-misses at all. Needs a responsible gambling / legal decision before anything is added.
- Age check is self-declared, not verified. A 21+ rule for the US is not implemented.
- Players are identified by a signed cookie. Clearing cookies creates a new player (fine with no prizes). Email capture is the path to a durable identity.
- Reminder emails are logged, not sent.
- Self-invite by clearing cookies is possible but capped at 2 bonus spins a week.
