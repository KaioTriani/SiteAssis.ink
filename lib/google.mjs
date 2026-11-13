// Integração com a Google Calendar API (OAuth 2.0, lado do servidor).
// Nada daqui vai para o navegador: client secret, refresh token e access token ficam só no servidor.
import { readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { DATA_DIR } from './store.mjs';

const TOKEN_FILE = () => join(DATA_DIR, 'google-token.json');
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.freebusy',
  'openid', 'email',
];

const env = () => ({
  clientId: process.env.GOOGLE_CLIENT_ID || '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  redirectUri: process.env.GOOGLE_REDIRECT_URI || '',
  calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
});

let access = { token: null, exp: 0 };

export function credentialsPresent() {
  const e = env();
  return Boolean(e.clientId && e.clientSecret && e.redirectUri);
}

async function loadToken() {
  try { return JSON.parse(await readFile(TOKEN_FILE(), 'utf8')); } catch { return null; }
}

export async function status() {
  const t = await loadToken();
  return {
    credentials: credentialsPresent(),
    connected: Boolean(credentialsPresent() && t?.refresh_token),
    account: t?.email || null,
    connectedAt: t?.connectedAt || null,
    calendarId: env().calendarId,
  };
}

export async function isReady() {
  return (await status()).connected;
}

export function authUrl(state) {
  const e = env();
  const p = new URLSearchParams({
    client_id: e.clientId,
    redirect_uri: e.redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return 'https://accounts.google.com/o/oauth2/v2/auth?' + p;
}

export async function exchangeCode(code) {
  const e = env();
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: e.clientId, client_secret: e.clientSecret, redirect_uri: e.redirectUri, grant_type: 'authorization_code' }),
  });
  const data = await r.json();
  if (!r.ok || !data.refresh_token) throw new Error('Google não devolveu refresh token: ' + (data.error_description || data.error || r.status));
  let email = null;
  if (data.id_token) {
    try { email = JSON.parse(Buffer.from(data.id_token.split('.')[1], 'base64url').toString()).email || null; } catch {}
  }
  await writeFile(TOKEN_FILE(), JSON.stringify({ refresh_token: data.refresh_token, email, connectedAt: new Date().toISOString(), scope: data.scope }, null, 2), { mode: 0o600 });
  access = { token: data.access_token, exp: Date.now() + (data.expires_in - 60) * 1000 };
  return { email };
}

export async function disconnect() {
  const t = await loadToken();
  if (t?.refresh_token) {
    await fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(t.refresh_token), { method: 'POST' }).catch(() => {});
  }
  await rm(TOKEN_FILE(), { force: true });
  access = { token: null, exp: 0 };
}

async function token() {
  if (access.token && Date.now() < access.exp) return access.token;
  const t = await loadToken();
  if (!t?.refresh_token) throw new Error('Google Agenda não conectada');
  const e = env();
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: e.clientId, client_secret: e.clientSecret, refresh_token: t.refresh_token, grant_type: 'refresh_token' }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error('Falha ao renovar acesso ao Google: ' + (data.error_description || data.error));
  access = { token: data.access_token, exp: Date.now() + (data.expires_in - 60) * 1000 };
  return access.token;
}

async function api(path, opts = {}) {
  const r = await fetch('https://www.googleapis.com/calendar/v3' + path, {
    ...opts,
    headers: { Authorization: 'Bearer ' + await token(), 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  if (r.status === 204) return null;
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('Google Calendar ' + r.status + ': ' + (data.error?.message || 'erro'));
  return data;
}

// Intervalos ocupados na agenda (apenas início/fim; nenhum detalhe de evento é lido).
export async function busy(timeMin, timeMax) {
  const id = env().calendarId;
  const data = await api('/freeBusy', {
    method: 'POST',
    body: JSON.stringify({ timeMin: new Date(timeMin).toISOString(), timeMax: new Date(timeMax).toISOString(), items: [{ id }] }),
  });
  const cal = data.calendars?.[id];
  if (cal?.errors?.length) throw new Error('Google Calendar: ' + cal.errors.map((e) => e.reason).join(', '));
  return (cal?.busy || []).map((b) => ({ start: Date.parse(b.start), end: Date.parse(b.end) }));
}

export async function createEvent({ summary, description, start, end, timeZone, attendeeEmail, bookingId }) {
  const id = encodeURIComponent(env().calendarId);
  const body = {
    summary, description,
    start: { dateTime: new Date(start).toISOString(), timeZone },
    end: { dateTime: new Date(end).toISOString(), timeZone },
    extendedProperties: { private: { assisInkBooking: bookingId } },
    reminders: { useDefault: true },
  };
  if (attendeeEmail) body.attendees = [{ email: attendeeEmail }];
  return api(`/calendars/${id}/events?sendUpdates=${attendeeEmail ? 'all' : 'none'}`, { method: 'POST', body: JSON.stringify(body) });
}

export async function deleteEvent(eventId) {
  const id = encodeURIComponent(env().calendarId);
  return api(`/calendars/${id}/events/${encodeURIComponent(eventId)}?sendUpdates=all`, { method: 'DELETE' });
}

// Próximos eventos para o painel do artista (somente no admin, nunca no site público).
export async function upcoming(days = 30) {
  const id = encodeURIComponent(env().calendarId);
  const p = new URLSearchParams({
    timeMin: new Date().toISOString(),
    timeMax: new Date(Date.now() + days * 864e5).toISOString(),
    singleEvents: 'true', orderBy: 'startTime', maxResults: '50',
  });
  const data = await api(`/calendars/${id}/events?${p}`);
  return (data.items || []).map((e) => ({
    id: e.id, summary: e.summary || '(sem título)', start: e.start?.dateTime || e.start?.date, end: e.end?.dateTime || e.end?.date,
    link: e.htmlLink, booking: e.extendedProperties?.private?.assisInkBooking || null,
  }));
}
