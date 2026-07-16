'use strict';

// Shared front-end helpers: API client, session-state poller, timer math,
// local participant/session persistence, small DOM utilities.

const WS = {
  qs: new URLSearchParams(location.search),
  session: null,
  deviceId: null,

  init() {
    this.session = this.qs.get('session');
    this.deviceId = localStorage.getItem('ws_device_id');
    if (!this.deviceId) {
      this.deviceId = 'd_' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem('ws_device_id', this.deviceId);
    }
    // Facilitator key: arrives once via ?key= (from the session-created link),
    // then persists per-session in localStorage. Participant pages never have one.
    if (this.session) {
      const urlKey = this.qs.get('key');
      if (urlKey) localStorage.setItem('ws_fkey_' + this.session, urlKey);
      this.fkey = urlKey || localStorage.getItem('ws_fkey_' + this.session) || null;
    }
    return this;
  },
  // Append the key to a same-origin URL (for <a href> downloads that can't send headers).
  keyed(url) { return this.fkey ? url + (url.includes('?') ? '&' : '?') + 'key=' + encodeURIComponent(this.fkey) : url; },

  // ---- API ----------------------------------------------------------------
  async api(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (this.fkey) opts.headers['x-facilitator-key'] = this.fkey;
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch('/api' + path, opts);
    let data = null;
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) {
      const msg = (data && data.error) || res.statusText;
      throw new Error(msg);
    }
    return data;
  },
  get(p) { return this.api('GET', p); },
  post(p, b) { return this.api('POST', p, b); },

  // ---- State polling ------------------------------------------------------
  poller: null,
  lastState: null,
  _onState: null,
  _fails: 0,

  startPolling(intervalMs, onState, { participant } = {}) {
    this._onState = onState;
    const tick = async () => {
      try {
        const q = participant ? `?participant=${encodeURIComponent(participant)}` : '';
        const state = await this.get(`/session/${this.session}/state${q}`);
        this.lastState = state;
        this._fails = 0;
        setConn('live');
        onState(state);
      } catch (e) {
        this._fails++;
        setConn(this._fails > 2 ? 'down' : 'stale');
      }
    };
    tick();
    this.poller = setInterval(tick, intervalMs);
    return this;
  },
  refreshNow() {
    if (this._onState && this.lastState) {
      const q = new URLSearchParams(location.search).get('participant');
      const qp = q ? `?participant=${encodeURIComponent(q)}` : '';
      this.get(`/session/${this.session}/state${qp}`).then((s) => { this.lastState = s; this._onState(s); }).catch(() => {});
    }
  },

  // ---- Participant persistence -------------------------------------------
  participantKey() { return `ws_participant_${this.session}`; },
  saveParticipant(id) { localStorage.setItem(this.participantKey(), id); },
  loadParticipant() { return localStorage.getItem(this.participantKey()); },
  clearParticipant() { localStorage.removeItem(this.participantKey()); },
};

// ---- Timer formatting ------------------------------------------------------
function fmtTime(ms) {
  if (ms == null) return '--:--';
  const t = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// A local countdown that re-syncs from server state on every poll.
function makeCountdown(el, { lowAt = 15000 } = {}) {
  let endsAt = null, frozenMs = null, running = false;
  function render() {
    let ms;
    if (running && endsAt != null) ms = endsAt - Date.now();
    else ms = frozenMs;
    el.textContent = fmtTime(ms);
    el.classList.toggle('low', ms != null && ms <= lowAt && ms > 0);
    // Hide the big idle "--:--" so it doesn't read as gray blocks on the room display.
    if (el.classList.contains('huge')) el.style.visibility = ms == null ? 'hidden' : 'visible';
  }
  setInterval(render, 250);
  return {
    sync(timer, serverNow) {
      running = !!(timer && timer.running);
      if (running && timer.remainingMs != null) endsAt = Date.now() + timer.remainingMs;
      else { endsAt = null; frozenMs = timer ? timer.remainingMs : null; }
      render();
    },
  };
}

// ---- DOM helpers -----------------------------------------------------------
function el(id) { return document.getElementById(id); }
function h(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    // Boolean attributes (disabled, checked, selected…): present only when true.
    // `setAttribute(k, false)` would still apply them, so handle booleans explicitly.
    else if (typeof v === 'boolean') { if (v) n.setAttribute(k, ''); }
    else if (v != null) n.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return n;
}
function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }

let _toastTimer = null;
function toast(msg, isErr) {
  let t = el('ws_toast');
  if (!t) { t = h('div', { id: 'ws_toast', class: 'toast' }); document.body.appendChild(t); }
  t.textContent = msg;
  t.className = 'toast show' + (isErr ? ' err' : '');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { t.className = 'toast'; }, 2600);
}

function setConn(state) {
  const c = el('conn');
  if (!c) return;
  c.className = 'conn ' + state;
  const label = { live: 'LIVE', stale: 'RECONNECTING', down: 'OFFLINE' }[state] || state;
  c.innerHTML = `<span class="dot"></span>${label}`;
}

function roleIcon(isPresenter, isRecorder) {
  const p = isPresenter ? '🎤' : '';
  const r = isRecorder ? '✏️' : '';
  return (p + ' ' + r).trim();
}

// Map a participant list into a quick lookup.
function indexBy(arr, key) { const m = new Map(); for (const x of arr) m.set(x[key], x); return m; }

window.WS = WS;
