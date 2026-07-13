'use strict';

const path = require('path');
const fs = require('fs');

const CONFIG_PATH = process.env.WORKSHOP_CONFIG || path.join(__dirname, '..', 'config', 'workshop.json');

// Loaded fresh each call so edits to workshop.json (e.g. the robot definition the
// facilitator adds later) take effect on the next session creation without a restart.
function loadConfig() {
  const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
  return JSON.parse(raw);
}

// Persist the config back to disk so edits become the default for all future sessions.
function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');
}

module.exports = { loadConfig, saveConfig, CONFIG_PATH };
