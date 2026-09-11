# Pooja's Mentor ❤️

A personal daily mentor + AI companion + career coach + self-care tracker + life dashboard — built to feel like a real product, not a demo.

## 1. What this is

Pooja's Mentor keeps your existing Home, Food & Care, Career, Skills, Today, Goals and Business Lab sections — nothing was removed — and adds a mentor layer on top: a personality-driven mentor engine, XP/levels, streaks, unlockable milestones, a ghost-mode inactivity system, a transparent daily score, and a chat you can talk to.

## 2. Features

**Always-on, no setup required (Level 1 — local mentor engine):**
- Mentor messages, "Today's read", wins/missed/attention, one-thing-to-do-now, end-of-day card — all generated from your real stored data with plain JavaScript rules. No AI, no internet call, no cost.
- XP, Levels (🌱 → 🌿 → 🌸 → 🔥 → 👑 → 💎), streaks, and 6 Dream Unlock achievements (Glow Era, Dream Career, Skill Master, Business Era, Main Character, Dream Life).
- Ghost mode banners at 3 / 7 / 14 / 30 days of inactivity, always with a small comeback action, never harsh.
- 💬 Chat tab with a built-in mentor personality that reads your real stats and replies — fully local by default.
- Your own photo as the avatar, header logo, favicon, and app icon.

**Optional, needs 5 minutes of setup (Level 2 — AI backend):**
- Real AI food-photo analysis.
- Richer, more natural AI chat replies (still falls back to the local mentor instantly if the backend is unreachable).

**Browser-permission features (only if you grant them):**
- Optional local reminders (see the Notifications section below for exactly what this can and can't do on iPhone).

## 3. Project structure

```
pooja-mentor/
├── index.html                              → the app shell
├── styles.css                              → all styling
├── app.js                                  → all logic (mentor engine, XP, chat, notifications, etc.)
├── manifest.webmanifest                    → makes it installable as an app
├── service-worker.js                       → offline/app-shell caching
├── .gitignore
├── avatar/
│   ├── avatar.png                          → your photo, circular, large
│   └── avatar-small.png                    → your photo, circular, small (header/avatar ring)
├── icons/
│   ├── icon-192.png / icon-512.png         → PWA icons (your photo)
│   ├── apple-touch-icon.png                → iPhone home screen icon (your photo)
│   └── favicon.ico / favicon-32.png        → browser tab icon (your photo)
└── backend/
    └── cloudflare-worker-example.js        → OPTIONAL, for real AI food analysis + AI chat
```

## 4. How to run locally

Double-click `index.html`. Everything works immediately — all tracking, the mentor engine, XP, achievements, chat (local mode), and data storage. Your data saves automatically in this browser (localStorage) and survives closing the tab.

## 5. How to publish for free — GitHub Pages

1. Create a free account at [github.com](https://github.com) if needed.
2. **+ → New repository** → name it e.g. `pooja-mentor` → **Public** → Create.
3. **Add file → Upload files** → drag in *everything* in this folder (keep `avatar`, `icons`, `backend` intact) → Commit.
4. **Settings → Pages** → Source: **Deploy from a branch**, Branch: **main**, folder **/ (root)** → Save.
5. Wait ~1 minute, refresh — your live URL appears, e.g. `https://yourusername.github.io/pooja-mentor/`.

### Updating later
Edit files and **Add file → Upload files** again (or `git push` if you're comfortable with git). GitHub Pages redeploys within a minute.

## 6. Install on iPhone

1. Open your GitHub Pages link in **Safari** (must be Safari on iOS).
2. Tap **Share** → **Add to Home Screen** → confirm name **Pooja's Mentor ❤️** → **Add**.
3. It opens full-screen from your home screen, with your photo as the icon.

## 7. How the PWA works

- `manifest.webmanifest` tells iOS/Android the app name, icons, and that it should open in standalone (no browser bar) mode.
- `service-worker.js` caches the app shell (HTML/CSS/JS/icons) so it loads instantly and still opens with no internet connection. Your *data* is not in this cache — it lives separately in localStorage.
- A normal `file://` double-click won't register a service worker or allow "Add to Home Screen" with an icon — that needs real HTTPS hosting (step 5).

## 8. How notifications work (and their real limits)

Open **⚙️ Settings → Reminders** and turn them on — your browser will ask for notification permission once.

**What actually works:** while the app tab is open, or the installed PWA is running/backgrounded on a platform that supports it, a timer checks the time of day every minute and fires a local notification for whichever categories you've enabled (morning / water / career / learning / night), respecting your quiet hours and never repeating the same category twice in one day.

**What this cannot do, and why:** a fully-closed iPhone app cannot receive push notifications from a static website. True background push requires:
1. iOS 16.4+ with the app added to your Home Screen, **and**
2. A real push server that holds Apple/Web Push credentials and sends the notification from outside your phone.

That's a backend project on its own and isn't included here, to avoid pretending something works when it doesn't. If you want this later, it's a well-documented path (Web Push API + a small server) and I'm happy to help you build it as a follow-up.

## 9. How AI works (Level 1 local / Level 2 optional backend)

- **Level 1 — Local Mentor Engine (always on):** every mentor message, the "today's read," wins/missed/attention, achievements, and chat replies are generated by rules in `app.js` reading your real stored data. Zero cost, zero setup, never breaks.
- **Level 2 — Optional AI backend:** for photo-based food analysis and more natural chat replies, deploy `backend/cloudflare-worker-example.js` (instructions in the file, ~5 minutes, Cloudflare's free tier) and paste its URL into **⚙️ Settings → Backend URL**. The app calls your worker; your worker calls Anthropic using a secret key that never touches the frontend.
- If the backend is unset, unreachable, or errors out, the app **automatically falls back to Level 1** — you'll never see a broken screen.

## 10. Security — API key safety

A secret API key must never appear in HTML, CSS, frontend JavaScript, localStorage, or a public GitHub repository — anyone could read it and use your account. This app never asks you to paste a key into the app itself. Instead:
- Your Anthropic API key lives only inside your Cloudflare Worker's encrypted environment variable (`ANTHROPIC_API_KEY`), set through the Cloudflare dashboard.
- The frontend only ever knows your **worker's URL** — which is not a secret and is safe to put in a public repo.

**Cost note:** the Cloudflare Worker itself is free for this use. Anthropic's API is paid per request beyond any free trial credit. Skipping the backend costs nothing and the app works fully with manual food entry and the local mentor.

## 11. Your photo / avatar

The photo you uploaded was cropped (not altered — no AI face changes) into: a circular in-app avatar, the header logo, the iPhone home screen icon, the PWA icons, and the browser favicon. If you ever want to swap it, replace the files in `/avatar` and `/icons` with new versions at the same filenames and dimensions.

## 12. Backup and restore

**⚙️ Settings → Backup as JSON** downloads everything — jobs, skills, food history, goals, tasks, business ideas, XP/achievements, chat history. Keep it somewhere safe.

**⚙️ Settings → Restore backup** replaces current data with a chosen JSON file — also how you'd move data to a new phone. You're always asked to confirm before anything is overwritten, and **Reset all data** requires two confirmations.

## 13. Troubleshooting

- **"Add to Home Screen" doesn't show an icon** → make sure you're hosting over HTTPS (step 5), not opening the file directly.
- **Notifications never fire** → check Settings → Notifications for this site in iOS Settings, and make sure the app/tab is open or backgrounded, not force-quit (see section 8).
- **AI food analysis / rich chat isn't working** → check `⚙️ Settings → Backend URL` is filled in and the Cloudflare Worker is deployed with `ANTHROPIC_API_KEY` set. Everything else keeps working regardless.
- **Data looks empty on a new device** → data is per-browser/per-device; restore your latest JSON backup.
- **Something looks broken after an update** → hard refresh (pull down in Safari, or clear the site's cache) so the new service worker takes over.

## 14. General wellness disclaimer

Food/skin/hair scores and suggestions, and all achievement/unlock messaging, are general wellness and motivational content only — never a medical, health, or financial claim, and never a diagnosis. For any ongoing skin, hair, or health concern, please see a dermatologist or doctor.

---

Made with ❤️ for Pooja — your personal mentor, career coach, self-care companion, learning tracker and business lab, one day at a time.
