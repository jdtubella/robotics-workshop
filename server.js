'use strict';

const path = require('path');
const express = require('express');
const apiRouter = require('./src/routes/api');

const app = express();
// Behind a hosting proxy/tunnel so req.protocol + forwarded host resolve correctly
// (makes the QR/share URL use the public https address automatically).
app.set('trust proxy', true);
app.use(express.json({ limit: '25mb' })); // large enough to accept a base64 image upload

// Lightweight health check for uptime monitors / keep-warm pings.
app.get('/healthz', (req, res) => res.json({ ok: true, ts: Date.now() }));

// Static assets and front-end views (uploads live under assets/uploads).
app.use('/assets', express.static(path.join(__dirname, 'assets')));
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  const where = process.env.BASE_URL || `http://localhost:${PORT}`;
  console.log(`Construction Robotics Workshop running (${where})`);
});
