'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// The repo copy is the seed/default. On a host with a persistent disk (Render),
// the LIVE config moves next to the DB so facilitator edits survive restarts and
// redeploys — the deploy artifact's filesystem is wiped on every restart.
const REPO_CONFIG = path.join(__dirname, '..', 'config', 'workshop.json');
const DATA_DIR = process.env.DB_PATH ? path.dirname(process.env.DB_PATH) : null;
const CONFIG_PATH = process.env.WORKSHOP_CONFIG
  || (process.env.RENDER && DATA_DIR ? path.join(DATA_DIR, 'workshop.json') : REPO_CONFIG);

const sha = (s) => crypto.createHash('sha1').update(s).digest('hex');

// Seed the live copy from the repo on first boot. If a later deploy ships a
// changed repo config AND the live copy was never edited since it was seeded,
// re-seed so repo updates still land; otherwise live edits always win.
if (CONFIG_PATH !== REPO_CONFIG) {
  const SENTINEL = CONFIG_PATH + '.seed';
  try {
    const repoRaw = fs.readFileSync(REPO_CONFIG, 'utf8');
    if (!fs.existsSync(CONFIG_PATH)) {
      fs.writeFileSync(CONFIG_PATH, repoRaw);
      fs.writeFileSync(SENTINEL, sha(repoRaw));
    } else if (fs.existsSync(SENTINEL)) {
      const seededHash = fs.readFileSync(SENTINEL, 'utf8').trim();
      const liveRaw = fs.readFileSync(CONFIG_PATH, 'utf8');
      if (sha(repoRaw) !== seededHash && sha(liveRaw) === seededHash) {
        fs.writeFileSync(CONFIG_PATH, repoRaw);
        fs.writeFileSync(SENTINEL, sha(repoRaw));
      }
    }
  } catch (e) {
    console.error('Config seeding failed (falling back to whatever exists):', e.message);
  }
}

// Loaded fresh each call so edits take effect without a restart.
function loadConfig() {
  const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
  return JSON.parse(raw);
}

// Atomic write (temp + rename) so a crash mid-write can never corrupt the one
// file every session depends on.
function saveConfig(config) {
  const tmp = CONFIG_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(config, null, 2) + '\n');
  fs.renameSync(tmp, CONFIG_PATH);
}

module.exports = { loadConfig, saveConfig, CONFIG_PATH };
