# To do

Left over from the tenth audit (November 14, 2026). The audit's fixes, migrations
0034–0036 and the privacy and terms pages are all live; these are what was not
done, or could not be checked from here.

## 0. Before launch (launch review, November 22, 2026)

Accounts and settings outside the code, checked from here on that day. Plan:
a soft launch with trainers you know until the legal review (§3) is back.

- [ ] Vercel: the `i250` team is on **Hobby**, which is for non-commercial use
      only. Move to Pro before the first real payment.
- [x] `support@train.futbol` can't receive mail: train.futbol has no MX record,
      and the privacy page, terms, Membership and Billing all send people there.
      Add forwarding (or an inbox) in Vercel DNS, then send it a test message.
- [x] Add a DMARC record at `_dmarc.train.futbol` (none exists). To start:
      `v=DMARC1; p=none; rua=mailto:support@train.futbol`.
- [ ] Supabase: check which plan the project is on. Pro adds daily backups.
      Also Authentication → Rate Limits: the email cap starts low with your own
      SMTP, and a group signing up the same evening can hit it.
- [ ] Stripe: once §1b passes, switch to live with `supabase/stripe-go-live.sql`
      (the steps are at the top of that file).
- [ ] Turn on Stripe's emails for failing webhooks. Nothing else alerts on
      errors, and Hobby keeps server logs for about an hour.
- [ ] Decide the founding offer for the first three trainers (90 free days for
      their families was a guess, never confirmed), and whether there's a
      company behind Stripe and the terms.

**Under-13 protections (built and live November 22, 2026)**

- [x] Run migration `0043_children.sql` after the app is deployed. It also cuts
      existing players' names to a first name and last initial, and removes
      under-13s' photos, clubs and areas.
- [x] Vercel env: `RESEND_API_KEY` (an API key from the Resend account that
      sends the sign-in emails). Without it, nothing is emailed: no parent
      requests, no confirmations, and players under 13 on their own accounts
      aren't asked.
- [x] Vercel env: `CRON_SECRET` (any long random string). Without it the daily
      job (`/api/cron/daily`: confirmations, deleting unagreed and unused
      accounts) refuses to run. Check it under the project's Cron Jobs.
- [x] Redeploy after adding both.
- [x] Leo (your Kestrel sign-in) marked as agreed, straight in the database so
      nothing else was reset. Re-running `npm run seed:kestrel` does the same.
- [x] Cole's account in forge is under 13 and will be asked: enter your own
      email as the parent's (not the +cole alias it signs in with) and agree
      from the link. That's also the test of the whole email flow. Agreed by
      the emailed link on November 24, 2026; the confirmation email follows
      with the daily job on the 25th.
- [ ] Fill in your name in `SECURITY-PLAN.md` and tick its account boxes.
- [x] Run migration `0044_children_rules.sql` after the app is deployed (the
      database's own under-13 rules, and the email cap's counts). Before then
      the app works as it did, just without those.

**From the second launch review (November 23, 2026)**

- [x] The daily job holds back whenever it can't read something, checks the
      admins list, and doesn't delete anyone while Stripe isn't set up.
- [x] The under-13 rules are enforced by the database too (0044).
- [x] An age picked by mistake: the profile form warns before it's saved,
      and an admin puts it right (admin → the person → Age).
- [x] Parent request emails: three a day per account, 200 a day in all.
- [x] Mail to `support@train.futbol` now arrives in Resend (its MX record
      points there). Send it a test and check where it shows up; set up
      forwarding if you want it in your own inbox.
- [ ] Later, with hundreds of players under 13: the daily job's 30-day count
      sends every under-13 id in one request, and accounts it holds back
      stay at the front of the deletion queue. Fine at today's numbers.

## 1. Check the changed flows on a real phone and account

None of this was tested signed in or against the live database. About ten minutes.

- [ ] Finish a session with the phone in airplane mode. Turn signal back on and
      confirm it appears in history, once.
- [ ] Sign in, wait over an hour, open the app in airplane mode. Pages and Speed
      results should still be there.
- [ ] As a trainer, add a player to a group mid-week. Their sessions should start
      from that day, not read as missed.
- [ ] Build a player's week, let them finish one session, then switch them
      "Back to program". The count should hold, and the program should give what
      is still owed.
- [ ] On a throwaway account, try "Leave" and "Delete my account" under Me.
      Delete cannot be undone.

## 1b. After the eleventh audit (November 17, 2026)

Billing was audited and fixed in code; none of it was run against Stripe.

- [x] Run migration `0042_audit_eleven.sql` (after the app is deployed).
- [ ] In Stripe test mode, on a throwaway player: add a card and confirm the
      Membership page shows "Active" straight away; have the trainer make the
      player inactive and active again (the subscription should pause and
      resume, not cancel); remove the player (it should cancel).
- [ ] In admin, switch a test academy from "Families pay" to "Nobody pays" and
      confirm its subscriptions are cancelled in Stripe.
- [ ] Stripe dashboard: under failed-payment settings, have the subscription
      cancelled after the retries. Left as "past due", that player trains free.
- [ ] Stripe dashboard: check whether sales tax applies; the app collects none.
- [ ] The terms now say payments already taken aren't refunded automatically,
      and to write in about a wrong charge. Change that sentence
      (`src/app/site/terms/page.tsx`, "Paying") if your refund rule differs.
- [ ] Removing a player, or a player leaving, stops payments at once with no
      refund for the rest of the month. Decide whether to refund those by hand.
- [ ] The paywall is now checked on each training page as well as the frame,
      but the database itself still lets a signed-in, locked player read
      sessions. Closing that means row-level rules on the content tables.

## 2. Add CI

Nothing runs the tests, the typecheck or the build unless someone remembers to,
which is why each audit kept finding new problems.

- [x] A GitHub Actions workflow that runs `npm run check` on every push to main
      and every pull request (`.github/workflows/check.yml`; it starts with the
      first push). It reports but doesn't block: Vercel still deploys a push to
      main whose tests fail. To block, work through pull requests.
- [ ] Replace `npm run lint` (left over from an older Next.js; it does not run)
      with a real linter, and add it to `npm run check`.

## 3. Get the policy pages reviewed

`/privacy` and `/terms` describe what the code does, but they were not written by
a lawyer.

- [ ] Legal review, the children's section especially, before families you don't
      know sign up. Include the two parent emails (`src/lib/consent-email.ts`)
      and the "email plus" method behind them.
- [x] Enforce parent sign-up for under-13s (November 22, 2026, migration 0043):
      a player is asked their age before their email; under 13, a parent or
      guardian signs up and agrees, or is emailed a link; a confirmation goes a
      day later; no agreement in 30 days and the account is deleted.
- [ ] Decide which state's law governs the terms, and add it.
- [ ] When the pages change, update `LEGAL_UPDATED` in `src/lib/legal.ts`.

## 4. Smaller leftovers

- [ ] "Get started": a CAPTCHA or email confirmation. The per-address limit is in
      the database now, but a sender with hundreds of addresses can still flood
      the form.
- [ ] Tell a player when their offline queue is full. Past five waiting finishes,
      their oldest is dropped without a word (`src/lib/pending.ts`).
- [ ] "Back to program" shows only the program sessions still owed that week.
      Decide whether it should show the program's full week instead
      (`buildWeek` in `src/lib/academy-week.ts`).
- [ ] Invite and claim links made before migration 0036 are still 10 characters.
      Replace an academy's links to get the longer ones.
- [ ] Once every environment has migrations 0001–0042, remove the "before
      migration N" fallback branches (about 47 across 22 files). They are dead
      code by then, and each is a second path to get wrong.
- [ ] Delete the untracked `_to_delete/` and `mockups/` folders if they are no
      longer needed.
