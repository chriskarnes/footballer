# Security plan

Train.futbol's written plan for keeping players' information safe. The
amended COPPA Rule (in force since April 22, 2026) asks for one, kept up to
date. The privacy policy (`/privacy`) says what's kept; this says how it's
looked after. Not a public page.

Draft of November 22, 2026. Everything under "What's in place" was checked in
the code that day; the boxes under "Accounts" are for you to tick once
they're true.

## Who's responsible

- **[Your name]** runs Train.futbol and is responsible for this plan:
  keeping it true, reviewing it once a year, and acting on anything that
  goes wrong.
- Nobody else has access to the database, the hosting or Stripe. Anyone
  given access later is added here first.

## What's kept, and where

| What | Where | Who can read it |
|---|---|---|
| Accounts, profiles, training, notes, agreements | Supabase (Postgres), project `ypcwazerkuvngptprlii` | The player; their academy's trainers; the platform admin |
| The app and its server logs | Vercel, team `i250` | The platform admin |
| Card payments | Stripe (Train.futbol never sees a card number) | The platform admin |
| Sign-in and agreement emails | Resend, for `train.futbol` | The platform admin |
| Code | GitHub, `chriskarnes/footballer` (private) | The platform admin |

The full list of what's kept per person is in the privacy policy.

## What's in place

**Access**
- Every table has row-level security: a player reads their own rows; a
  trainer reads only the players in their own academy; nothing is readable
  signed out except what the public pages show.
- The database's service key (which passes row-level security) is only on
  the server, in Vercel's environment variables, and never sent to a browser
  (`SUPABASE_SERVICE_ROLE_KEY`, never `NEXT_PUBLIC_`).
- Sign-in is by emailed code or link. There are no passwords to leak.
- The admin panel is limited to accounts in the `admins` table, added by
  hand in the database.

**Less to lose**
- Players' names are a first name and last initial. No birthdays, home
  addresses, phone numbers or locations are asked for.
- Players under 13: no photo, club or area, and nothing they type goes to an
  AI service. A parent or guardian agrees before they train (migration 0043).
- The AI services are sent age ranges, positions and session titles, never a
  name, email or photo.
- Stripe is sent the paying account's email and the academy's name, never a
  player's name.
- No advertising or analytics trackers.

**Keeping it no longer than needed** (the daily job, `/api/cron/daily`)
- Accounts unused for a year are deleted.
- Accounts of players under 13 with no agreement after 30 days are deleted.
- Delete account (under Me) removes everything at once.

**Checks**
- GitHub Actions runs the typecheck, the tests and a production build on
  every push to `main`.

## Accounts (tick when true)

- [ ] Two-step sign-in on: Supabase, Vercel, Stripe, GitHub, Resend, and the
      email account those all sign in with.
- [ ] Supabase on a plan with daily backups.
- [ ] `support@train.futbol` receives mail (it's where the privacy policy
      sends people).
- [ ] Nobody else's devices or browsers are signed in to the accounts above.

## If something goes wrong

A leaked key, an account someone else got into, or data seen by someone who
shouldn't have:

1. **Stop it.** Rotate the exposed key (Supabase → Project Settings → API;
   Stripe → Developers → API keys; Resend → API keys), update it in Vercel,
   and redeploy. Sign out other sessions on the affected account.
2. **Find out what was reached.** Supabase logs, Vercel logs, Stripe's event
   log. Write down what happened and when, as you go.
3. **Tell people.** Families whose children's information was reached, and
   trainers whose academies were, in plain words: what happened, what was
   reached, what's been done. Pennsylvania's breach law and others may set a
   deadline; ask a lawyer the same day.
4. **Fix the cause**, and add a line to this plan saying what changed.

## Once a year

- Re-read this plan and the privacy policy against what the app does now.
- Check who has access to each account above, and remove anyone who
  shouldn't.
- Check the daily job is running (Vercel → the project → Cron Jobs).
