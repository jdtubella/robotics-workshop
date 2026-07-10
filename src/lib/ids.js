'use strict';

const crypto = require('crypto');

// Unambiguous alphabet for human-typed session codes (no 0/O, 1/I/L).
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function sessionCode(len = 5) {
  let out = '';
  const bytes = crypto.randomBytes(len);
  for (let i = 0; i < len; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

// Longer opaque IDs for participants, groups, submissions, etc.
function uid(prefix = '') {
  const raw = crypto.randomBytes(9).toString('base64url');
  return prefix ? `${prefix}_${raw}` : raw;
}

module.exports = { sessionCode, uid, CODE_ALPHABET };
