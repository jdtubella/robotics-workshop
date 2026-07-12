'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');
const express = require('express');
const QRCode = require('qrcode');
const { db, logActivity, UPLOADS_DIR } = require('../db');
const { loadConfig } = require('../config');
const { sessionCode, uid } = require('../lib/ids');
const { assignGroups } = require('../lib/grouping');
const { renderSection, buildBriefPackage } = require('../lib/export');
const { simPerson, POOL_SIZE } = require('../lib/simulate');

const router = express.Router();

// ---------- helpers ----------------------------------------------------------

function getSession(code) {
  return db.prepare('SELECT * FROM sessions WHERE code = ?').get(code);
}

function touch(code) {
  db.prepare('UPDATE sessions SET updated_at = ? WHERE code = ?').run(Date.now(), code);
}

// First non-internal IPv4 address (prefer Wi-Fi en0), so phones on the same
// network can reach the Mac — "localhost" in a QR points at the phone itself.
function lanIp() {
  const ifaces = os.networkInterfaces();
  const preferred = ['en0', 'en1'];
  const names = [...preferred, ...Object.keys(ifaces).filter((n) => !preferred.includes(n))];
  for (const name of names) {
    for (const i of ifaces[name] || []) {
      if (i.family === 'IPv4' && !i.internal) return i.address;
    }
  }
  return null;
}

// Base URL that is reachable from other devices. When the request came in over
// localhost we swap in the LAN IP; a real deploy keeps its host header.
function shareBaseUrl(req) {
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const [hostname, port] = host.split(':');
  if (['localhost', '127.0.0.1', '::1', ''].includes(hostname)) {
    const ip = lanIp();
    if (ip) return `${proto}://${ip}${port ? ':' + port : ''}`;
  }
  return `${proto}://${host}`;
}

function votesPerParticipant() {
  try { return loadConfig().defaults.votesPerParticipant || 2; } catch (_) { return 2; }
}

function timerRemaining(s) {
  if (s.timer_paused_remaining != null) return { running: false, remainingMs: Math.max(0, s.timer_paused_remaining) };
  if (s.timer_ends_at != null) return { running: true, remainingMs: Math.max(0, s.timer_ends_at - Date.now()) };
  return { running: false, remainingMs: null };
}

function groupMembers(code) {
  const rows = db.prepare('SELECT * FROM participants WHERE session_code = ? ORDER BY created_at').all(code);
  const map = new Map();
  for (const p of rows) {
    if (!p.group_id) continue;
    if (!map.has(p.group_id)) map.set(p.group_id, []);
    map.get(p.group_id).push(p);
  }
  return { rows, map };
}

// ---------- facilitator stage order -----------------------------------------
// The stage bar is a reorderable list of flow steps. Fixed stages are plain
// tokens; each round is "sec:<key>" so it tracks its content, not a position.
const FIXED_STAGE_TOKENS = ['welcome', 'roster', 'robot', 'groups', 'final'];

function defaultStageOrder(code) {
  const secs = db.prepare('SELECT key FROM sections WHERE session_code = ? ORDER BY section_order').all(code);
  return ['welcome', 'roster', 'groups', 'robot', ...secs.map((x) => 'sec:' + x.key), 'final'];
}

// Parse stored order, self-healing against config changes (drop removed rounds,
// append new ones before "final").
function stageOrder(s) {
  const code = s.code;
  const validRoundKeys = new Set(
    db.prepare('SELECT key FROM sections WHERE session_code = ?').all(code).map((x) => x.key)
  );
  let order;
  try { order = JSON.parse(s.stage_order); } catch (_) { order = null; }
  if (!Array.isArray(order) || !order.length) return defaultStageOrder(code);

  order = order.filter((t) => FIXED_STAGE_TOKENS.includes(t) || (t.startsWith('sec:') && validRoundKeys.has(t.slice(4))));
  const present = new Set(order);
  const missingRounds = [...validRoundKeys].map((k) => 'sec:' + k).filter((t) => !present.has(t));
  if (missingRounds.length) {
    const fi = order.indexOf('final');
    if (fi >= 0) order.splice(fi, 0, ...missingRounds);
    else order.push(...missingRounds);
  }
  for (const t of FIXED_STAGE_TOKENS) if (!present.has(t)) order.push(t); // safety
  return order;
}

// Renumber sections (and their submissions/votes/notes) so section_order matches
// the order of round tokens in the stage list. Data moves with its content.
function reconcileSectionOrder(code, order) {
  const roundKeys = order.filter((t) => t.startsWith('sec:')).map((t) => t.slice(4));
  const sections = db.prepare('SELECT section_order, key FROM sections WHERE session_code = ?').all(code);
  const desiredByKey = new Map(roundKeys.map((k, i) => [k, i + 1]));
  if (sections.every((s) => desiredByKey.get(s.key) === s.section_order)) return;

  const OFF = 1000;
  const session = getSession(code);
  const tables = ['sections', 'submissions', 'votes', 'notes'];
  const tx = db.transaction(() => {
    for (const t of tables) db.prepare(`UPDATE ${t} SET section_order = section_order + ${OFF} WHERE session_code = ?`).run(code);
    for (const s of sections) {
      const des = desiredByKey.get(s.key);
      if (des == null) continue;
      db.prepare('UPDATE sections SET section_order = ? WHERE session_code = ? AND key = ?').run(des, code, s.key);
      for (const t of ['submissions', 'votes', 'notes']) {
        db.prepare(`UPDATE ${t} SET section_order = ? WHERE session_code = ? AND section_order = ?`).run(des, code, s.section_order + OFF);
      }
    }
    if (session.current_section) {
      const cur = sections.find((s) => s.section_order === session.current_section);
      const des = cur && desiredByKey.get(cur.key);
      if (des != null) db.prepare('UPDATE sessions SET current_section = ? WHERE code = ?').run(des, code);
    }
  });
  tx();
}

// Full state snapshot consumed by all four views (polled).
function buildState(code, { participantId } = {}) {
  const s = getSession(code);
  if (!s) return null;
  const cfg = safeConfig();
  const { rows: participants, map: memberMap } = groupMembers(code);

  // Per-session content overrides (edited text + uploaded images), layered over config.
  const ov = safeJson2(s.content) || {};
  const secOvAll = ov.sections || {};

  const groups = db.prepare('SELECT * FROM groups WHERE session_code = ? ORDER BY sort_order').all(code);
  const sections = db
    .prepare('SELECT section_order, key, title FROM sections WHERE session_code = ? ORDER BY section_order')
    .all(code)
    .map((x) => ({ ...x, title: (secOvAll[x.key] && secOvAll[x.key].title) || x.title }));
  const currentSectionRow = s.current_section
    ? db.prepare('SELECT * FROM sections WHERE session_code = ? AND section_order = ?').get(code, s.current_section)
    : null;
  // Scenario + discussion prompts come from config by section key (or an override).
  const cfgSection = cfg && Array.isArray(cfg.sections) && currentSectionRow
    ? cfg.sections.find((x) => x.key === currentSectionRow.key)
    : null;
  const secOv = currentSectionRow ? (secOvAll[currentSectionRow.key] || {}) : {};
  const pick = (o, k, fallback) => (o[k] !== undefined ? o[k] : fallback);
  const currentSection = currentSectionRow
    ? {
        order: currentSectionRow.section_order,
        key: currentSectionRow.key,
        title: pick(secOv, 'title', currentSectionRow.title),
        objective: pick(secOv, 'objective', currentSectionRow.objective),
        mainPrompt: pick(secOv, 'mainPrompt', currentSectionRow.main_prompt),
        image: pick(secOv, 'image', currentSectionRow.image),
        defaultTimer: currentSectionRow.default_timer,
        fields: JSON.parse(currentSectionRow.fields_json || '[]'),
        scenario: pick(secOv, 'scenario', cfgSection ? cfgSection.scenario || '' : ''),
        discuss: pick(secOv, 'discuss', cfgSection && Array.isArray(cfgSection.discuss) ? cfgSection.discuss : []),
      }
    : null;

  const me = participantId ? participants.find((p) => p.id === participantId) : null;
  const myGroupId = me ? me.group_id : null;

  // Submissions for the current section. Content is only exposed for the
  // requester's own group or the group currently presenting.
  let submissions = [];
  if (s.current_section) {
    const subs = db
      .prepare('SELECT * FROM submissions WHERE session_code = ? AND section_order = ?')
      .all(code, s.current_section);
    submissions = subs.map((sub) => {
      const mine = myGroupId && sub.group_id === myGroupId;
      const showContent = mine || sub.group_id === s.selected_group_id;
      return {
        id: sub.id,
        groupId: sub.group_id,
        submitted: !!sub.submitted,
        mine: !!mine,
        summary: showContent ? sub.summary_response : null,
        response: showContent ? safeJson(sub.response_json) : null,
      };
    });
  }

  const notesShared = !!s.notes_shared;
  const sharedNotes = notesShared && s.current_section
    ? db
        .prepare('SELECT * FROM notes WHERE session_code = ? AND section_order = ? ORDER BY created_at')
        .all(code, s.current_section)
    : [];

  const baseCfg = cfg || {};
  const meta = ov.meta || {};
  return {
    serverNow: Date.now(),
    config: {
      workshopTitle: pick(meta, 'workshopTitle', baseCfg.workshopTitle),
      purpose: pick(meta, 'purpose', baseCfg.purpose),
      disclaimer: pick(meta, 'disclaimer', baseCfg.disclaimer),
      robot: { ...(baseCfg.robot || {}), ...(ov.robot || {}) },
      finalImage: pick(meta, 'finalImage', baseCfg.finalImage),
      roleCategories: baseCfg.roleCategories,
      defaults: baseCfg.defaults,
    },
    session: {
      code: s.code,
      workshopTitle: s.workshop_title,
      status: s.status,
      currentSection: s.current_section,
      publicNames: !!s.public_names,
      submissionStatus: s.submission_status,
      groupsFinalized: !!s.groups_finalized,
      selectedGroupId: s.selected_group_id,
      spin: safeJson2(s.spin),
      notesShared,
      controlDeviceId: s.control_device_id,
      timer: timerRemaining(s),
      timerDuration: s.timer_duration,
      stageOrder: stageOrder(s),
    },
    sections,
    currentSection,
    participants: participants.map((p) => ({
      id: p.id,
      name: p.name,
      company: p.company,
      role: p.role,
      presentPref: p.present_pref,
      groupId: p.group_id,
      isPresenter: !!p.is_presenter,
      isRecorder: !!p.is_recorder,
      locked: !!p.locked,
      lateArrival: !!p.late_arrival,
    })),
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      presenterId: g.presenter_id,
      recorderId: g.recorder_id,
      heardCount: g.heard_count,
      presentedRound: g.presented_round || null,
      status: g.status,
      sortOrder: g.sort_order,
      memberIds: (memberMap.get(g.id) || []).map((m) => m.id),
    })),
    submissions,
    sharedNotes: sharedNotes.map((n) => ({ id: n.id, groupId: n.group_id, body: n.body, keyPoint: !!n.key_point })),
    me: me
      ? {
          id: me.id,
          name: me.name,
          groupId: me.group_id,
          isRecorder: !!me.is_recorder,
          isPresenter: !!me.is_presenter,
        }
      : null,
  };
}

function safeJson(s) { try { return JSON.parse(s || '{}'); } catch (_) { return {}; } }
function safeJson2(s) { try { return s ? JSON.parse(s) : null; } catch (_) { return null; } }
function safeConfig() { try { return loadConfig(); } catch (_) { return null; } }

// ---------- session lifecycle ------------------------------------------------

router.post('/sessions', (req, res) => {
  const cfg = loadConfig();
  let code = sessionCode();
  while (getSession(code)) code = sessionCode();
  const now = Date.now();
  db.prepare(
    `INSERT INTO sessions (code, workshop_title, created_at, updated_at) VALUES (?, ?, ?, ?)`
  ).run(code, cfg.workshopTitle || 'Workshop', now, now);

  const insSection = db.prepare(
    `INSERT INTO sections (session_code, section_order, key, title, objective, main_prompt, image, fields_json, default_timer)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  (cfg.sections || []).forEach((sec, i) => {
    insSection.run(
      code,
      sec.order || i + 1,
      sec.key,
      sec.title,
      sec.objective || '',
      sec.mainPrompt || '',
      sec.image || '',
      JSON.stringify(sec.fields || []),
      sec.defaultTimerSeconds || (cfg.defaults && cfg.defaults.defaultSectionTimerSeconds) || 600
    );
  });
  db.prepare('UPDATE sessions SET stage_order = ? WHERE code = ?').run(JSON.stringify(defaultStageOrder(code)), code);
  logActivity({ session_code: code, action: 'session_created' });
  res.json({ code });
});

router.get('/session/:code/state', (req, res) => {
  const state = buildState(req.params.code, { participantId: req.query.participant });
  if (!state) return res.status(404).json({ error: 'Session not found' });
  // Reachable-from-other-devices base URL for the room display's join prompt.
  state.shareBase = shareBaseUrl(req);
  state.joinUrl = `${state.shareBase}/join?session=${req.params.code}`;
  res.json(state);
});

router.get('/session/:code/qr', async (req, res) => {
  const s = getSession(req.params.code);
  if (!s) return res.status(404).send('not found');
  const url = `${shareBaseUrl(req)}/join?session=${req.params.code}`;
  try {
    const png = await QRCode.toBuffer(url, { width: 480, margin: 1, color: { dark: '#111111', light: '#ffffff' } });
    res.type('png').send(png);
  } catch (e) {
    res.status(500).send('qr error');
  }
});

// Master stage / display state.
router.post('/session/:code/status', (req, res) => {
  const s = requireSession(res, req.params.code); if (!s) return;
  const { status } = req.body;
  const allowed = ['welcome', 'roster', 'robot', 'groups', 'section', 'discussion', 'final'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'bad status' });
  db.prepare('UPDATE sessions SET status = ? WHERE code = ?').run(status, s.code);
  logActivity({ session_code: s.code, action: 'status', prev_value: s.status, new_value: status });
  ok(res, s.code, req);
});

router.post('/session/:code/section', (req, res) => {
  const s = requireSession(res, req.params.code); if (!s) return;
  const total = db.prepare('SELECT COUNT(*) n FROM sections WHERE session_code = ?').get(s.code).n;
  let next = s.current_section;
  if (req.body.action === 'next') next = Math.min(total, s.current_section + 1) || 1;
  else if (req.body.action === 'prev') next = Math.max(1, s.current_section - 1);
  else if (req.body.set != null) next = Math.max(1, Math.min(total, Number(req.body.set)));
  // Moving sections resets per-round state and immediately opens submissions.
  db.prepare(
    `UPDATE sessions SET current_section = ?, submission_status = 'open', voting_status = 'closed',
      selected_group_id = NULL, spin = NULL, status = 'section' WHERE code = ?`
  ).run(next, s.code);
  db.prepare(`UPDATE groups SET status = 'not_started' WHERE session_code = ?`).run(s.code);
  logActivity({ session_code: s.code, action: 'section', prev_value: s.current_section, new_value: next });
  ok(res, s.code, req);
});

// Reorder the facilitator flow by swapping a stage with its neighbour. If two
// rounds swap, their content (submissions/votes/notes) moves with them.
router.post('/session/:code/stage/reorder', (req, res) => {
  const s = requireSession(res, req.params.code); if (!s) return;
  const { token, direction } = req.body;
  const order = stageOrder(s);
  const i = order.indexOf(token);
  const j = direction === 'left' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= order.length) return res.status(400).json({ error: 'Cannot move that step.' });
  [order[i], order[j]] = [order[j], order[i]];
  db.prepare('UPDATE sessions SET stage_order = ? WHERE code = ?').run(JSON.stringify(order), s.code);
  reconcileSectionOrder(s.code, order);
  logActivity({ session_code: s.code, action: 'stage_reorder', new_value: `${token}:${direction}` });
  ok(res, s.code, req);
});

router.post('/session/:code/public-names', (req, res) => {
  const s = requireSession(res, req.params.code); if (!s) return;
  const v = req.body.value ? 1 : 0;
  db.prepare('UPDATE sessions SET public_names = ? WHERE code = ?').run(v, s.code);
  ok(res, s.code, req);
});

router.post('/session/:code/notes-shared', (req, res) => {
  const s = requireSession(res, req.params.code); if (!s) return;
  const v = req.body.value ? 1 : 0;
  db.prepare('UPDATE sessions SET notes_shared = ? WHERE code = ?').run(v, s.code);
  ok(res, s.code, req);
});

// ---------- timer ------------------------------------------------------------

router.post('/session/:code/timer', (req, res) => {
  const s = requireSession(res, req.params.code); if (!s) return;
  const { action } = req.body;
  const now = Date.now();
  const cur = timerRemaining(s);
  let ends = s.timer_ends_at, paused = s.timer_paused_remaining, dur = s.timer_duration;

  if (action === 'start') {
    let ms = Number(req.body.durationSeconds) * 1000;
    if (!ms || Number.isNaN(ms)) ms = paused != null ? paused : (dur || 600000);
    ends = now + ms; paused = null; dur = ms;
  } else if (action === 'pause') {
    if (ends != null && paused == null) { paused = Math.max(0, ends - now); ends = null; }
  } else if (action === 'resume') {
    if (paused != null) { ends = now + paused; paused = null; }
  } else if (action === 'reset') {
    ends = null; paused = null;
  } else if (action === 'add') {
    const delta = (Number(req.body.seconds) || 30) * 1000;
    if (ends != null) ends += delta;
    else if (paused != null) paused += delta;
  } else if (action === 'sub') {
    const delta = (Number(req.body.seconds) || 30) * 1000;
    if (ends != null) ends = Math.max(now, ends - delta);
    else if (paused != null) paused = Math.max(0, paused - delta);
  }
  db.prepare('UPDATE sessions SET timer_ends_at = ?, timer_paused_remaining = ?, timer_duration = ? WHERE code = ?')
    .run(ends, paused, dur, s.code);
  logActivity({ session_code: s.code, action: `timer_${action}` });
  ok(res, s.code, req);
});

// ---------- registration -----------------------------------------------------

router.post('/session/:code/register', (req, res) => {
  const s = requireSession(res, req.params.code); if (!s) return;
  const { name, company, role, presentPref, email, reportConsent } = req.body;
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Name is required' });
  const id = uid('p');
  const now = Date.now();
  const late = s.groups_finalized ? 1 : 0;
  db.prepare(
    `INSERT INTO participants (id, session_code, name, company, role, present_pref, email, report_consent, late_arrival, created_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id, s.code, String(name).trim(), (company || '').trim(), (role || '').trim(),
    ['yes', 'maybe', 'no'].includes(presentPref) ? presentPref : 'no',
    (email || '').trim() || null, reportConsent ? 1 : 0, late, now, now
  );
  logActivity({ session_code: s.code, actor: id, action: 'register', new_value: name });
  res.json({ participantId: id, sessionCode: s.code, lateArrival: !!late });
});

router.get('/session/:code/participant/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM participants WHERE id = ? AND session_code = ?').get(req.params.id, req.params.code);
  if (!p) return res.status(404).json({ error: 'not found' });
  db.prepare('UPDATE participants SET last_seen_at = ? WHERE id = ?').run(Date.now(), p.id);
  res.json({ participantId: p.id, name: p.name, groupId: p.group_id });
});

// ---------- grouping ---------------------------------------------------------

function runGrouping(code, { preserveLocked }) {
  const cfg = safeConfig() || {};
  const defaults = cfg.defaults || {};
  const participants = db.prepare('SELECT * FROM participants WHERE session_code = ?').all(code);

  let lockedByGroupName = {};
  if (preserveLocked) {
    const groupsById = new Map(db.prepare('SELECT * FROM groups WHERE session_code = ?').all(code).map((g) => [g.id, g]));
    for (const p of participants) {
      if (p.locked && p.group_id && groupsById.has(p.group_id)) {
        const gname = groupsById.get(p.group_id).name;
        (lockedByGroupName[gname] = lockedByGroupName[gname] || []).push(p.id);
      }
    }
  }

  const result = assignGroups(participants, {
    groupNamePool: cfg.groupNamePool || undefined,
    targetSize: defaults.targetGroupSize || 4,
    minGroups: defaults.minGroups || 1,
    maxGroups: defaults.maxGroups || (cfg.groupNamePool ? cfg.groupNamePool.length : 6),
    lockedByGroupName,
  });

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM groups WHERE session_code = ?').run(code);
    db.prepare('UPDATE participants SET group_id = NULL, is_presenter = 0, is_recorder = 0 WHERE session_code = ?').run(code);
    const insG = db.prepare(
      `INSERT INTO groups (id, session_code, name, presenter_id, recorder_id, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const now = Date.now();
    for (const g of result.groups) {
      const gid = uid('g');
      insG.run(gid, code, g.name, g.presenterId, g.recorderId, g.sort_order, now);
      for (const pid of g.memberIds) {
        db.prepare('UPDATE participants SET group_id = ? WHERE id = ?').run(gid, pid);
      }
      if (g.presenterId) db.prepare('UPDATE participants SET is_presenter = 1 WHERE id = ?').run(g.presenterId);
      if (g.recorderId) db.prepare('UPDATE participants SET is_recorder = 1 WHERE id = ?').run(g.recorderId);
    }
  });
  tx();
  logActivity({ session_code: code, action: preserveLocked ? 'groups_reroll' : 'groups_generate' });
  return result.warnings || [];
}

router.post('/session/:code/groups/generate', (req, res) => {
  const s = requireSession(res, req.params.code); if (!s) return;
  const warnings = runGrouping(s.code, { preserveLocked: false });
  db.prepare('UPDATE sessions SET status = ? WHERE code = ?').run('groups', s.code);
  res.json({ ok: true, warnings, state: buildState(s.code) });
});

router.post('/session/:code/groups/reroll', (req, res) => {
  const s = requireSession(res, req.params.code); if (!s) return;
  const warnings = runGrouping(s.code, { preserveLocked: true });
  res.json({ ok: true, warnings, state: buildState(s.code) });
});

router.post('/session/:code/groups/finalize', (req, res) => {
  const s = requireSession(res, req.params.code); if (!s) return;
  db.prepare('UPDATE sessions SET groups_finalized = 1 WHERE code = ?').run(s.code);
  logActivity({ session_code: s.code, action: 'groups_finalize' });
  ok(res, s.code, req);
});

// Overrides -------------------------------------------------------------------

router.post('/session/:code/participant/:id/lock', (req, res) => {
  const s = requireSession(res, req.params.code); if (!s) return;
  db.prepare('UPDATE participants SET locked = ? WHERE id = ? AND session_code = ?')
    .run(req.body.value ? 1 : 0, req.params.id, s.code);
  ok(res, s.code, req);
});

router.post('/session/:code/swap', (req, res) => {
  const s = requireSession(res, req.params.code); if (!s) return;
  const { a, b } = req.body;
  const pa = db.prepare('SELECT * FROM participants WHERE id = ? AND session_code = ?').get(a, s.code);
  const pb = db.prepare('SELECT * FROM participants WHERE id = ? AND session_code = ?').get(b, s.code);
  if (!pa || !pb) return res.status(400).json({ error: 'participants not found' });
  const tx = db.transaction(() => {
    db.prepare('UPDATE participants SET group_id = ? WHERE id = ?').run(pb.group_id, pa.id);
    db.prepare('UPDATE participants SET group_id = ? WHERE id = ?').run(pa.group_id, pb.id);
    fixGroupRoles(s.code, pa.group_id);
    fixGroupRoles(s.code, pb.group_id);
  });
  tx();
  logActivity({ session_code: s.code, action: 'swap', new_value: `${a}<->${b}` });
  ok(res, s.code, req);
});

router.post('/session/:code/move', (req, res) => {
  const s = requireSession(res, req.params.code); if (!s) return;
  const { participantId, groupId } = req.body;
  const p = db.prepare('SELECT * FROM participants WHERE id = ? AND session_code = ?').get(participantId, s.code);
  const g = db.prepare('SELECT * FROM groups WHERE id = ? AND session_code = ?').get(groupId, s.code);
  if (!p || !g) return res.status(400).json({ error: 'not found' });
  const old = p.group_id;
  db.prepare('UPDATE participants SET group_id = ?, late_arrival = 0 WHERE id = ?').run(groupId, participantId);
  fixGroupRoles(s.code, old);
  fixGroupRoles(s.code, groupId);
  logActivity({ session_code: s.code, action: 'move', prev_value: old, new_value: groupId });
  ok(res, s.code, req);
});

router.post('/session/:code/group/:gid/presenter', (req, res) => {
  const s = requireSession(res, req.params.code); if (!s) return;
  setRole(s.code, req.params.gid, req.body.participantId, 'presenter');
  ok(res, s.code, req);
});
router.post('/session/:code/group/:gid/recorder', (req, res) => {
  const s = requireSession(res, req.params.code); if (!s) return;
  setRole(s.code, req.params.gid, req.body.participantId, 'recorder');
  ok(res, s.code, req);
});
router.post('/session/:code/group/:gid/rename', (req, res) => {
  const s = requireSession(res, req.params.code); if (!s) return;
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'name required' });
  db.prepare('UPDATE groups SET name = ? WHERE id = ? AND session_code = ?').run(name, req.params.gid, s.code);
  ok(res, s.code, req);
});

function setRole(code, gid, participantId, role) {
  const col = role === 'presenter' ? 'is_presenter' : 'is_recorder';
  const gcol = role === 'presenter' ? 'presenter_id' : 'recorder_id';
  const g = db.prepare('SELECT * FROM groups WHERE id = ? AND session_code = ?').get(gid, code);
  if (!g) return;
  // clear old holder in this group
  db.prepare(`UPDATE participants SET ${col} = 0 WHERE group_id = ?`).run(gid);
  if (participantId) {
    db.prepare(`UPDATE participants SET ${col} = 1 WHERE id = ? AND group_id = ?`).run(participantId, gid);
  }
  db.prepare(`UPDATE groups SET ${gcol} = ? WHERE id = ?`).run(participantId || null, gid);
  logActivity({ session_code: code, action: `set_${role}`, new_value: `${gid}:${participantId}` });
}

// Keep group.presenter_id/recorder_id consistent if their holder left the group.
function fixGroupRoles(code, gid) {
  if (!gid) return;
  const g = db.prepare('SELECT * FROM groups WHERE id = ? AND session_code = ?').get(gid, code);
  if (!g) return;
  const members = db.prepare('SELECT * FROM participants WHERE group_id = ?').all(gid);
  const has = (id) => members.some((m) => m.id === id);
  let presenter = has(g.presenter_id) ? g.presenter_id : null;
  let recorder = has(g.recorder_id) ? g.recorder_id : null;
  if (!presenter) {
    const cand = members.find((m) => ['yes', 'maybe'].includes(m.present_pref)) || members[0];
    presenter = cand ? cand.id : null;
  }
  if (!recorder) {
    const cand = members.find((m) => m.id !== presenter) || members[0];
    recorder = cand ? cand.id : null;
  }
  db.prepare('UPDATE participants SET is_presenter = 0, is_recorder = 0 WHERE group_id = ?').run(gid);
  if (presenter) db.prepare('UPDATE participants SET is_presenter = 1 WHERE id = ?').run(presenter);
  if (recorder) db.prepare('UPDATE participants SET is_recorder = 1 WHERE id = ?').run(recorder);
  db.prepare('UPDATE groups SET presenter_id = ?, recorder_id = ? WHERE id = ?').run(presenter, recorder, gid);
}

// ---------- submissions ------------------------------------------------------

router.post('/session/:code/submission', (req, res) => {
  const s = requireSession(res, req.params.code); if (!s) return;
  const { participantId, response, summary, submit } = req.body;
  const p = db.prepare('SELECT * FROM participants WHERE id = ? AND session_code = ?').get(participantId, s.code);
  if (!p || !p.group_id) return res.status(400).json({ error: 'You are not in a group.' });
  if (!p.is_recorder) return res.status(403).json({ error: 'Only the group recorder can edit the answer.' });
  if (s.submission_status !== 'open') return res.status(409).json({ error: 'Submissions are closed.' });
  if (!s.current_section) return res.status(409).json({ error: 'No active section.' });

  const existing = db
    .prepare('SELECT * FROM submissions WHERE session_code = ? AND section_order = ? AND group_id = ?')
    .get(s.code, s.current_section, p.group_id);
  const now = Date.now();
  const respJson = JSON.stringify(response || {});
  const submitted = submit ? 1 : (existing ? existing.submitted : 0);
  if (existing) {
    db.prepare(
      `UPDATE submissions SET response_json = ?, summary_response = ?, submitted = ?, submitted_at = COALESCE(submitted_at, ?), updated_at = ? WHERE id = ?`
    ).run(respJson, summary || null, submitted, submit ? now : existing.submitted_at, now, existing.id);
  } else {
    db.prepare(
      `INSERT INTO submissions (id, session_code, section_order, group_id, response_json, summary_response, submitted, submitted_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(uid('s'), s.code, s.current_section, p.group_id, respJson, summary || null, submitted, submit ? now : null, now);
  }
  // group status
  const status = submitted ? 'submitted' : 'working';
  db.prepare(`UPDATE groups SET status = ? WHERE id = ? AND session_code = ?`).run(status, p.group_id, s.code);
  logActivity({ session_code: s.code, actor: participantId, action: submit ? 'submit' : 'save', new_value: p.group_id });
  res.json({ ok: true, state: buildState(s.code, { participantId }) });
});

// ---------- selection --------------------------------------------------------

router.post('/session/:code/select', (req, res) => {
  const s = requireSession(res, req.params.code); if (!s) return;
  const { mode, groupId } = req.body;
  const groups = db.prepare('SELECT * FROM groups WHERE session_code = ? ORDER BY sort_order').all(s.code);
  if (!groups.length) return res.status(409).json({ error: 'No groups yet.' });

  let chosen = null, spin = null;
  if (mode === 'manual') {
    chosen = groups.find((g) => g.id === groupId) || null;
  } else {
    // Random pick over groups that have NOT presented in any prior round. Presented
    // groups stay off the wheel for the rest of the workshop (fall back to all only
    // once everybody has presented).
    const notPresented = groups.filter((g) => !g.presented_round);
    const wheel = notPresented.length ? notPresented : groups;
    chosen = wheel[Math.floor(Math.random() * wheel.length)];
    spin = { nonce: Date.now(), target: chosen.id, wheel: wheel.map((g) => g.id) };
  }
  if (!chosen) return res.status(400).json({ error: 'Could not select a group.' });

  db.prepare(`UPDATE groups SET status = 'submitted' WHERE session_code = ? AND status = 'selected'`).run(s.code);
  db.prepare('UPDATE groups SET status = ?, heard_count = heard_count + 1, presented_round = COALESCE(presented_round, ?) WHERE id = ?')
    .run('selected', s.current_section, chosen.id);
  db.prepare('UPDATE sessions SET selected_group_id = ?, spin = ?, status = ? WHERE code = ?')
    .run(chosen.id, spin ? JSON.stringify(spin) : null, 'discussion', s.code);
  logActivity({ session_code: s.code, action: 'select', new_value: chosen.id });
  res.json({ ok: true, groupId: chosen.id, spin, state: buildState(s.code) });
});

router.post('/session/:code/select/clear', (req, res) => {
  const s = requireSession(res, req.params.code); if (!s) return;
  db.prepare('UPDATE sessions SET selected_group_id = NULL, spin = NULL, status = ? WHERE code = ?').run('section', s.code);
  ok(res, s.code, req);
});

// ---------- notes ------------------------------------------------------------

router.post('/session/:code/note', (req, res) => {
  const s = requireSession(res, req.params.code); if (!s) return;
  const { body, groupId, keyPoint, sectionOrder } = req.body;
  if (!body || !String(body).trim()) return res.status(400).json({ error: 'empty note' });
  db.prepare(
    'INSERT INTO notes (id, session_code, section_order, group_id, body, key_point, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(uid('n'), s.code, sectionOrder || s.current_section || 0, groupId || null, String(body).trim(), keyPoint ? 1 : 0, Date.now());
  logActivity({ session_code: s.code, action: 'note' });
  ok(res, s.code, req);
});

// ---------- live content editing ---------------------------------------------

// Merge a single edited field into this session's content overrides. scope is
// 'meta' | 'robot' | 'section' (section requires sectionKey). value may be a
// string or an array (for list fields like assumptions/discuss).
router.post('/session/:code/content', (req, res) => {
  const s = requireSession(res, req.params.code); if (!s) return;
  const { scope, sectionKey, field, value } = req.body;
  if (!field || !['meta', 'robot', 'section'].includes(scope)) return res.status(400).json({ error: 'bad content update' });
  const content = safeJson2(s.content) || {};
  if (scope === 'section') {
    if (!sectionKey) return res.status(400).json({ error: 'sectionKey required' });
    content.sections = content.sections || {};
    content.sections[sectionKey] = content.sections[sectionKey] || {};
    content.sections[sectionKey][field] = value;
  } else {
    content[scope] = content[scope] || {};
    content[scope][field] = value;
  }
  db.prepare('UPDATE sessions SET content = ? WHERE code = ?').run(JSON.stringify(content), s.code);
  logActivity({ session_code: s.code, action: 'content_edit', new_value: `${scope}.${sectionKey ? sectionKey + '.' : ''}${field}` });
  ok(res, s.code, req);
});

// Accept a base64 image, store it beside the DB, return a served URL.
router.post('/session/:code/upload', (req, res) => {
  const s = requireSession(res, req.params.code); if (!s) return;
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(req.body.dataUrl || '');
  if (!m) return res.status(400).json({ error: 'Expected a base64 image data URL.' });
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 15 * 1024 * 1024) return res.status(413).json({ error: 'Image too large (max 15 MB).' });
  const ext = m[1].split('/')[1].replace('svg+xml', 'svg').replace('jpeg', 'jpg').replace(/[^a-z0-9]/gi, '') || 'png';
  const name = `${s.code}_${Date.now()}.${ext}`;
  try { fs.writeFileSync(path.join(UPLOADS_DIR, name), buf); }
  catch (e) { return res.status(500).json({ error: 'Could not save image.' }); }
  logActivity({ session_code: s.code, action: 'upload', new_value: name });
  res.json({ ok: true, url: `/uploads/${name}` });
});

// ---------- control token ----------------------------------------------------

router.post('/session/:code/control/take', (req, res) => {
  const s = requireSession(res, req.params.code); if (!s) return;
  db.prepare('UPDATE sessions SET control_device_id = ? WHERE code = ?').run(req.body.deviceId || null, s.code);
  logActivity({ session_code: s.code, action: 'take_control', new_value: req.body.deviceId });
  ok(res, s.code, req);
});

// ---------- exports ----------------------------------------------------------

router.get('/session/:code/export/section/:order', (req, res) => {
  const s = getSession(req.params.code);
  if (!s) return res.status(404).send('not found');
  const md = renderSection(s.code, Number(req.params.order), { heading: '#' });
  sendMarkdown(res, `${s.code}_section_${req.params.order}.md`, md);
});

router.get('/session/:code/export/brief', (req, res) => {
  const s = getSession(req.params.code);
  if (!s) return res.status(404).send('not found');
  const md = buildBriefPackage(s.code);
  // Persist a copy to /exports for the facilitator.
  try {
    const fs = require('fs'); const path = require('path');
    const dir = path.join(__dirname, '..', '..', 'exports');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${s.code}_brief_package.md`), md);
  } catch (_) {}
  sendMarkdown(res, `${s.code}_brief_package.md`, md);
});

// ---------- simulation (testing aid — safe to remove) ------------------------

// Add synthetic participants drawn from the 50-person pool, each carrying canned
// per-section answers used later when simulating their group's submission.
router.post('/session/:code/sim/participants', (req, res) => {
  const s = requireSession(res, req.params.code); if (!s) return;
  const count = Math.max(1, Math.min(20, Number(req.body.count) || 2));
  const existingSim = db
    .prepare("SELECT COUNT(*) n FROM participants WHERE session_code = ? AND sim_answers IS NOT NULL")
    .get(s.code).n;
  const now = Date.now();
  const ins = db.prepare(
    `INSERT INTO participants (id, session_code, name, company, role, present_pref, sim_answers, late_arrival, created_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const tx = db.transaction(() => {
    for (let k = 0; k < count; k++) {
      const idx = existingSim + k;
      const person = simPerson(idx % POOL_SIZE);
      const suffix = idx >= POOL_SIZE ? ` #${Math.floor(idx / POOL_SIZE) + 1}` : '';
      ins.run(uid('p'), s.code, person.name + suffix, person.company, person.role,
        person.presentPref, JSON.stringify(person.answers), s.groups_finalized ? 1 : 0, now + k, now + k);
    }
  });
  tx();
  logActivity({ session_code: s.code, action: 'sim_participants', new_value: count });
  ok(res, s.code, req);
});

// Simulate one group's submission for the current section, using its recorder's
// canned answers. Testing shortcut: works regardless of the open/closed gate.
router.post('/session/:code/sim/submission', (req, res) => {
  const s = requireSession(res, req.params.code); if (!s) return;
  if (!s.current_section) return res.status(409).json({ error: 'No active section.' });
  const secRow = db.prepare('SELECT key FROM sections WHERE session_code = ? AND section_order = ?').get(s.code, s.current_section);
  const groups = db.prepare('SELECT * FROM groups WHERE session_code = ? ORDER BY sort_order').all(s.code);
  const next = groups.find((g) => g.status !== 'submitted' && g.status !== 'selected');
  if (!next) return res.status(409).json({ error: 'All groups have already submitted.' });

  const recorder = next.recorder_id
    ? db.prepare('SELECT * FROM participants WHERE id = ?').get(next.recorder_id)
    : db.prepare('SELECT * FROM participants WHERE group_id = ? LIMIT 1').get(next.id);
  let answers = {};
  try { answers = recorder && recorder.sim_answers ? JSON.parse(recorder.sim_answers)[secRow.key] || {} : {}; } catch (_) {}
  const summary = answers.summary || `${next.name} — simulated answer`;
  const response = Object.fromEntries(Object.entries(answers).filter(([k]) => k !== 'summary'));

  const now = Date.now();
  db.prepare(
    `INSERT INTO submissions (id, session_code, section_order, group_id, response_json, summary_response, submitted, submitted_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
     ON CONFLICT(session_code, section_order, group_id) DO UPDATE SET
       response_json = excluded.response_json, summary_response = excluded.summary_response,
       submitted = 1, submitted_at = COALESCE(submissions.submitted_at, excluded.submitted_at), updated_at = excluded.updated_at`
  ).run(uid('s'), s.code, s.current_section, next.id, JSON.stringify(response), summary, now, now);
  db.prepare(`UPDATE groups SET status = 'submitted' WHERE id = ?`).run(next.id);
  logActivity({ session_code: s.code, action: 'sim_submission', new_value: next.name });
  res.json({ ok: true, group: next.name, state: buildState(s.code) });
});


// ---------- shared responders ------------------------------------------------

function requireSession(res, code) {
  const s = getSession(code);
  if (!s) { res.status(404).json({ error: 'Session not found' }); return null; }
  return s;
}
function ok(res, code, req) {
  touch(code);
  res.json({ ok: true, state: buildState(code, { participantId: req.query.participant || (req.body && req.body.participantId) }) });
}
function sendMarkdown(res, filename, md) {
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(md);
}

module.exports = router;
