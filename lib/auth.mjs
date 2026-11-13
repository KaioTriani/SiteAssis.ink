// Sessão do painel (cookie assinado com HMAC) e senha do artista (scrypt).
import { createHmac, scryptSync, timingSafeEqual, randomBytes } from 'node:crypto';

const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('Defina SESSION_SECRET (32+ caracteres) no .env');
  return s;
};

export function hashPassword(pw) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt:${salt}:${scryptSync(pw, salt, 64).toString('hex')}`;
}

export function checkPassword(pw) {
  const stored = process.env.ADMIN_PASSWORD_HASH || '';
  if (!stored.startsWith('scrypt:') || typeof pw !== 'string' || !pw) return false;
  const [, salt, hex] = stored.split(':');
  const a = Buffer.from(hex, 'hex');
  const b = scryptSync(pw, salt, 64);
  return a.length === b.length && timingSafeEqual(a, b);
}

const sign = (v) => createHmac('sha256', secret()).update(v).digest('base64url');

export function makeToken(payload, ttlMs) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + ttlMs })).toString('base64url');
  return body + '.' + sign(body);
}

export function readToken(tok) {
  if (!tok || !tok.includes('.')) return null;
  const [body, sig] = tok.split('.');
  const expect = sign(body);
  if (sig.length !== expect.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  const data = JSON.parse(Buffer.from(body, 'base64url').toString());
  return data.exp > Date.now() ? data : null;
}

export function cookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function cookie(name, value, { maxAge, secure }) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

// Limite simples por IP (memória do processo).
const hits = new Map();
export function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return list.length <= max;
}
