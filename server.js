'use strict';

const path = require('path');
const express = require('express');
const apiRouter = require('./src/routes/api');
const { db, RECORDINGS_DIR, UPLOADS_DIR } = require('./src/db');

const app = express();
// Behind a hosting proxy/tunnel so req.protocol + forwarded host resolve correctly
// (makes the QR/share URL use the public https address automatically).
app.set('trust proxy', true);
// Audio uploads arrive as base64 JSON and can be large (a full round + discussion);
// everything else keeps a tighter limit. Path-specific parser must come first.
app.use('/api/session/:code/audio', express.json({ limit: '120mb' }));
app.use(express.json({ limit: '25mb' })); // large enough for a base64 image upload

// Lightweight health check for uptime monitors / keep-warm pings.
app.get('/healthz', (req, res) => res.json({ ok: true, ts: Date.now() }));

// Uploaded images: persistent-disk copies first, then the repo's committed ones.
app.use('/assets/uploads', express.static(UPLOADS_DIR));
// Static assets and front-end views.
app.use('/assets', express.static(path.join(__dirname, 'assets')));
// Audio recordings, forced to download. Facilitator-key gated: the session code
// is embedded in every filename, so look its key up and require a match.
app.use('/recordings', (req, res, next) => {
  const m = /^\/([A-Za-z0-9]+)_/.exec(req.path);
  const s = m && db.prepare('SELECT facilitator_key FROM sessions WHERE code = ?').get(m[1].toUpperCase());
  if (s && s.facilitator_key && req.query.key !== s.facilitator_key) {
    return res.status(403).send('Facilitator key required');
  }
  next();
}, express.static(RECORDINGS_DIR, {
  setHeaders: (res) => res.setHeader('Content-Disposition', 'attachment'),
}));
app.use(express.static(path.join(__dirname, 'public')));

// API.
app.use('/api', apiRouter);

// View routes -> serve the matching HTML shell (client reads ?session=/?participant= from URL).
const view = (file) => (req, res) => res.sendFile(path.join(__dirname, 'public', file));
app.get('/', view('index.html'));
app.get('/display', view('display.html'));
app.get('/facilitator', view('facilitator.html'));
app.get('/join', view('join.html'));
app.get('/group', view('group.html'));

app.use((req, res) => res.status(404).send('Not found'));

// Last-resort error handler: log server-side, never leak stack traces to clients.
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (res.headersSent) return next(err);
  const status = err.type === 'entity.too.large' ? 413 : err.status || 500;
  res.status(status).json({ error: status === 413 ? 'Payload too large.' : 'Server error.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  const where = process.env.BASE_URL || `http://localhost:${PORT}`;
  console.log(`Construction Robotics Workshop running (${where})`);
});
