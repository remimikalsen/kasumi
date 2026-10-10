// Shared input validation for leaderboard endpoints.
// Initials are 1-3 letters/digits; numeric scores must be finite and within a sane range.

const INITIALS_RE = /^[a-z0-9æøåáéíóúãõç]{1,3}$/i;

function parseInitials(value) {
  if (typeof value !== 'string') return null;
  const initials = value.trim();
  return INITIALS_RE.test(initials) ? initials.toLowerCase() : null;
}

function parseInteger(value, { min = 0, max = 1000000 } = {}) {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  if (n < min || n > max) return null;
  return n;
}

function parseNumber(value, { min = 0, max = 1000000 } = {}) {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < min || n > max) return null;
  return n;
}

module.exports = { parseInitials, parseInteger, parseNumber };
