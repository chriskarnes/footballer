# Getting Forge onto your phone

Two stages. **Stage 1 puts it on your phone and takes about ten minutes.** Stage 2 adds
accounts and history and takes another fifteen. You do not need Stage 2 to train.

> **Supabase is not what puts the app on your phone — Vercel is.** Vercel hosts the site
> and gives you a URL. Supabase is a database, and you only need it once you want to save
> history and sign in. The app ships with the whole drill library bundled in a JSON file,
> so Train, Library and the session runner all work with no database at all.

---

## Stage 1 — live on your phone (≈10 min, free)

### 1. Put the code on GitHub

Unzip the repo, then in a terminal inside the folder:

```bash
npm install
git init
git add -A
git commit -m "Forge"
```

Create an empty repo at [github.com/new](https://github.com/new) (private is fine), then
follow the two lines GitHub shows you under *"…or push an existing repository"*:

```bash
git remote add origin https://github.com/YOUR-NAME/forge-training.git
git branch -M main
git push -u origin main
```

### 2. Deploy on Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and sign in with GitHub.
2. Pick your `forge-training` repo → **Import**.
3. Change nothing. Vercel detects Next.js on its own.
4. **Deploy.**

Ninety seconds later you get a URL like `forge-training.vercel.app`.

### 3. Open it on your phone

That's the whole step. Send yourself the link and open it — **there is no install**.

Forge is built to feel native from the browser: it lays out inside the notch and above the
home indicator, doesn't rubber-band or pull-to-refresh, doesn't pop a text-selection handle
when you hold a button, animates between screens instead of blinking, and holds the screen
awake while a session is running. See *"Feels native, no install"* in `README.md` for what
that is made of.

Installing is optional and buys only the icon and the full-screen frame. The app offers it
on a player's **third visit**, and never asks again if they say no. On Android that's a
one-tap install; on iPhone it walks them to Share → Add to Home Screen, with the Share
icon drawn out, because that is the step people get stuck on.

The icons ship with the repo. If the logo changes, edit and re-run
`python3 scripts/make-icons.py` — every size is generated from one definition, so they
can't drift apart.

**At this point Train, Library and the runner all work.** Nothing saves between visits yet.

---

## Stage 2 — accounts, history and "do it again" (≈15 min, free)

### 1. Create the Supabase project

1. [supabase.com](https://supabase.com) → sign in with GitHub → **New project**.
2. Name it, set a database password (save it somewhere), pick the region closest to you.
3. Wait about two minutes for it to provision.

### 2. Create the tables

Left sidebar → **SQL Editor** → **New query**. Open `supabase/schema.sql` from the repo,
paste the whole thing in, hit **Run**. That creates every table, the indexes, the security
policies and the trigger that makes a profile when someone signs up.

### 3. Load the drills

Left sidebar → **Project Settings → API**. Copy three values into a file called
`.env.local` in your repo folder:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Then:

```bash
npm run seed
```

You should see `programs: 17`, `sessions: 161`, `exercises: 786`. Check it landed:
Supabase → **Table Editor** → `exercises`.

### 4. Tell Vercel about it

Vercel → your project → **Settings → Environment Variables**. Add the same three, plus:

```
NEXT_PUBLIC_SITE_URL=https://your-app.vercel.app
```

Then **Deployments → ⋯ → Redeploy**. Environment variables only apply to new builds.

### 5. Allow sign-in links to come back

Supabase → **Authentication → URL Configuration**. Set *Site URL* to your Vercel URL, and
add a redirect URL of:

```
https://your-app.vercel.app/auth/callback
```

Miss this and the magic-link email will bounce you to the wrong place.

### 6. The AI coach (optional)

The chips work without it; this is only for the free-text box. Get a key at
[console.anthropic.com](https://console.anthropic.com), add credit, then add
`ANTHROPIC_API_KEY` to Vercel's environment variables and redeploy.

---

## What this costs

| | Free tier | When you'd pay |
|---|---|---|
| **Vercel** (hosting) | Hobby, free forever — 1M requests, 100 GB transfer/month | **Personal use only.** Charging money for the app means Pro, $20/month |
| **Supabase** (database, auth) | 500 MB database, 50,000 monthly active users, 1 GB storage, 5 GB egress | Pro is $25/month. You'd need it for backups, or to stop the project pausing |
| **Anthropic** (the coach) | No free tier — pay as you go | About **a tenth of a cent per message** on Haiku. $5 of credit is thousands of sessions |

**So: free**, for you and a handful of testers, apart from a few dollars of Anthropic
credit if you want the free-text box.

Two catches worth knowing before you rely on it:

1. **Vercel's free tier is for non-commercial use.** The moment you charge for Forge, you
   need Pro at $20/month. That's a licensing rule, not a technical limit.
2. **Free Supabase projects pause after a week of inactivity.** Fine while you're
   building — you just click to restore. Not fine once real players depend on it, which is
   the main reason to move to the $25 Pro plan.

Your library is tiny by database standards: 786 drills is well under a megabyte against a
500 MB allowance. The free tier's real constraints are the pausing and the commercial-use
rule, not size.

---

## If something goes wrong

**Build fails on Vercel.** Read the log — it's nearly always a missing environment
variable. The app is designed to build without them, so this usually means a typo in a
variable name.

**Sign-in link opens the wrong page.** Step 5 — the redirect URL in Supabase must match
your deployed domain exactly, including `https://`.

**Library is empty after connecting Supabase.** The seed didn't run or didn't finish.
Re-run `npm run seed` and check the Table Editor. Note that once `NEXT_PUBLIC_SUPABASE_URL`
is set, the app reads from the database instead of the bundled JSON — so a half-finished
seed shows as missing drills.

**Free-text box does nothing.** `ANTHROPIC_API_KEY` isn't set, or the account has no
credit. The chips will keep working regardless.
