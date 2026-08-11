# Forge — Elite Accelerator

Individual soccer training built on a parsed library of **786 drills, 161 sessions,
17 programs**, each with estimated minutes, estimated ball touches, and a demo video.

The product thesis in one line: **most youth players get a few hundred touches at a team
practice; a focused 20 minutes alone can clear 1,000.**

---

## The three doors, in priority order

| # | Tab | Job | Analogy |
|---|-----|-----|---------|
| 1 | **Train** | Say what you have, get a session, start | "Order again" |
| 2 | **Library** | Browse every drill and programme | "The menu" |
| 3 | **Plan** | A repeating weekly blueprint | "Recurring order" |

`Train` is the front door and needs **no account**. `Me` (history / do-it-again) and
`Plan` are the reasons to sign up, offered *after* the player has felt the value — the
weekly blueprint is the biggest ask, so it comes last and its intake should be pre-filled
from history rather than asked cold.

---

## Getting it live

**→ `DEPLOY.md`.** GitHub → Vercel → your own domain, fifteen minutes, no database and no
API key. Everything except sign-in and the free-text box works with zero configuration.
`SETUP.md` then adds Supabase for accounts and history.

There is **no install step**. Forge ships as web and is built to feel native from the
browser — see *"Feels native, no install"* below. Adding it to the home screen is offered
once, on a player's third visit, and is purely optional.

## Launching it to real users

**→ `LAUNCH.md`.** Deploying and launching are different problems. That covers what has to
be settled first — COPPA and who owns a child's account, the Vercel non-commercial rule,
Supabase pausing, the placeholder drill names — then domains, Stripe, what the web
genuinely can't do, and how to get the first hundred players.

## Quickstart (local dev)

```bash
npm install
cp .env.example .env.local     # fill in the values below
npm run dev                    # http://localhost:3000
```

The app runs **without Supabase configured** — the library falls back to the bundled
`data/forge-library.json`, so you can develop the UI before touching a database.
Sign-in, history and saving need Supabase.

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com) (the free tier is plenty).
2. **SQL Editor** → paste and run `supabase/schema.sql`. That creates the tables,
   indexes, row-level-security policies and the signup trigger.
3. **Project Settings → API** → copy the URL, the `anon` key and the `service_role` key
   into `.env.local`.
4. Seed the library:
   ```bash
   npm run seed
   ```
5. **Authentication → Providers**: email is on by default (magic link). To add Google,
   enable it and paste in your OAuth client. Add your production domain under
   **Authentication → URL Configuration → Redirect URLs** as
   `https://your-domain.com/auth/callback`.

### 2. Anthropic (the AI coach)

Get a key from [console.anthropic.com](https://console.anthropic.com) and set
`ANTHROPIC_API_KEY`. Without it the chips still work — only free-text parsing is disabled.

### 3. Deploy to Vercel

```bash
git init && git add -A && git commit -m "Forge"
gh repo create forge-training --private --source=. --push   # or push via the web UI
```

Then on [vercel.com](https://vercel.com): **Add New → Project → import the repo**.
Next.js is detected automatically; there are no build settings to change. Add the same
environment variables under **Settings → Environment Variables**, set
`NEXT_PUBLIC_SITE_URL` to your Vercel URL, and deploy. Every push to `main` ships.

> Netlify works too (`@netlify/plugin-nextjs`), but Vercel builds Next.js and needs zero
> configuration, so it is the shorter path.

---

## Architecture, and why

### The AI does not pick drills

`/api/coach` sends the player's message to Claude with a **single tool** whose schema is a
`SessionSpec` — minutes, focus areas, place, level, priority. The model's only job is to
turn *"20 min, first touch, at home before practice"* into that struct. **Drill selection
happens in `src/lib/session-builder.ts`**, in ordinary TypeScript.

That split matters:

- **Deterministic** — the same spec always yields a comparable session.
- **Cheap and fast** — one small call per message, not one per drill.
- **Impossible to hallucinate** — the model cannot invent a drill that isn't in the library.
- **Testable** — selection is a pure function you can unit-test.

### The logic is portable

`src/lib/session-builder.ts` and `src/lib/types.ts` import nothing from React, Next or the
network. When you build the React Native app those files move across unchanged and only
the screens get rewritten.

### Feels native, no install

The product ships as web, and the target is that a player opening a link in Safari cannot
easily tell it isn't an app. That is not one feature — it's a list of removed tells, and
each one is small enough to skip and loud enough to notice:

**Layout.** `viewport-fit=cover` plus `.safe-t` / `.safe-b` / `.pad-nav` in `globals.css`,
which use `max(…, env(safe-area-inset-*))` so content sits under the notch and the floating
tab bar clears the home indicator — and still lays out correctly on a device with no insets
at all.

**Touch.** `overscroll-behavior-y: none` kills rubber-banding and pull-to-refresh.
`touch-action: manipulation` removes double-tap zoom and with it the 300ms click delay.
`-webkit-tap-highlight-color: transparent` removes the grey flash. `user-select: none` on
chrome (text content opts back in) stops a long press from raising a selection handle.
Every control clears 44px.

**Zoom, carefully.** There is deliberately no `maximum-scale=1` — blocking pinch zoom fails
WCAG 1.4.4 and iOS ignores it anyway. Instead every input is 16px, because anything smaller
makes iOS zoom the page on focus and never zoom back.

**Motion.** `app/template.tsx` remounts on navigation and runs `.page-in`, so screens lift
in rather than blink. `.pressable` is fast-in / slow-out, the way iOS presses behave.

**The screen stays on.** `lib/use-wake-lock.ts` holds a Screen Wake Lock while a session is
running and re-acquires it on `visibilitychange`. The phone is on the ground against a cone
for most of a session; having it lock mid-drill is the most app-unlike thing that can
happen. Works in a plain browser tab, no install.

**Offline.** `public/sw.js` is deliberately tiny: cache-first for `/_next/static/*` (those
filenames are content-hashed, so a cached copy can never be stale) and network-first for
everything else, with an `/offline` fallback. API and auth routes are never cached.

**Haptics** are `lib/haptics.ts`, and honestly no-op on iPhone — Safari has no Vibration
API. The visual press state carries the feedback there. Real iOS haptics need the native
wrapper; see `LAUNCH.md`.

**Install is optional**, offered on the third visit and never again once declined
(`components/InstallNudge.tsx`). Android gets a real one-tap install via
`beforeinstallprompt`; iOS gets the Share → Add to Home Screen walkthrough, with the Share
glyph drawn rather than named.

### Colour

Sampled from the EE Forge logo: gold `#FEDD39`. It is only **1.34:1 on white**, so it is
used exclusively as a *fill* with near-black ink (14.9:1). Indicators step down the same
hue to `#A88C00` (3.27:1) and accent text to `#8A7300` (4.63:1). Those three tokens are in
`tailwind.config.ts` as `gold`, `goldUi`, `goldText` — please keep the distinction.

### Data

`data/forge-library.json` is generated by the PDF-parsing pipeline (shipped separately).
To refresh the library after re-parsing, replace that file and re-run `npm run seed`.

---

## Layout

```
src/
  app/
    page.tsx                  Train Now — the front door, no auth
    library/                  Browse: categories → programmes → sessions
    session/[id]/             The runner: tick drills off, bank touches
    me/                       Sign-in, history, "do it again"
    plan/                     Weekly blueprint (stub — see PLAN.md)
    offline/                  Shown by the service worker with no connection
    template.tsx              Route-change animation (remounts per navigation)
    manifest.ts               Served at /manifest.webmanifest
    api/coach/                Claude → SessionSpec
    api/workouts/             Save history / mark complete
  components/                 Coach, SessionCard, Runner, TabBar, SignIn, Brand
    InstallNudge.tsx          Third-visit "add to home screen", dismissable forever
    ServiceWorker.tsx         Registers /sw.js in production only
  lib/
    session-builder.ts        ← portable: drill selection, swap, touch maths
    types.ts                  ← portable: the domain model
    haptics.ts                ← portable: no-ops on iOS, honestly
    use-wake-lock.ts          Keeps the screen on mid-session
    library.ts                Supabase reads with a bundled-JSON fallback
    supabase/{client,server}  Split so next/headers never reaches the browser bundle
public/
  sw.js                       Offline shell
  icon-*.png                  Generated by scripts/make-icons.py
supabase/
  schema.sql                  Tables, indexes, RLS, signup trigger
  seed.ts                     Loads the library into Postgres
```

## Costs at small scale

Vercel Hobby, Supabase Free and pay-as-you-go Anthropic usage cover an early user base;
the coach call is a few hundred tokens per message. Move to paid tiers when you need
backups, team domains, or more than the free row limits.

## What's next

See `PLAN.md`.
