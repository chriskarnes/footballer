# Launching Forge

`SETUP.md` gets the app onto a URL. This document is about the other kind of launch — the
one where strangers' kids use it and, eventually, someone pays you. They are different
problems, and the second one has a few things in it that will stop you cold if you find
them on the day rather than now.

Read the blockers first. Three of the five have to be settled before a single outside
family touches this.

---

## Part 1 — What has to be true before you launch

### 1. COPPA. This is the big one.

Your users are children. The Children's Online Privacy Protection Act applies to any
online service **directed to children under 13**, and separately to any general-audience
service that has **actual knowledge** it is collecting personal information from an
under-13. Forge is squarely in the first bucket — a youth soccer training app is directed
to children by any reading. The FTC amended the Rule in April 2025, which tightened
retention limits and disclosure requirements; it did not loosen anything.

What that means concretely: before you collect an email address from a 10-year-old, you
need **verifiable parental consent** — a step meaningfully stronger than a checkbox.

You have three honest options, in ascending order of work:

**(a) The parent holds the account.** Signup is for a parent or guardian; the player is a
profile inside it. This is the standard youth-sports pattern, it is the one I would pick,
and it costs you a paragraph of copy plus a `profiles.role` column. It also happens to be
the right business model — parents are the ones with the credit card, and the parent
becomes the person who gets the "Jack trained 4 times this week" email that drives
retention.

**(b) 13+ only.** An age gate at signup, under-13s blocked. Simplest legally, but it cuts
out a large part of your market, and a neutral age gate that kids can lie past is thin
protection when the app is obviously aimed at them.

**(c) Full VPC flow.** A $0.50 card verification, a signed consent form, a government-ID
check, one of the FTC-approved methods. Real work, real cost, right answer only at scale.

There is a fourth thing worth knowing: **Train Now needs no account today**, and that is a
genuine COPPA asset. A kid can use the core product without you collecting anything. Keep
it that way. The gate belongs exactly where the architecture already puts it — at history,
the blueprint and progress, which is also where the paid tier belongs.

**Decide this before you write the signup copy, not after.** It changes the schema, the
onboarding flow, the privacy policy and who your marketing talks to.

### 2. Vercel Hobby stops being legal the day you charge

Hobby is free forever and generous — 1M edge requests, 100 GB transfer — but the licence
is **personal, non-commercial use**. The moment Forge takes money, you need Pro at
**$20/month per user**. This is not a technical wall you will hit; it is a term you will
be in breach of. Budget it as a launch cost, not a scaling cost.

### 3. Free Supabase projects pause after a week of idle

Fine while you build. Not fine when a parent opens the app on a Sunday morning and gets an
error because nobody trained all week. **Supabase Pro is $25/month** and the un-pausing is
the reason to buy it, well before you approach the 500 MB / 50,000 MAU limits — your whole
library is under a megabyte.

So your fixed floor at launch is **$45/month**, plus a few dollars of Anthropic credit.
That is the real number. Everything else is optional.

### 4. The weekly blueprint is still a stub

`/plan` renders a placeholder. You can absolutely launch without it — the plan was always
to lead with Train Now because the blueprint is the most onerous step — but decide
deliberately whether it ships hidden or ships as "coming soon". A visible dead tab reads
as an unfinished product; a hidden one reads as a focused one. `PLAN.md` Phase 2 has the
build.

### 5. 72 drills are literally named "EXERCISE 1"

These are visible in the library. They are the single most obviously unfinished thing a
new user can find, and they're cheap to fix — most have a YouTube link whose title is the
real name. Do this before anyone outside sees it. `PLAN.md` Phase 4.

---

## Part 2 — Going live

### A domain

`forge-training.vercel.app` is fine for testing and wrong for launch. Buy the name, add it
in Vercel under **Settings → Domains**, point the nameservers, and — this is the step
people forget — update `NEXT_PUBLIC_SITE_URL` and the Supabase **Authentication → URL
Configuration** redirect entry to match. Miss the second and every magic-link email sends
players to the old address.

### Legal pages

A privacy policy and terms of service. With children involved the privacy policy is not
boilerplate: it has to say what you collect, why, how long you keep it, and how a parent
can review or delete it. Termly and iubenda both generate COPPA-aware policies for a few
dollars a month, which is a reasonable starting point — but read the output, because a
generator does not know that you store training history against a minor's profile.

Also add a real support email. Store review and app-review processes both ask.

### Taking money

**Stripe**, standard rate **2.9% + $0.30** per successful online card charge, plus **0.7%
of billing volume** if you use Stripe Billing pay-as-you-go for subscription management.
No monthly minimum, no contract. On a $12.99 subscription that's about $0.77 all in.

Selling through the web rather than an app store also means **no 15–30% platform
commission** — which is a real argument for staying on the web longer than you might
otherwise, not just a convenience.

Pricing: comparable individual-training apps sit at **$9.99–19.99/month**. Your natural
split is already built:

| Tier | What's in it |
|---|---|
| **Free** | Train Now, the full library, the session runner |
| **Paid** | History, "do it again", the weekly blueprint, progress and streaks |

Give the paid tier away for the first cohort. You want usage data and testimonials far
more than you want $13 from a friend's parent.

One thing to get right early: **annual pricing**. Youth sports run in seasons, and a
season-length commitment converts better than monthly for a product a parent buys on the
kid's behalf.

### Analytics you'll actually use

Vercel Analytics is a checkbox and privacy-friendly. The only two numbers that matter at
this stage: **how many people start a session**, and **how many finish it**. If the second
is far below the first, the sessions are too long — which is a data problem you can fix in
`session-builder.ts`, not a marketing problem.

---

## Part 3 — Web, shipped native-feeling

**The decision: launch as web, and make the web feel native rather than asking anyone to
install anything.** Asking a parent to find the Share button in Safari is a real conversion
cost and it buys almost nothing, so Forge doesn't require it. A player opens a link and it
behaves like an app.

What that is made of is documented in `README.md` under *"Feels native, no install"* —
safe-area layout, no rubber-banding or pull-to-refresh, no double-tap zoom, no
text-selection handles on buttons, 44px targets, animated screen transitions, a screen wake
lock that runs the whole session, and an offline shell. Install is offered once, on the
third visit, and never again if declined.

### The ceiling, honestly

Four things the web genuinely cannot do, so you can judge whether any of them matter yet:

| | Where it stands |
|---|---|
| **Push notifications** | Works from the browser on Android. **iOS only delivers push to an *installed* PWA** — so the reminder that builds a training habit reaches exactly the players who did the install step you were avoiding. This is the real reason to wrap, and the only one that will bite. |
| **Haptics** | Android works. iOS Safari has no Vibration API and there is no honest workaround, so `lib/haptics.ts` no-ops there and the visual press state carries the feedback. |
| **Store search** | A parent searching "soccer training" in the App Store will not find you. |
| **Background timing** | A session timer stops when the phone locks. The wake lock covers the normal case — phone propped against a cone — but not a genuinely backgrounded app. |

Push is a *later* problem: reminders only matter once you have players who would come back,
and you don't have those yet. When that changes, wrapping is the next step, and it is not a
rewrite.

### When you do want the stores

| | Cost | Catch |
|---|---|---|
| **Apple** | **$99/year** developer program | Digital subscriptions sold inside the app must use Apple's in-app purchase, at **15%** under the Small Business Program (you qualify — it's for under $1M in proceeds, and new developers are eligible) rather than 30% |
| **Google** | **$25 one-time** registration | A **personal** account must run a closed test with **12 testers for 14 days** before production access. Registering as an organisation avoids this — worth doing if Forge is a business |

Apple also rejects wrappers that are "just a website" under the minimum-functionality
guideline, so a shell needs real native surface — push, haptics, offline — to pass review.
Which is fine, because those are exactly the reasons you'd be wrapping.

`PLAN.md` Phase 5 has the path: the domain logic in `lib/session-builder.ts` and
`lib/types.ts` imports nothing from React, Next or the network, so it moves to Expo
unchanged and only the screens get rewritten.

---

## Part 4 — The first hundred users

You are not launching to the internet. You are launching to youth soccer, which is a
network of clubs, coaches and parent group chats — a much easier target than it sounds,
because those groups already talk to each other constantly. A web link is also the *right*
format for that network: it forwards into a group chat and opens on tap, where an App Store
listing needs a download before anyone sees anything.

**Start with one team.** Not a club, a team. Give the coach the URL and the free tier, and
ask for one thing: that the players log what they do for two weeks. You will learn more
from watching twelve kids abandon a 30-minute session at minute eight than from any amount
of design work.

**Lead with the number, because it is your whole argument.** *A team practice gives your
kid a few hundred touches. Twenty minutes alone with Forge clears a thousand.* That line
does the selling. It is concrete, it is checkable, and it names a problem parents already
half-suspect. Put it above the fold and put the touch count on the session card — which it
already is, at 46px.

**Where these people actually are:** club team parent chats (GroupMe and Band, mostly),
trainers who run private sessions and want to give players homework, r/bootroom and
youth-soccer parent Facebook groups, and coaches directly — a coach who hands out
"homework" is your best distribution channel because the ask comes with authority.

**The order of operations that works:** one team → their feedback → fix the obvious thing
→ that coach introduces you to two more → then the club. Do not start with a club
director; you have nothing to show them yet.

### A realistic first month

| Week | What happens |
|---|---|
| 1 | Fix the 72 names. Decide the COPPA account model. Domain, privacy policy, Vercel Pro, Supabase Pro. |
| 2 | One team on the free tier. Watch completion rates. |
| 3 | Fix the top complaint. It will probably be session length or a drill that doesn't make sense without video context. |
| 4 | Second and third team. Now the blueprint is worth building, because you have history to pre-fill it from. |

Charging comes after that, and only once someone has asked you to.

---

## The one-paragraph version

Settle who owns the account for an under-13 player, because COPPA makes that a legal
question rather than a design preference, and the parent-holds-the-account answer is both
the compliant one and the commercially correct one. Fix the 72 placeholder drill names.
Buy a domain, move to Vercel Pro and Supabase Pro — $45/month, and Vercel Pro is required
the moment you charge, not optional. Ship as web: it now behaves like an app from a link,
so nobody has to install anything, and you keep the 15–30% a store would take. Then give it
to exactly one team, free, and watch whether they finish the sessions.

---

*Fees verified August 2026: [Apple Developer Program](https://developer.apple.com/programs/whats-included/),
[App Store Small Business Program](https://developer.apple.com/app-store/small-business-program/),
[Google Play registration](https://support.google.com/googleplay/android-developer/answer/6112435),
[Stripe pricing](https://stripe.com/pricing),
[FTC children's privacy guidance](https://www.ftc.gov/business-guidance/privacy-security/childrens-privacy).
None of this is legal advice — the COPPA section in particular is worth twenty minutes
with a lawyer before you take a payment.*
