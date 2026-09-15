# UMBRY — Deploy to Vercel

This zip contains the complete UMBRY website (umbry.solutions) as plain static HTML/CSS/JS. No build step, no framework, no server. Drop these files into Vercel and the site is live.

---

## Option 1 — Drag and drop (easiest, ~2 minutes)

1. Sign in at https://vercel.com (free Hobby tier is fine)
2. Click **Add New → Project**
3. Drag this entire folder (or the zipped version) into the upload area
4. Vercel auto-detects it as a static site — leave all framework presets at "Other"
5. Click **Deploy**
6. Live URL appears in ~30 seconds (e.g. `umbry-xxxx.vercel.app`)

## Option 2 — Vercel CLI

```bash
# One-time install
npm i -g vercel

# From inside this folder
vercel
# follow prompts; accept the defaults
# for production deploy:
vercel --prod
```

## Option 3 — GitHub-connected (recommended for ongoing edits)

1. Create a new GitHub repo (private is fine)
2. Push these files to the repo
3. In Vercel: **Add New → Project → Import Git Repository**
4. Select the repo, click **Deploy**
5. Every future `git push` redeploys automatically

---

## Connect umbry.solutions (custom domain)

After deployment:

1. In the Vercel project dashboard → **Settings → Domains**
2. Type `umbry.solutions` and click **Add**
3. Vercel will show DNS records you need to add at **Tailor Brands** (where you bought the domain):

   - **A record** for `@` (root domain) → `76.76.21.21`
   - **CNAME record** for `www` → `cname.vercel-dns.com`

4. Log into Tailor Brands → Domain settings for umbry.solutions → DNS / Nameservers
5. Add the two records above. Save.
6. Back in Vercel, click **Refresh** on the domain — within 5–60 minutes it will verify and issue a free SSL cert automatically.

Once verified, both `umbry.solutions` and `www.umbry.solutions` will serve this site over HTTPS.

---

## File inventory

```
index.html             — homepage (single-page site)
favicon.svg            — browser tab icon
css/style.css          — all styles
js/main.js             — scroll, animations, form handling
js/signal-canvas.js    — hero canvas animation
images/chelsey-masood.jpg
```

No environment variables. No backend. No external API keys. Pure static site.

---

## Editing the site later

All copy lives in `index.html`. All visual styling in `css/style.css`. The hero animation is in `js/signal-canvas.js`. Any developer comfortable with HTML/CSS can edit; no build tools required — just save and refresh.

---

Site originally built with Perplexity Computer for Chelsey Masood, Founder/CEO of UMBRY.
Contact: Chelsey@UMBRY.solutions
