# To do

Left over from the tenth audit (November 14, 2026). The audit's fixes, migrations
0034–0036 and the privacy and terms pages are all live; these are what was not
done, or could not be checked from here.

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

- [ ] Run migration `0042_audit_eleven.sql` (after the app is deployed).
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

- [ ] A GitHub Actions workflow that runs `npm run check` on every push and pull
      request.
- [ ] Replace `npm run lint` (left over from an older Next.js; it does not run)
      with a real linter, and add it to `npm run check`.

## 3. Get the policy pages reviewed

`/privacy` and `/terms` describe what the code does, but they were not written by
a lawyer.

- [ ] Legal review, the children's section especially, before families you don't
      know sign up.
- [ ] Decide whether to enforce parent sign-up for under-13s. The pages and the
      sign-in form say a parent signs in with their own email; the app does not
      check it.
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
