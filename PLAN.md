# Roadmap

## Where the scaffold stands

**Working:** Train Now (chips plus free text via Claude), the library browse, the session
runner with tick-off and touch banking, sign-in, history with "do it again", the schema
with row-level security, and the seed script. Plus the native-feel layer — safe areas, no
rubber-banding, 44px targets, route transitions, screen wake lock, offline shell, icons,
optional third-visit install prompt. `npm run build` is clean, `tsc --noEmit` passes, and
`npm audit` reports zero vulnerabilities.

**Stubbed:** the weekly blueprint screen.

---

## Phase 1 — make it real (a weekend)

1. Create the Supabase project, run `schema.sql`, then `npm run seed`. Until you do, the
   app reads the bundled JSON and nothing persists.
2. Push to GitHub, import to Vercel, add the environment variables. You have a live URL.
3. ~~Add an app icon.~~ Done — `scripts/make-icons.py` generates every size from a single
   definition. Re-run it if the logo changes.

## Phase 2 — the blueprint (the missing screen)

Port the intake from the prototype, but change one thing: **do not open with ten
questions.** Pre-fill from what you already know and ask only the gaps.

Prefill sources, in order:

- `profiles` — position, foot, level, equipment, if they have set them.
- **Their history.** The focus areas they actually train become the default weaknesses;
  their typical session length becomes the default minutes; the days they have trained
  become the default availability.
- Only then ask.

The generator needs: availability per weekday (`rest | technical | physical | both`),
weakness weighting with the first weakness weighted highest, season phase driving session
length, equipment filtering, and an injury flag that excludes high-intensity sessions.
Write the result to `plans` and `plan_days`.

The prompt that offers this at the right moment already exists on `/me` — it appears once
a player has completed three sessions.

## Phase 3 — retention

- A **Today card**: "Wednesday — Finesse Finishing, 28 min, Start".
- **Streaks and a weekly touch total**; the data is already in `workouts`.
- **Push notifications.** Android delivers these from the browser today. iOS only delivers
  to an *installed* PWA, which is precisely the audience the web-first launch avoids
  depending on — so treat real push as a Phase 5 feature, not a Phase 3 one.

## Phase 4 — content quality

- **Resolve the 72 placeholder drill names** ("EXERCISE 1"…) from their YouTube titles.
  These are user-visible in the library and are the weakest data you have.
- **Real photography** to replace the gradient art on the category cards.
- **Video thumbnails** via `https://i.ytimg.com/vi/<id>/hqdefault.jpg` — already allowed
  in `next.config.mjs`.

## Phase 5 — native

The domain logic (`lib/session-builder.ts`, `lib/types.ts`, `lib/haptics.ts`) is
framework-free and moves over as-is. Expo plus React Native, sharing the Supabase backend
and the same `/api/coach` route.

**The trigger is push notifications**, not impatience. The web build already covers the
native feel; what it cannot do is reach a player who hasn't opened it. Wrap when reminders
are the thing standing between you and retention — and note that Apple rejects wrappers
with no native surface, so shipping push and haptics *is* what gets it through review.

---

## Things worth deciding early

**Ownership of the touch model.** The estimates carry `duration_confidence` and are
deliberately rounded, because they are modelled rather than measured. Keep showing them
as `~1.2k` rather than exact figures, and keep the "team practice yields a few hundred"
line — it frames the number as a comparison rather than a promise.

**Free versus paid.** Comparable apps sit at $9.99–19.99 per month. The natural free tier
is Train Now plus the Library; the natural paid tier is history, the blueprint and
progress. The gate is already in the right place architecturally, because `Train` needs
no account.

**Who the account belongs to.** Under-13 users need a parent-held account under COPPA.
Worth resolving before launch, since it changes signup.
