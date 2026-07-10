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

## Filling in the robot (pending)

All robot + section content lives in **`config/workshop.json`** — no code changes needed:

1. Edit the `robot` block: `name`, `tagline`, `task`, `environment`, `assumptions`, `constraints`,
   `unresolvedQuestions`, and `images` (array of paths).
2. Drop image files into **`assets/robot/`** and point `robot.images` at them
   (e.g. `/assets/robot/my-robot.png`).
3. The three workshop sections, their fields, prompts, and default timers are also here — tweak freely.

Config is re-read when each new session is created, so edits take effect on the next **Create Session**.

## The workshop flow (facilitator deck)

1. **Stage buttons** (Welcome → Roster → Robot → Groups → Section → Discuss → Final) drive the room display.
2. **Generate** groups once people have registered; use **Manage** to swap/move/rename, change
   presenter (🎤) / recorder (✏️), **Lock** people, **Reroll** (locks preserved), then **Finalize**.
3. Per section: **Open Submissions** → groups' recorders submit → **Close** → **Reveal All** →
   **Open Voting** → **Reveal Votes** → **Select a group** (Random / Not-Yet-Heard / Highest Voted) →
   discuss and capture **Notes** (⭐ mark key points; optionally show on display).
4. **Next** advances sections. AI is intentionally out-of-loop: nothing blocks on it.

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

## Deferred (not in this version)

Browser audio recording + transcription, PDF export, automated report email, live AI synthesis, and
heavy picker/idea-feed animation polish. The data schema leaves room for recordings/summaries.

## Data model

SQLite tables: `sessions`, `participants`, `groups`, `sections`, `submissions`, `votes`, `notes`,
`activity_log`. See `src/db.js`.
