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

module.exports = { loadConfig, CONFIG_PATH };
