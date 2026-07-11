'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// DB_PATH lets a host point the database at a mounted persistent disk
// (e.g. /data/workshop.db on Render). Default is the local ./data folder.
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'workshop.db');
const DB_DIR = path.dirname(DB_PATH);
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS sessions (
  code                TEXT PRIMARY KEY,
  workshop_title      TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'welcome',   -- welcome|roster|robot|groups|section|discussion|final
  display_state       TEXT NOT NULL DEFAULT 'welcome',   -- explicit room-display state override
  current_section     INTEGER NOT NULL DEFAULT 0,        -- 0 = none yet; otherwise section order (1-based)
  public_names        INTEGER NOT NULL DEFAULT 1,        -- 1 = show names on display
  submission_status   TEXT NOT NULL DEFAULT 'closed',    -- closed|open|revealed
  voting_status       TEXT NOT NULL DEFAULT 'closed',    -- closed|open|revealed
  timer_ends_at       INTEGER,                           -- epoch ms; null when not running
  timer_paused_remaining INTEGER,                        -- ms remaining while paused; null when running
  timer_duration      INTEGER,                           -- last configured duration (ms)
  groups_finalized    INTEGER NOT NULL DEFAULT 0,
  selected_group_id   TEXT,
  notes_shared        INTEGER NOT NULL DEFAULT 0,        -- show facilitator notes on display
  control_device_id   TEXT,                              -- device holding the control token
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS participants (
  id                TEXT PRIMARY KEY,
  session_code      TEXT NOT NULL REFERENCES sessions(code) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  company           TEXT,
  role              TEXT,
  present_pref      TEXT NOT NULL DEFAULT 'no',   -- yes|maybe|no
  email             TEXT,
  report_consent    INTEGER NOT NULL DEFAULT 0,
  group_id          TEXT,
  is_recorder       INTEGER NOT NULL DEFAULT 0,
  is_presenter      INTEGER NOT NULL DEFAULT 0,
  locked            INTEGER NOT NULL DEFAULT 0,   -- facilitator locked this person to their group
  late_arrival      INTEGER NOT NULL DEFAULT 0,
  created_at        INTEGER NOT NULL,
  last_seen_at      INTEGER
);

CREATE TABLE IF NOT EXISTS groups (
  id                TEXT PRIMARY KEY,
  session_code      TEXT NOT NULL REFERENCES sessions(code) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  presenter_id      TEXT,
  recorder_id       TEXT,
  heard_count       INTEGER NOT NULL DEFAULT 0,   -- how many times selected/presented
  status            TEXT NOT NULL DEFAULT 'not_started', -- not_started|working|submitted|selected
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sections (
  session_code      TEXT NOT NULL REFERENCES sessions(code) ON DELETE CASCADE,
  section_order     INTEGER NOT NULL,
  key               TEXT NOT NULL,
  title             TEXT NOT NULL,
  objective         TEXT,
  main_prompt       TEXT,
  image             TEXT,
  fields_json       TEXT NOT NULL,       -- JSON array of {key,label}
  default_timer     INTEGER,             -- seconds
  PRIMARY KEY (session_code, section_order)
);

CREATE TABLE IF NOT EXISTS submissions (
  id                TEXT PRIMARY KEY,
  session_code      TEXT NOT NULL REFERENCES sessions(code) ON DELETE CASCADE,
  section_order     INTEGER NOT NULL,
  group_id          TEXT NOT NULL,
  response_json     TEXT NOT NULL DEFAULT '{}',  -- structured field answers
  summary_response  TEXT,                         -- headline / collective answer
  submitted         INTEGER NOT NULL DEFAULT 0,
  submitted_at      INTEGER,
  updated_at        INTEGER,
  UNIQUE (session_code, section_order, group_id)
);

CREATE TABLE IF NOT EXISTS votes (
  id                TEXT PRIMARY KEY,
  session_code      TEXT NOT NULL REFERENCES sessions(code) ON DELETE CASCADE,
  section_order     INTEGER NOT NULL,
  submission_id     TEXT NOT NULL,
  voter_id          TEXT NOT NULL,
  created_at        INTEGER NOT NULL,
  UNIQUE (session_code, section_order, submission_id, voter_id)
);

CREATE TABLE IF NOT EXISTS notes (
  id                TEXT PRIMARY KEY,
  session_code      TEXT NOT NULL REFERENCES sessions(code) ON DELETE CASCADE,
  section_order     INTEGER NOT NULL,
  group_id          TEXT,                -- null = general section note
  body              TEXT NOT NULL,
  key_point         INTEGER NOT NULL DEFAULT 0,
  created_at        INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS activity_log (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  session_code      TEXT,
  device            TEXT,
  actor             TEXT,
  action            TEXT NOT NULL,
  prev_value        TEXT,
  new_value         TEXT,
  created_at        INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_participants_session ON participants(session_code);
CREATE INDEX IF NOT EXISTS idx_groups_session ON groups(session_code);
CREATE INDEX IF NOT EXISTS idx_submissions_session ON submissions(session_code, section_order);
CREATE INDEX IF NOT EXISTS idx_votes_session ON votes(session_code, section_order);
CREATE INDEX IF NOT EXISTS idx_notes_session ON notes(session_code, section_order);
`);

// --- lightweight migrations (add columns to existing DBs) -------------------
function ensureColumn(table, column, decl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
  }
}
ensureColumn('sessions', 'stage_order', 'TEXT'); // JSON array of facilitator flow steps

function logActivity({ session_code, device, actor, action, prev_value, new_value }) {
  db.prepare(
    `INSERT INTO activity_log (session_code, device, actor, action, prev_value, new_value, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    session_code || null,
    device || null,
    actor || null,
    action,
    prev_value == null ? null : String(prev_value),
    new_value == null ? null : String(new_value),
    Date.now()
  );
}

module.exports = { db, logActivity, DB_PATH };
