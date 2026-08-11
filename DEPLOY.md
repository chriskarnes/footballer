# Get it live for testing — today

Goal: a real HTTPS URL on your own domain that you can open on your phone and hand to a
coach. **Fifteen minutes, free, no database, no API key.**

Everything works without a single environment variable: Train Now (the buttons), the whole
786-drill library, the session runner, touch banking, offline. Two things are off until
later — history/sign-in (needs Supabase) and the free-text box (needs an Anthropic key).
Neither blocks testing.

> **Use Vercel, not Netlify.** You have both, and Netlify runs Next fine, but Vercel builds
> Next with zero configuration — no adapter plugin, no build settings, no lag behind new
> Next releases. This repo is Next 16. Take the shorter path.

---

## 1. Push it to GitHub (5 min)

Unzip the repo, open a terminal in that folder, and:

```bash
git init
git add -A
git commit -m "Forge"
```

You do **not** need to `npm install` for this — Vercel installs and builds on its own. Only
run it if you want `npm run dev` locally too.

Make an empty repo at [github.com/new](https://github.com/new) — private is fine — then
paste the two lines GitHub shows you under *"…or push an existing repository"*:

```bash
git remote add origin https://github.com/YOUR-NAME/forge-training.git
git branch -M main
git push -u origin main
```

## 2. Deploy (3 min)

1. [vercel.com/new](https://vercel.com/new) → sign in with GitHub.
2. Find `forge-training` → **Import**.
3. **Change nothing.** Framework is detected, build settings are correct, there are no
   environment variables to add yet.
4. **Deploy.**

Ninety seconds later you have `forge-training.vercel.app` on HTTPS. Open it on your phone
right now — that URL alone is enough to test with.

Every `git push` to `main` redeploys from here on.

## 3. Put it on your domain (5 min + DNS)

**Use a subdomain, not the apex.** `train.yourdomain.com` or `forge.yourdomain.com`. It
keeps your main site untouched, it's a single CNAME instead of an A record, and it reads
fine to a parent. You can always move it later.

1. Vercel → your project → **Settings → Domains → Add**.
2. Type `train.yourdomain.com`.
3. Vercel shows you a **CNAME** value. **Copy the one it shows you** — it's unique per
   project and looks like `d1d4fc829fe7bc7c.vercel-dns-017.com`. Old blog posts tell you to
   use `cname.vercel-dns.com`; that is not what your project needs.
4. At your registrar, add:

   | Type | Name | Value |
   |---|---|---|
   | CNAME | `train` | *(the value Vercel showed you)* |

5. Wait. Usually minutes, occasionally an hour. Vercel flips the domain to **Valid
   Configuration** on its own and issues the certificate.

If you'd rather use the apex (`yourdomain.com`), Vercel gives you an **A** record instead —
same idea, copy the value from the dashboard rather than from anywhere else.

---

## Test it on the phone

Open the URL in Safari on your iPhone and check the things that are easy to get wrong:

- The header sits **below** the notch, and the floating tab bar sits **above** the home
  indicator.
- **Drag down hard at the top.** Nothing should bounce or reload.
- **Press and hold a chip.** No blue selection, no copy/paste bubble.
- **Double-tap the page.** It shouldn't zoom.
- **Tap into the "20 minutes, first touch" box.** The page must not zoom in and stay there.
- Pick a time and a focus, hit a session, and **leave the phone alone for two minutes** —
  the screen should stay awake.
- Turn on airplane mode and reload. You should get the Forge offline screen, not Safari's.
- Visit three times. On the third, the *Add to Home Screen* card appears. Dismiss it and it
  never comes back.

## Four things that will confuse you if nobody warns you

**Testing over your local network won't show the real thing.** Service workers and the
screen wake lock require HTTPS. `localhost` counts as secure, but `192.168.x.x:3000` on
your phone does not — so offline mode and the wake lock will silently do nothing. Test on
the deployed URL, not your laptop's IP.

**If a tester hits a Vercel login screen**, that's Deployment Protection. It guards preview
URLs (the long `…-git-main-….vercel.app` ones). Send people your custom domain, or turn it
off under **Settings → Deployment Protection**.

**Environment variables only apply to new builds.** Add one and nothing changes until you
**Deployments → ⋯ → Redeploy**. This catches everyone once.

**The service worker caches static assets.** Pages are always fetched fresh, so you'll
normally see your changes immediately. If a phone ever seems stuck on an old build:
iPhone → Settings → Safari → Advanced → Website Data → remove the site. Desktop Chrome →
DevTools → Application → Service Workers → Unregister.

---

## When you want more

**Accounts, history and "do it again"** — `SETUP.md` Stage 2. Supabase, about fifteen
minutes, still free. Remember to add `NEXT_PUBLIC_SITE_URL` and the
`/auth/callback` redirect URL using your **custom domain**, not the vercel.app one.

**The free-text coach box** — add `ANTHROPIC_API_KEY` in Vercel and redeploy. About a tenth
of a cent per message. Without it the box politely tells players to use the buttons.

**Before real families use it** — `LAUNCH.md`. The COPPA question about who owns a child's
account is the one to settle early, because it changes signup.
