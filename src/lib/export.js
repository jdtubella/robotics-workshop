'use strict';

const { db } = require('../db');

function esc(s) {
  return (s == null ? '' : String(s)).replace(/\r/g, '');
}

function participantsByGroup(code) {
  const rows = db.prepare('SELECT * FROM participants WHERE session_code = ?').all(code);
  const map = new Map();
  for (const p of rows) {
    if (!p.group_id) continue;
    if (!map.has(p.group_id)) map.set(p.group_id, []);
    map.get(p.group_id).push(p);
  }
  return map;
}

function gatherSection(code, order) {
  const section = db
    .prepare('SELECT * FROM sections WHERE session_code = ? AND section_order = ?')
    .get(code, order);
  if (!section) return null;
  const groups = db
    .prepare('SELECT * FROM groups WHERE session_code = ? ORDER BY sort_order')
    .all(code);
  const subs = db
    .prepare('SELECT * FROM submissions WHERE session_code = ? AND section_order = ?')
    .all(code, order);
  const subByGroup = new Map(subs.map((s) => [s.group_id, s]));
  const notes = db
    .prepare(
      'SELECT * FROM notes WHERE session_code = ? AND section_order = ? ORDER BY created_at'
    )
    .all(code, order);
  const transcripts = db
    .prepare('SELECT * FROM transcripts WHERE session_code = ? AND section_order = ? ORDER BY created_at')
    .all(code, order);
  const members = participantsByGroup(code);
  return { section, groups, subByGroup, notes, transcripts, members };
}

function renderSection(code, order, { heading = '##' } = {}) {
  const data = gatherSection(code, order);
  if (!data) return `${heading} Section ${order}\n\n_(not found)_\n`;
  const { section, groups, subByGroup, notes, transcripts, members } = data;
  const fields = JSON.parse(section.fields_json || '[]');
  const lines = [];

  lines.push(`${heading} Section ${section.section_order}: ${esc(section.title)}`);
  lines.push('');
  if (section.objective) lines.push(`**Objective:** ${esc(section.objective)}`);
  if (section.main_prompt) lines.push(`**Main prompt:** ${esc(section.main_prompt)}`);
  lines.push('');

  // Submissions
  lines.push(`${heading}# Group Submissions`);
  lines.push('');
  for (const g of groups) {
    const sub = subByGroup.get(g.id);
    const mem = (members.get(g.id) || []).map((m) => esc(m.name)).join(', ');
    lines.push(`${heading}## ${esc(g.name)}`);
    if (mem) lines.push(`_Members: ${mem}_`);
    lines.push('');
    let resp = {};
    try { resp = JSON.parse((sub && sub.response_json) || '{}'); } catch (_) {}
    const answered = sub ? fields.filter((f) => resp[f.key] && String(resp[f.key]).trim()) : [];
    // Include drafts too — anything with content should never be lost.
    if (!sub || (!sub.summary_response && !answered.length)) {
      lines.push('> _No submission._');
      lines.push('');
      continue;
    }
    if (!sub.submitted) lines.push('_(draft — saved but not formally submitted)_\n');
    if (sub.summary_response) {
      lines.push(`**Collective answer:** ${esc(sub.summary_response)}`);
      lines.push('');
    }
    for (const f of answered) {
      lines.push(`- **${esc(f.label)}:** ${esc(resp[f.key])}`);
    }
    if (answered.length) lines.push('');
  }

  // Facilitator notes
  lines.push(`${heading}# Facilitator Notes & Room Discussion`);
  lines.push('');
  if (!notes.length) {
    lines.push('_No notes recorded._');
    lines.push('');
  } else {
    const groupName = new Map(groups.map((g) => [g.id, g.name]));
    for (const n of notes) {
      const tag = n.key_point ? '⭐ ' : '';
      const who = n.group_id ? `(${esc(groupName.get(n.group_id) || 'group')}) ` : '';
      lines.push(`- ${tag}${who}${esc(n.body)}`);
    }
    lines.push('');
  }

  // Room transcript (from the live recorder)
  if (transcripts && transcripts.length) {
    lines.push(`${heading}# Room Transcript`);
    lines.push('');
    for (const t of transcripts) {
      if (t.label) lines.push(`${heading}## ${esc(t.label)}`);
      if (t.audio_url) lines.push(`_Audio: ${esc(t.audio_url)}_\n`);
      lines.push(esc(t.text));
      lines.push('');
    }
  }

  return lines.join('\n');
}

const SYNTHESIS_PROMPT = `# Instructions for Claude

You are synthesizing the raw output of a live one-hour stakeholder workshop into a
**Preliminary Robotic Product Requirements Brief**. This is NOT an approved PRD — it captures
early stakeholder intelligence that still requires validation.

Using ONLY the workshop data that follows, produce a brief with these sections:

1. Workshop purpose and disclaimer
2. Fictional robot concept
3. Problem statement
4. Intended users and stakeholders
5. Priority use cases
6. Candidate functional requirements
7. Jobsite workflow
8. Human–robot interaction
9. Safety and successful-failure concepts
10. Connectivity and teleoperation
11. Data, telemetry, and reporting
12. Materials and logistics
13. Constraints and assumptions
14. Preliminary success measures
15. Areas of disagreement
16. Open questions
17. Validation and research required
18. Recommended next steps
19. Appendix of group submissions
20. Participation and voting summary

For every candidate requirement, add a traceability block:

\`\`\`json
{
  "requirement": "The robot shall...",
  "source_section": "Safety",
  "source_groups": ["Atlas", "Crane"],
  "discussion_support": "High | Medium | Low",
  "confidence": "Preliminary",
  "needs_validation": true
}
\`\`\`

Label each item as one of: **Discussed**, **Supported by multiple groups**, **Proposed requirement**,
**Unresolved**, **Requires technical validation**, or **Outside workshop scope**. Never present
workshop conversation as approved engineering requirements.

---
`;

function buildBriefPackage(code) {
  const session = db.prepare('SELECT * FROM sessions WHERE code = ?').get(code);
  if (!session) throw new Error('Session not found');
  const config = safeConfig();
  const sections = db
    .prepare('SELECT section_order FROM sections WHERE session_code = ? ORDER BY section_order')
    .all(code);
  const participants = db.prepare('SELECT * FROM participants WHERE session_code = ?').all(code);
  const consented = participants.filter((p) => p.report_consent && p.email);

  const out = [];
  out.push(SYNTHESIS_PROMPT);
  out.push(`# Workshop Data: ${esc(session.workshop_title)}`);
  out.push('');
  out.push(`- **Session code:** ${esc(code)}`);
  out.push(`- **Generated:** ${new Date().toISOString()}`);
  out.push(`- **Participants registered:** ${participants.length}`);
  out.push('');

  // Robot concept from config
  if (config && config.robot) {
    const r = config.robot;
    out.push('## Fictional Robot Concept');
    out.push('');
    out.push(`- **Name:** ${esc(r.name)}`);
    if (r.tagline) out.push(`- **Tagline:** ${esc(r.tagline)}`);
    if (r.task) out.push(`- **Task:** ${esc(r.task)}`);
    if (r.environment) out.push(`- **Environment:** ${esc(r.environment)}`);
    if (r.autonomyLevel) out.push(`- **Autonomy:** ${esc(r.autonomyLevel)}`);
    if (Array.isArray(r.assumptions) && r.assumptions.length)
      out.push(`- **Fixed assumptions:** ${r.assumptions.map(esc).join('; ')}`);
    if (Array.isArray(r.constraints) && r.constraints.length)
      out.push(`- **Constraints:** ${r.constraints.map(esc).join('; ')}`);
    if (Array.isArray(r.unresolvedQuestions) && r.unresolvedQuestions.length)
      out.push(`- **Intentionally unresolved:** ${r.unresolvedQuestions.map(esc).join('; ')}`);
    out.push('');
  }

  for (const s of sections) {
    out.push('---');
    out.push('');
    out.push(renderSection(code, s.section_order, { heading: '##' }));
    out.push('');
  }

  // Participation summary
  out.push('---');
  out.push('');
  out.push('## Participation & Report Sign-up');
  out.push('');
  out.push(`- Registered participants: ${participants.length}`);
  out.push(`- Consented to receive the report: ${consented.length}`);
  if (consented.length) {
    out.push('');
    out.push('| Name | Company | Email |');
    out.push('|---|---|---|');
    for (const p of consented) {
      out.push(`| ${esc(p.name)} | ${esc(p.company)} | ${esc(p.email)} |`);
    }
  }
  out.push('');
  return out.join('\n');
}

function safeConfig() {
  try {
    return require('../config').loadConfig();
  } catch (_) {
    return null;
  }
}

module.exports = { renderSection, buildBriefPackage };
