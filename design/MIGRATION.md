# Train.futbol — Material Design 3 migration brief

Companion to `train-futbol-harness-m3.html`. The harness shows *what* the system
is; this says what changed against the current code, in what order to land it,
and which questions still need a human.

---

## Source of truth

| Layer | File | Status |
|---|---|---|
| Tokens | `tailwind.config.ts` *(or `@theme` in CSS if we're on Tailwind v4)* | not migrated |
| Components | `src/app/globals.css` | not migrated |
| Screens | `src/app/page.tsx`, `library/page.tsx`, `plan/page.tsx`, `me/page.tsx` | not migrated |
| Coach | `src/components/Coach.tsx` | not migrated |

**Check the Tailwind major version first.** v3 puts tokens in `tailwind.config.ts`;
v4 puts them in an `@theme` block in CSS. This changes where stage 1 lands.

---

## Stage 1 — tokens only

Port the custom properties from the harness `<style>` block. Nothing else.

- `--md-sys-color-*` — light scheme in `:root`, dark scheme in **both** the
  `prefers-color-scheme` query and the `[data-theme="dark"]` selector. The app
  should follow the OS; the `data-theme` attribute is a harness affordance, so
  decide whether we want a manual override in the product before copying it.
- `--md-sys-typescale-*`, `--md-sys-shape-*`, `--md-sys-elevation-*`,
  `--md-sys-motion-*`, `--md-sys-state-*`
- `--app-*` — deliberately not `md.sys`, because M3 doesn't define these.
  Keep the namespace so it stays obvious which tokens are ours.

**Keep the comments.** They record three places a Forge value was overruled
because it failed contrast, and re-deriving that later costs more than the
diff noise.

### Tokens that no longer exist

`--gold`, `--gold-ui`, `--gold-text`, `--gold-soft`, `--ink`, `--page`,
`--surface`, `--surface-2`, `--line`, `--body`, `--muted`, `--faint`,
`--r-card`, `--r-btn`, `--r-pill`, `--shadow-card`, `--shadow-lift`,
`--shadow-nav`, `--shadow-gold`, `--font-display`, `--font-text`,
`--track-tightest`, `--track-tighter`, `--ease`

Also grep for `forge` generally — the brand is now **Train.futbol**, the `F`
icon mark is gone in favour of a wordmark, and the token namespace moved from
`--forge-*` to `--app-*`. There is no favicon in the harness to remove; if one
exists in the app it's in `public/` or the Next.js `app/` metadata export.

After stage 1, grep the repo for these. Every hit is an unmigrated call site.
`--shadow-gold` had no callers and no M3 equivalent; it's simply gone.

### Palette provenance

The whole scheme derives from one source hue — HCT 255, chroma 42 — through
Google's `material-color-utilities`. Neutrals are the same hue at chroma 3.
Tertiary is pinned to hue 225 rather than M3's default source+60, which lands
on magenta. If the brand colour ever moves, regenerate from the new source
rather than hand-editing tones.

---

## Stage 2 — components

Class names in the harness match `globals.css` deliberately, so most of this is
a copy. The exceptions:

**Renames (the only non-copy lines):**
- `.tag-gold` → `.tag-accent` — 3 call sites in the harness, unknown in the app
- `.btn-gold` → `.btn-accent` — 0 call sites, free

**New classes:**
- `.day` / `.day-on` — replaces seven copies of an inline selection style on Plan
- `.sheet`, `.sheet-scrim`, `.sheet-handle`, `.sheet-head`, `.sheet-body`,
  `.sheet-actions`, `.icon-btn` — the program modal
- `.segmented` / `.segment` / `.segment.on` — the Train mode switch and the
  dominant-foot picker
- `.app-bar` / `.hero` — screen-level landmarks. The Train header and hero were
  loose siblings held apart by a margin, with a `15ch` measure on the h1 that
  made it break narrower than the cards beneath it
- `.text-field` — M3 outlined text field. Uses `corner-small` rather than the
  spec's `extra-small` (4dp), which reads as a mistake next to 20dp cards
- `.progress` — M3 linear progress, used for profile completion
- `.pressable::after` — the M3 state layer

**Behaviour changes to expect in review:**
- Chip and day selection is now a `secondary-container` fill plus a checkmark,
  replacing the border-and-ink rule
- `.card` is an M3 elevated card and **lost its border**; `.card-flat` is the
  outlined variant
- Focus rings exist now — there were none
- Eyebrows, inactive tabs and captions are visibly darker (`--faint` failed
  WCAG at every size it was used)
- Control outlines are visibly heavier (the old `--line` was 1.23:1)

---

## Stage 3 — screens

**Do not port the harness markup.** It's five mocked screens with sample data
and a handful of real rows, not the app. Port the *system*; the components are
already ours.

Three screens have real content or structure changes.

### Library

1. Hero is now `Training Programs`, single line
2. Spelling normalised to US "program" — headings said "programme" while card
   titles already said "Program"
3. Program rows no longer show a minute total. Per-drill minutes on the Train
   screen stay — that's the level where the number helps
4. Program rows are `<button>`, not `<a href>`. They open a dialog, not a
   destination
5. A program opens in a modal bottom sheet — see port notes below

### Train

Brand: `Forge` wordmark and `F` icon → `Train.futbol` wordmark, no icon.
Hero copy: "Start training right now" → "Start training now".
The header and hero are now `<header class="app-bar">` and `<section
class="hero">` rather than loose divs, and the narrow measures are gone.

#### Mode switch

The coach input and the build-your-session form used to stack, which read as
"try the AI, and if that failed, here's a form." They aren't steps. They're two
inputs to one output.

- A single-select **segmented button**, not tabs. M3 tabs navigate between peer
  content views and imply that what's underneath belongs to the tab. Tabs here
  would also stack a second navigation bar directly above the real one
- **The ARIA is `tablist`/`tab`/`tabpanel` anyway.** To a screen reader this
  genuinely is a set of panels where one is shown. Component and role are
  allowed to disagree — the harness script keys off `role="tablist"` to decide
  which behaviour a `.segmented` group gets
- **"Your session" sits outside both panels, deliberately.** Switching mode
  must not clear an already-generated session
- **What you typed in one mode survives a trip to the other.** Hide panels,
  don't rebuild them
- The AI-specific promise copy moved out of the hero and into the AI panel
- "Surprise me" moved inside the AI panel as a secondary action — it was
  reading as a third route
- The DIY panel's chip groups should be **single-select for time and focus,
  multi for equipment.** The harness wires this loosely via `[data-single]`

### Me — empty state

New screen (`4b` in the harness). The populated version is unchanged.

**The model it assumes:** parent signs up and owns the account, player uses the
app, one player per account. Copy is addressed to the player because the player
is who answers it.

Four required questions, each stating what it changes: name, age band,
position(s), dominant foot. Region and Club are below a line, marked optional,
because neither changes a single drill. If they do feed something, move them up
and give them a reason.

- No stats row in the empty state. A 0 / 0m / 0 version of the populated screen
  reads as failure rather than a new start
- Name is first-name-or-nickname on purpose. A full legal name adds nothing to
  a drill plan and a lot to the blast radius of a leak
- The under-13 line sits at the age question, not the footer — that's where it
  becomes relevant
- The dominant-foot picker reuses `.segmented` but with `radiogroup` roles;
  nothing is revealed by choosing, so there's no panel to point at

### The sheet — port notes

The harness hand-rolls the dialog because `showModal()` escapes a 393px phone
mock. **In the app, use a real focus-trapping dialog** — native `<dialog>` or
Radix. Keep these behaviours:

- The sheet covers the navigation bar and the scrim absorbs taps aimed at it.
  This is the actual fix — accidental navigation to Plan becomes impossible,
  not merely unlikely
- Three exits: close button, scrim tap, Esc
- Esc stands in for the Android back gesture — wire the real one to the same
  handler
- Focus moves to the close button on open and returns to the originating card
  on close
- The list behind is `inert`, not merely covered

The drag handle is spec-correct at 32×4dp but is currently an affordance with
nothing behind it. Drag-to-dismiss needs a gesture handler.

## Open — needs a decision, not a commit

### Product

1. **The signup handoff.** A parent who finishes signup and hasn't passed the
   phone over will read "How old are you" and answer about themselves. The fix
   is one line at the end of the signup flow telling them to hand it on. It
   belongs there, not on the profile screen, but without it the age data
   quietly fills with adults.
2. **Verifiable parental consent.** COPPA means an actual verification method,
   not a signup form a parent happened to fill in. The child is the one typing
   into the profile, so consent has to have been obtained upstream. Worth
   checking what account creation does today.
3. **Age band boundaries** (Under 10 / 10–12 / 13–15 / 16–18 / 18+) are a
   guess. If the drill library is graded to specific age groups, match it.
4. **The DIY panel's contents** are a guess too — time, focus, equipment.
   Three chip groups is already a lot of screen. Some of these may want to
   default from the last session rather than being asked every time.
5. **Mode memory.** Train opens on AI every time. Right for a new user,
   friction for someone who always builds manually.
6. **Seats.** One player per account is the current model. When it changes, the
   stats on Me, the plan, and the session history all become per-player — a
   change to the shell, not to one screen.

### Design system

7. **`inverse-surface` inverts.** The signature dark card is navy in light mode
   and turns powder blue in dark, because that's what the role means. If navy
   should stay navy in both schemes, that's a custom colour pair, not
   `inverse-surface`. Roughly ten lines either way.
8. **The dark scheme has never been on a device.** Algorithmically sound and
   contrast-checked, but nobody has looked at it.
9. **Category colours.** The three Library gradients are `--app-category-*`
   extensions. M3's proper mechanism is a custom colour per category, each with
   its own tonal palette and container roles.
10. **Button shape.** M3 buttons default to fully rounded; ours are 16px
    rectangles (Expressive's square variant). Kept because it's what makes
    `.btn-primary` read as a block rather than a chip — but it is a deviation.
11. **Motion.** M3 Expressive replaced easing-and-duration with spring physics,
    which CSS can't express. The harness ships Material Web's fallback and
    keeps Forge's original curve as `emphasized-decelerate`.

## Verification

Contrast was checked pair by pair in both schemes. Tightest is `outline` at
4.27:1, which clears the 3:1 WCAG asks of a control boundary; every text pair
is above 6:1. Worth re-running after any token edit — the failures we fixed
(2.84:1 body text, 1.23:1 control borders) were invisible until measured.
