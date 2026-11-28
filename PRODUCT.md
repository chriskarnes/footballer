# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Ships as a website built to feel native from a phone browser: safe areas, 44px targets, screen wake lock during a session, offline shell, home-screen install offered once on the third visit. A native (Expo) app is a later step, triggered by the need for push notifications, not by look and feel.

## Users

Design favours a different audience on each surface (owner's call, 2026-11-27):

- **Player app** (`name.train.futbol`, `/train`, `/session`, `/speed`, `/me`): favours the **player**. Youth soccer players, many of them under 13, training at home for 15 to 30 minutes, two to four times a week, around club practice, games and in-person trainer days. The phone is usually on the ground against a cone mid-drill.
- **Coach area** (`/coach`): favours the **trainer**. Independent private soccer trainers who work for themselves with players from different clubs, typically 8 to 40 regular players, each seen about once a week. They already send homework by text or YouTube links. Desktop-first for roster, programs and weekly schedules, still usable on a phone.
- **Marketing site** (apex `train.futbol`: `/`, `/trainers`, `/players`, `/start`): talks to **trainers first**; the player's door ("Find your trainer") is second.

Other audiences:

- **Whoever pays** (often a parent, not always): in academies where families pay, they pay $10 a month by card from `/membership` after the free days.
- **Parent or guardian of an under-13 player**: agrees before the child can train, in the app or from an emailed link.
- **Platform admin** (the owner, `/admin`): approves academy requests and sets who pays per academy.

Not yet served: clubs, team coaches, directors of coaching.

## Product Purpose

Most players see their private trainer about once a week. Train.futbol is for the other six days: the trainer picks drills for players to do at home, and sees who did them.

Success:

- For the business, by day 90 of launch: ten trainers with players training every week. A trainer counts when at least five of their players have joined and at least half of them finish a session in a given week.
- For a player: two to four at-home sessions a week, fitted around their own soccer schedule.
- For a trainer: players arrive at the next session having practised last week's work, so the trainer can move on.

## Positioning

Three things a generic drill app cannot truthfully claim (owner-confirmed):

1. **The trainer's own page.** Each trainer has their own address (`name.train.futbol`), name, colours, logo, drills and videos. Players train with their trainer, not with an app.
2. **The trainer sees who did it.** A closed loop: the trainer picks sessions after the in-person hour, the player does them at home, the trainer sees each finished session and can send a reminder in one tap.
3. **It fits each player's week.** A player taps their club, game and trainer days once; at-home sessions land on the free days automatically. Trainers never maintain a roster-by-day matrix.

AI is a capability, not part of the pitch.

## Operating Context

**Trainer:** asks for a page at `/start` → admin approves → trainer claims it and sets it up (name, colours, logo) → adds their own drills (videos are YouTube links, not uploads), sessions, programs and groups → invites players (by link or by approving a request) → each week picks two or three sessions per player or group, or lets a built week publish. Autopilot publishes built weeks at 3:00 am Monday in the academy's time zone, for active players only. A trainer can mark a player inactive: kept on the roster, not training, not charged for.

**Player:** joins by invite link or by asking → states age before email (under 13 routes to a parent or guardian) → taps soccer days once (each day cycles Off → Trainer → Practice → Game) → sessions are placed on free days, can be moved for one week, and follow into a calendar feed (ICS) → runs a session: a list of drills with the trainer's video playing inline, ticked off one by one. Once a session is finished its ticks are locked; "Do it again" starts a new one.

**Speed & Stamina:** a 12-month program (four phases of three blocks, each block closed by a test day). It is the trainer's choice per player, on by default, with no age gate.

**Demos:** trainers are shown `kestrel.train.futbol`, a made-up academy with original content, reset with `npm run seed:kestrel`. Not `demo`, which holds licensed content.

## Capabilities and Constraints

**Billing** (Stripe, in test mode; live switch pending, steps in `supabase/stripe-go-live.sql`). Set per academy by the admin:

- *Families pay* (default for new academies): free days, then $10 a month unless set otherwise. The public offer says every player's first 7 days are free. An unpaid player sees the way to pay in place of their training.
- *Trainer pays*: $5 per active player a month, billed to the owner from `/coach/billing`. Nothing is locked.
- *Nobody pays*: demo and platform academies.
- Not offered, and not to be promised: trainers setting their own price, a revenue share, or payouts through Stripe Connect.

**AI** (optional, rate-limited in the database):

- Claude turns a typed request into a session spec. Gemini helps build a player's week.
- AI never picks drills: selection is deterministic code over the academy's real drills, so it cannot invent one.
- Planned drill drafting (dictated, or from a pasted link) lands in the drill form for the trainer to check.
- No player's name is ever sent to an AI provider.

**Under-13 protections** (live, migrations 0043 and 0044):

- Every player's name is kept as first name and last initial.
- Under 13: no photo, club, area or typed AI requests, and no training until a parent or guardian agrees.
- A daily job deletes un-agreed accounts after 30 days and unused accounts after a year.
- Nothing a child types or uploads is sent anywhere.

**Licensed content:** the drill library in `data/forge-library.json` (everything except Speed) is licensed and appears only in academies with `library_access` on (`demo` and the owner's private `forge`). It must never reach another trainer's academy, the marketing site, or any public surface. The self-serve space (`play`) holds it only while sign-up there stays closed.

**Standing product decisions:**

- No countdown timer on drills, ever.
- Soccer days are tapped, never asked as a form.
- Invite stays the most prominent trainer action; it is how the product grows.
- Touch estimates are modelled, so they are shown rounded (`~1.2k`), never as exact figures.
- Sign-in, auth and support email run on `train.futbol` (not `train.football`).

**Terminology:**

- "Trainer" in all user-facing copy; the route is `/coach`.
- "Academy" is the data and admin term; trainer-facing marketing says "your page".
- A **session** is a list of drills taking 15 to 30 minutes. A **program** is a sequence of sessions. A **group** is a set of players.
- **Soccer days** are Trainer, Practice and Game.

**Undecided:**

- Founding offer for the first three trainers. 90 free days for their families was a guess, never confirmed.
- Whether a company stands behind Stripe and the terms.
- When sign-up opens beyond trainers the owner knows (after legal review of `/privacy` and `/terms`).
- When self-serve opens, which waits on the owner's own content replacing the licensed library.

## Brand Commitments

- **Name:** Train.futbol, shown as a wordmark. The earlier "Forge" brand and its F mark are retired.
- **The trainer's brand fronts the player experience.** Each academy carries its trainer's name, colours and logo. Train.futbol is the frame, not the face.
- **Payer language (owner's call, 2026-11-18):** pay and locked screens don't assume a parent ("whoever pays for your training", "whoever looks after your membership"). Consent screens say "parent or guardian".
- **Voice:** the current copy is plain and concrete, with short sentences, real numbers and no hype. This is the present style, not a binding rule: the owner wants it free to evolve.

## Evidence on Hand

**Footage:**

- `public/site/session.mp4`: a working trainer's session. Waivers are signed and the footage is already public on that trainer's channels.
- `public/site/goal.mp4`: the owner's child. Cleared.
- `public/site/match.mp4`: the homepage hero. No rights note on file.

**Other material:**

- Photos in `src/assets/site/` (`strike`, `teams`, `group`, `celebrate`). No provenance on file.
- Screenshots of the Kestrel demo in `marketing/screenshots/`, ad creative in `marketing/ads/`.
- Sales and onboarding material in `marketing/` (go-to-market, launch kit, trainer emails, financial outlook).

**Absent, and must not be fabricated:**

- No trainer testimonials, quotes, names, logos or case studies yet. They are planned after "trainer zero".
- No trainer video yet.
- No usage, retention or improvement figures.
- Numbers on the site are arithmetic from the product's own shape ("two or three sessions add 30 to 90 minutes on the ball a week"), not measured results.
- The Kestrel academy and its people are fictional, and its drills have no video.

## Product Principles

1. **The trainer leads; the platform recedes.** A player should feel they are training with their trainer. Every player surface is the trainer's page first.
2. **Say it once, then get out of the way.** Players set their soccer days once and the week fits around them. A session starts quickly and survives a phone lying on the grass.
3. **Close the loop for the trainer.** Whatever a player does should reach the trainer. The trainer's next step (assign, remind, invite) is never buried.
4. **Protect children by default.** Collect the least, keep names short, get a parent or guardian's agreement under 13, and send nothing a child types or uploads anywhere.
5. **Only claim what is true.** Drill selection is deterministic, modelled numbers are rounded, and nothing unbuilt is promised (Connect payouts, own pricing, timers).

## Accessibility & Inclusion

- Contrast is held to WCAG AA. `src/app/globals.css` records where a brand value was overruled for contrast; keep those notes when tokens change.
- Pinch zoom is never blocked (WCAG 1.4.4). Inputs are 16px so iOS doesn't zoom on focus.
- Every control is at least 44px. Reduced-motion preferences are honoured.
- Many players are 9 to 12 years old and use the app on a phone outdoors, often at arm's length.
