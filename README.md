# Construction Robotics PRD Workshop Platform

A lightweight web app for running a **one-hour, 15–25 person stakeholder workshop** that
crowdsources preliminary requirements for a *fictional* construction robot. It provides three
synchronized experiences — a projected **Room Display**, a **Facilitator** control deck (laptop +
phone), and a per-group **Submission** workspace — plus balanced group generation, a shared timer,
voting, suspenseful group selection, and a markdown export you run through Claude afterward.

> This tool captures stakeholder intelligence to *inform* a PRD. It does **not** produce a complete,
> validated, or approved PRD.

## Stack

Node + Express + SQLite (`better-sqlite3`), vanilla HTML/CSS/JS front-ends. No build step. Clients
poll a single session-state endpoint (2.5s facilitator/display, 4.5s group). Server is the source of
truth; the timer is a single `timer_ends_at` timestamp each screen counts down locally.

## Run locally

Requires **Node 18+** (verified on Node 24 via nvm). If you use nvm, make sure the right version is
active in your terminal first:

```bash
nvm use 24     # or: nvm use --lts   (skip if node -v already shows 18+)
npm install    # one-time; builds the native SQLite module for your Node version
npm start
# open http://localhost:3000
```

Dependencies are already installed in this project. If you ever switch Node major versions, re-run
`npm install` so `better-sqlite3` rebuilds against the new ABI.

From the landing page, **Create Session**. You'll get three links:

- **Room Display** → project this (`/display?session=CODE`)
- **Facilitator** → your control deck (`/facilitator?session=CODE`)
- **Join** → participants scan the display QR or open `/join?session=CODE`

### Seed test participants

```bash
node scripts/seed-demo.js <SESSION_CODE> 20
```

Injects 20 varied participants (with same-company clusters) so you can test group balancing and sync
without 20 phones.

## Editing workshop content

All workshop content (robot, agenda, the round's prompts/fields, images, the short join URL) lives in
**`config/workshop.json`** and is editable two ways:

1. **In the app (preferred):** on the facilitator deck, toggle **✎ Edit Display** — every stage shows
   its editable fields. Saves write straight into the config, so they apply to the current session and
   every future one.
2. **In the file:** edit `config/workshop.json`, drop images into `assets/robot/`, commit, push.

Config is re-read live, so edits appear on the room display within a poll (~3s).

## The workshop flow (facilitator deck)

The stage bar is a **sequential guide** — click left to right:

**Welcome → Agenda → In the Room → Groups → ⚙ Generate → ✓ Finalize → Robot → Define the Robot → 🎡 Spin → Final**

1. People scan the QR (or type the short URL) and register; the roster fills live.
2. **Generate** groups (balanced: ≥1 presenter 🎤 per group, same-company separation); **Manage** to
   swap/move/rename/lock; **Reroll** preserves locks; **Finalize**.
3. Open the round — submissions open automatically, **▶ Start 15:00** arms the round timer, and
   *anyone in a group* can write the shared answer (fields merge; phones don't clobber each other).
4. **🎡 Spin (Random)** picks the presenting group on the wheel; the display shows their full answers.
5. **🏁 End of workshop**: download the Brief Package and copy the report sign-up emails.

Auto-record captures audio + a live transcript per slide (Chrome/Edge) and stores both on the server.
Reordering stages lives behind **⇄ Arrange**. AI is intentionally out-of-loop: nothing blocks on it.

## Export / synthesis (no API charges)

Under **Export / Synthesis**, download per-section markdown or the full **Brief Package** — a single
`.md` with every submission, vote tally, and note, headed by a ready-to-paste prompt that asks Claude
to produce the *Preliminary Robotic Product Requirements Brief*. Copies are also written to `exports/`.

To add live AI later, the code is structured so a real Anthropic API call can replace the export step
(`src/lib/export.js`) — off by default so it never bills against your account.

## Deploy (reach phones over the internet — no same-Wi-Fi needed)

Running on your Mac only works on the local network. To let anyone join from any network (Wi-Fi **or**
cellular), put the app on an always-on host. This is the reliable choice for a live event: it removes
your laptop and the venue Wi-Fi as points of failure.

### Recommended: Render (always-on, persistent data)

The repo includes [`render.yaml`](render.yaml), which provisions a web service **with a persistent
disk** so session data survives restarts.

1. Push this project to a GitHub repo.
2. In [Render](https://render.com): **New +** → **Blueprint** → connect the repo → **Apply**.
   The blueprint sets `DB_PATH=/data/workshop.db`, a 1 GB disk, `/healthz` health check, and Node 20.
3. When it's live (e.g. `https://robotics-workshop.onrender.com`), open **Settings → Environment** and
   add `BASE_URL` = that URL. Redeploy. Now the QR and "OR VISIT" link use the public address.
4. Open `<your-url>/facilitator?session=…` on your laptop and project `<your-url>/display?session=…`.

The `starter` plan (~$7/mo) is always-on. The **free** tier also works but sleeps after 15 min idle and
has **no persistent disk** — fine for a single session if you (a) pre-warm it a few minutes before the
event and (b) accept that a restart would clear data. During an active workshop the constant polling
keeps a free instance awake, so it won't sleep mid-event. Other Node hosts (Railway, Fly, a VPS) work
too via the [`Procfile`](Procfile); just set `PORT`, `BASE_URL`, and `DB_PATH`.

### Keep-warm

`GET /healthz` returns `{ok:true}`. Point a free uptime monitor (e.g. UptimeRobot) at it every 5 min so
a free-tier instance is never cold when your event starts.

### Quick alternative: public tunnel (laptop hosts)

For a fast test, expose your local server without deploying:

```bash
npx localtunnel --port 3000          # prints a public https URL
# or, more reliably: cloudflared tunnel --url http://localhost:3000
```

`shareBaseUrl` auto-detects the tunnel's public host, so the QR updates itself. Note: your laptop must
stay awake and online for the whole session — less reliable than a deploy for a real event.

## Operations (read before workshop day)

**Where data lives:**

| Data | Local | Render (deployed) | Survives restart? |
|---|---|---|---|
| Database (sessions, answers, transcripts) | `data/workshop.db` | `/data/workshop.db` | ✅ |
| Audio recordings | `data/recordings/` | `/data/recordings/` | ✅ |
| Workshop config (live edits) | `config/workshop.json` (repo) | `/data/workshop.json` (seeded from the repo copy) | ✅ |
| Uploaded images | `assets/uploads/` (repo) | `/data/uploads/` | ✅ |

On Render, pushing a changed `config/workshop.json` only takes effect if the live copy was **never
edited in the app** since it was seeded; otherwise live edits win. To force-reset, delete
`/data/workshop.json` + `/data/workshop.json.seed` from a Render shell and restart.

**Facilitator key:** created with each session and embedded in the facilitator link
(`/facilitator?session=CODE&key=fk_…`). It's required for all controls, exports, recordings, and the
emails list — participants with just the session code can only register and submit. **Open the deck
from the link shown at session creation** (the key also lands in that browser's localStorage).

**Simulation tools** (synthetic people/submissions) are hidden on the deployed site unless the
`ALLOW_SIM=1` env var is set. They're always available locally.

**Short join URL:** the display shows `joinShortUrl` (e.g. `bit.ly/…`) as the typed URL — point that
bit.ly at `https://<your-app>.onrender.com/join`. The QR always encodes the real working URL.

**Tests:** `npm test` (grouping-algorithm invariants).

## Deferred (not in this version)

Browser audio recording + transcription, PDF export, automated report email, live AI synthesis, and
heavy picker/idea-feed animation polish. The data schema leaves room for recordings/summaries.

## Data model

SQLite tables: `sessions`, `participants`, `groups`, `sections`, `submissions`, `votes`, `notes`,
`activity_log`. See `src/db.js`.
