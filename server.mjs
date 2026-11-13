// Assis.ink · servidor do site, agendamento, Google Agenda e painel do artista.
// Uso: node server.mjs   (Node 20.11+; sem dependências externas)
import { createServer } from 'node:http';
import { readFile, stat, writeFile, mkdir, readdir } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// .env simples (KEY=valor), sem sobrescrever variáveis já definidas no ambiente
const envFile = new URL('./.env', import.meta.url);
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const store = await import('./lib/store.mjs');
const google = await import('./lib/google.mjs');
const slotsLib = await import('./lib/slots.mjs');
const auth = await import('./lib/auth.mjs');

await store.init();

const ROOT = fileURLToPath(new URL('./public/', import.meta.url));
// A Hostinger (LiteSpeed) pode passar a porta como número ou como caminho de socket.
const RAW_PORT = (process.env.PORT || '').trim();
const PORT = RAW_PORT ? (/^\d+$/.test(RAW_PORT) ? Number(RAW_PORT) : RAW_PORT) : 4330;
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const SECURE = PUBLIC_URL.startsWith('https://');
const SESSION = 'ai_session';
const SITE_PLACEHOLDER = 'https://www.assisink.com.br';
const ADMIN_TTL = 12 * 3600e3;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.mp4': 'video/mp4',
};

const SECURITY = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

// ---------- utilidades HTTP ----------
function send(res, status, body, headers = {}) {
  const isObj = typeof body === 'object' && !Buffer.isBuffer(body);
  res.writeHead(status, { ...SECURITY, ...(isObj ? { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } : {}), ...headers });
  res.end(isObj ? JSON.stringify(body) : body);
}
const fail = (res, status, message, extra = {}) => send(res, status, { ok: false, error: message, ...extra });

function body(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(Object.assign(new Error('Envio muito grande'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch { reject(Object.assign(new Error('JSON inválido'), { status: 400 })); } });
    req.on('error', reject);
  });
}

const ip = (req) => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';
const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function sniff(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return 'webp';
  return null;
}

async function settings() { return store.read('settings'); }

// ---------- reservas: horários ocupados = Google + pedidos pendentes ainda válidos ----------
async function holds(rules, exceptId) {
  const list = (await store.read('bookings')) || [];
  const now = Date.now();
  return list
    .filter((b) => b.id !== exceptId && b.status === 'aguardando' && b.schedule?.slotStart && now - Date.parse(b.createdAt) < rules.holdHours * 3600e3)
    .map((b) => ({ start: Date.parse(b.schedule.slotStart), end: Date.parse(b.schedule.slotEnd) }));
}

async function busyBetween(rules, from, to, exceptId) {
  const buf = rules.bufferMinutes * 60e3;
  const g = await google.busy(from - buf - 864e5, to + buf + 864e5);
  return [...g, ...(await holds(rules, exceptId))];
}

function bookingId() {
  const d = new Date();
  return `AI-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

function whatsappText(b, s) {
  const fmt = (iso) => iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: s.booking.timezone, dateStyle: 'short', timeStyle: 'short' }) : '';
  const fmtDay = (ymd) => ymd ? ymd.split('-').reverse().join('/') : 'não informado';
  const lines = [
    'Olá, Assis! Tudo bem?', '', 'Gostaria de solicitar um agendamento para fazer uma tatuagem.', '',
    `*Protocolo:* ${b.id}`, '',
    '*Meus dados:*', `Nome: ${b.client.name}`, `WhatsApp: ${b.client.whatsapp}`, `E-mail: ${b.client.email || 'não informado'}`, '',
    '*Informações da tatuagem:*', `Tipo de projeto: ${b.tattoo.projectType}`, `Arte escolhida: ${b.tattoo.art || 'nenhuma'}`, `Estilo: ${b.tattoo.style || 'a definir'}`,
    `Local do corpo: ${b.tattoo.placement}`, `Tamanho aproximado: ${b.tattoo.size || 'a definir'}`, `Primeira tatuagem: ${b.tattoo.firstTattoo}`, `Descrição: ${b.tattoo.description || '-'}`, '',
    '*Preferências de agendamento:*',
  ];
  if (b.schedule.slotStart) lines.push(`Horário escolhido no site: ${fmt(b.schedule.slotStart)}`);
  else lines.push(`Primeira opção de data: ${fmtDay(b.schedule.preferredDate)}`, `Segunda opção: ${fmtDay(b.schedule.altDate)}`);
  lines.push(`Horário preferido: ${b.schedule.period || 'flexível'}`);
  if (b.refs.length) lines.push('', `Enviei ${b.refs.length} imagem(ns) de referência pelo site.`);
  if (b.notes) lines.push('', `Obs.: ${b.notes}`);
  lines.push('', 'Gostaria de conversar sobre os detalhes do projeto e verificar a disponibilidade da agenda!');
  return lines.join('\n');
}

const PROJECT = ['Arte autoral', 'Flash disponível', 'Projeto personalizado', 'Cobertura', 'Outro'];
const PLACES = ['Braço', 'Antebraço', 'Ombro', 'Peito', 'Costas', 'Costela', 'Perna', 'Mão', 'Pescoço', 'Outro'];
const PERIODS = ['Manhã', 'Tarde', 'Noite', 'Flexível'];

async function createBooking(req, res) {
  if (!auth.rateLimit('book:' + ip(req), 20, 3600e3)) return fail(res, 429, 'Muitas solicitações seguidas. Tente de novo mais tarde ou chame no WhatsApp.');
  const d = await body(req, 22 * 1024 * 1024);
  if (d.website) return send(res, 200, { ok: true, id: 'AI-0000-000000', status: 'aguardando' }); // honeypot
  const s = await settings();
  const rules = s.booking;
  const errors = {};
  const name = str(d.name, 120); if (name.length < 3) errors.name = 'Informe seu nome completo.';
  const whatsapp = str(d.whatsapp, 30); if (whatsapp.replace(/\D/g, '').length < 10) errors.whatsapp = 'Informe um WhatsApp com DDD.';
  const email = str(d.email, 160); if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = 'E-mail inválido.';
  const projectType = PROJECT.includes(d.projectType) ? d.projectType : null; if (!projectType) errors.projectType = 'Escolha o tipo de projeto.';
  const placement = PLACES.includes(d.placement) ? d.placement : null; if (!placement) errors.placement = 'Escolha o local do corpo.';
  const period = PERIODS.includes(d.period) ? d.period : 'Flexível';
  if (d.consent !== true) errors.consent = 'É preciso autorizar o uso dos dados para o agendamento.';

  const catalog = await store.read('catalog');
  const art = d.artId ? catalog.find((a) => a.id === d.artId) : null;

  let slot = null;
  if (d.slotStart) {
    if (!(await google.isReady())) return fail(res, 409, 'A agenda online está indisponível agora. Escolha datas de preferência.');
    const start = Date.parse(d.slotStart);
    if (!slotsLib.isCandidate(rules, start)) errors.slot = 'Esse horário não está mais disponível.';
    else slot = { start, end: start + rules.sessionMinutes * 60e3 };
  } else {
    const ymd = /^\d{4}-\d{2}-\d{2}$/;
    if (!ymd.test(d.preferredDate || '')) errors.preferredDate = 'Escolha uma data de preferência.';
  }

  const refsIn = Array.isArray(d.refs) ? d.refs.slice(0, 6) : [];
  const files = [];
  for (const r of refsIn) {
    const buf = Buffer.from(String(r.data || '').replace(/^data:[^,]+,/, ''), 'base64');
    const ext = sniff(buf);
    if (!ext || buf.length > 4 * 1024 * 1024) { errors.refs = 'Envie imagens JPG, PNG ou WebP de até 4 MB.'; break; }
    files.push({ buf, ext });
  }
  if (Object.keys(errors).length) return fail(res, 422, 'Confira os campos destacados.', { fields: errors });

  if (slot) {
    const busy = await busyBetween(rules, slot.start, slot.end);
    if (slotsLib.freeSlots(rules, [slot], busy).length === 0) return fail(res, 409, 'Esse horário acabou de ser ocupado. Escolha outro.', { fields: { slot: 'Horário ocupado.' } });
  }

  const id = bookingId();
  const dir = join(store.paths.uploads, id);
  if (files.length) await mkdir(dir, { recursive: true });
  const refs = [];
  for (const [i, f] of files.entries()) { const fn = `ref-${i + 1}.${f.ext}`; await writeFile(join(dir, fn), f.buf); refs.push(fn); }

  const booking = {
    id, createdAt: new Date().toISOString(), status: 'aguardando',
    client: { name, whatsapp, email },
    tattoo: {
      projectType, artId: art?.id || '', art: art ? `${art.id} · ${art.title}` : str(d.artText, 120),
      style: str(d.style, 80), placement, size: str(d.size, 40), description: str(d.description, 2000), firstTattoo: d.firstTattoo === 'Sim' ? 'Sim' : 'Não',
    },
    schedule: slot
      ? { mode: 'agenda', slotStart: new Date(slot.start).toISOString(), slotEnd: new Date(slot.end).toISOString(), period }
      : { mode: 'preferencia', preferredDate: d.preferredDate, altDate: /^\d{4}-\d{2}-\d{2}$/.test(d.altDate || '') ? d.altDate : '', period },
    refs, notes: str(d.notes, 1000), event: null,
    consentAt: new Date().toISOString(),
    history: [{ at: new Date().toISOString(), status: 'aguardando', by: 'cliente' }],
  };
  await store.update('bookings', (list) => [booking, ...(list || [])]);
  send(res, 201, { ok: true, id, status: 'aguardando', schedule: booking.schedule, whatsappUrl: `https://wa.me/${s.contact.whatsapp}?text=${encodeURIComponent(whatsappText(booking, s))}` });
}

async function publicSlots(req, res, url) {
  const s = await settings();
  if (!(await google.isReady())) return send(res, 200, { ok: true, enabled: false });
  if (!auth.rateLimit('slots:' + ip(req), 60, 60e3)) return fail(res, 429, 'Aguarde um instante.');
  const rules = s.booking;
  const { from, to } = slotsLib.windowFor(rules);
  try {
    const cands = slotsLib.candidates(rules, from, to);
    const busy = await busyBetween(rules, from, to);
    const free = slotsLib.freeSlots(rules, cands, busy);
    send(res, 200, { ok: true, enabled: true, sessionMinutes: rules.sessionMinutes, days: slotsLib.groupByDay(free, rules.utcOffset) });
  } catch (e) {
    console.error('slots', e.message);
    send(res, 200, { ok: true, enabled: false, error: 'Agenda temporariamente indisponível.' });
  }
}

async function publicContent(req, res) {
  const [portfolio, catalog, s, ready] = await Promise.all([store.read('portfolio'), store.read('catalog'), settings(), google.isReady()]);
  send(res, 200, {
    ok: true, portfolio: portfolio.filter((p) => !p.hidden), catalog: catalog.filter((c) => !c.hidden),
    contact: s.contact, booking: { sessionMinutes: s.booking.sessionMinutes, minAdvanceHours: s.booking.minAdvanceHours, maxDaysAhead: s.booking.maxDaysAhead, workingDays: s.booking.workingDays, daysOff: s.booking.daysOff },
    calendar: ready,
  }, { 'Cache-Control': 'no-cache' });
}

// ---------- painel ----------
function session(req) {
  try { return auth.readToken(auth.cookies(req)[SESSION]); } catch { return null; }
}

async function admin(req, res, url) {
  const p = url.pathname;
  if (p === '/api/admin/login' && req.method === 'POST') {
    if (!auth.rateLimit('login:' + ip(req), 8, 15 * 60e3)) return fail(res, 429, 'Muitas tentativas. Aguarde 15 minutos.');
    if (!process.env.ADMIN_PASSWORD_HASH) return fail(res, 503, 'Painel sem senha configurada. Rode: node tools/set-password.mjs');
    const d = await body(req, 10_000);
    if (!auth.checkPassword(d.password)) return fail(res, 401, 'Senha incorreta.');
    const tok = auth.makeToken({ role: 'admin' }, ADMIN_TTL);
    return send(res, 200, { ok: true }, { 'Set-Cookie': auth.cookie(SESSION, tok, { maxAge: ADMIN_TTL / 1000, secure: SECURE }) });
  }
  if (p === '/api/admin/logout' && req.method === 'POST') return send(res, 200, { ok: true }, { 'Set-Cookie': auth.cookie(SESSION, '', { maxAge: 0, secure: SECURE }) });

  const s = session(req);
  if (!s) return fail(res, 401, 'Faça login.');
  if (req.method !== 'GET' && req.headers['x-requested-with'] !== 'fetch') return fail(res, 403, 'Requisição recusada.');

  if (p === '/api/admin/session') return send(res, 200, { ok: true, google: await google.status(), settings: await settings() });

  if (p === '/api/admin/bookings' && req.method === 'GET') return send(res, 200, { ok: true, bookings: (await store.read('bookings')) || [] });

  let m = p.match(/^\/api\/admin\/bookings\/(AI-[\w-]+)\/ref\/(ref-\d+\.(jpg|png|webp))$/);
  if (m && req.method === 'GET') {
    try { const f = await readFile(join(store.paths.uploads, m[1], m[2])); return send(res, 200, f, { 'Content-Type': TYPES['.' + m[3]], 'Cache-Control': 'private, no-store' }); }
    catch { return fail(res, 404, 'Arquivo não encontrado.'); }
  }

  m = p.match(/^\/api\/admin\/bookings\/(AI-[\w-]+)\/(confirm|status)$/);
  if (m && req.method === 'POST') {
    const d = await body(req, 20_000);
    const conf = await settings();
    const list = await store.read('bookings');
    const b = list.find((x) => x.id === m[1]);
    if (!b) return fail(res, 404, 'Pedido não encontrado.');
    if (m[2] === 'confirm') {
      if (!(await google.isReady())) return fail(res, 409, 'Conecte a Google Agenda antes de confirmar. Sem o evento criado, o pedido não pode ser marcado como confirmado.');
      if (b.status === 'confirmado') return fail(res, 409, 'Esse pedido já está confirmado.');
      const start = d.start ? Date.parse(d.start) : Date.parse(b.schedule.slotStart || '');
      const minutes = Number(d.minutes) || conf.booking.sessionMinutes;
      if (!Number.isFinite(start)) return fail(res, 422, 'Defina data e horário da sessão.');
      const end = start + minutes * 60e3;
      const busy = await busyBetween(conf.booking, start, end, b.id);
      const buf = conf.booking.bufferMinutes * 60e3;
      if (busy.some((x) => start - buf < x.end && x.start < end + buf)) return fail(res, 409, 'Esse horário conflita com outro compromisso da agenda.');
      const desc = [
        `Protocolo: ${b.id}`, `Cliente: ${b.client.name}`, `WhatsApp: ${b.client.whatsapp}`, b.client.email ? `E-mail: ${b.client.email}` : '',
        `Projeto: ${b.tattoo.projectType}${b.tattoo.art ? ' · ' + b.tattoo.art : ''}`, `Local: ${b.tattoo.placement} · Tamanho: ${b.tattoo.size || 'a definir'}`,
        b.tattoo.description ? `Descrição: ${b.tattoo.description}` : '', b.refs.length ? `${b.refs.length} referência(s) no painel do site.` : '',
      ].filter(Boolean).join('\n');
      const ev = await google.createEvent({
        summary: `Tatuagem · ${b.client.name}`, description: desc, start, end, timeZone: conf.booking.timezone,
        attendeeEmail: d.invite !== false ? b.client.email : '', bookingId: b.id,
      });
      const updated = await store.update('bookings', (all) => {
        const x = all.find((y) => y.id === b.id);
        x.status = 'confirmado';
        x.event = { id: ev.id, link: ev.htmlLink, start: new Date(start).toISOString(), end: new Date(end).toISOString() };
        x.history.push({ at: new Date().toISOString(), status: 'confirmado', by: 'artista' });
        return { value: all, result: x };
      });
      const when = new Date(start).toLocaleString('pt-BR', { timeZone: conf.booking.timezone, dateStyle: 'full', timeStyle: 'short' });
      const msg = `Olá, ${b.client.name.split(' ')[0]}! Sua sessão de tatuagem com o Assis.ink está confirmada para ${when}. Protocolo ${b.id}. Qualquer dúvida, é só chamar por aqui.`;
      return send(res, 200, { ok: true, booking: updated, notifyUrl: `https://wa.me/${b.client.whatsapp.replace(/\D/g, '').replace(/^(?!55)/, '55')}?text=${encodeURIComponent(msg)}` });
    }
    const next = d.status;
    if (!['aguardando', 'recusado', 'cancelado', 'concluido'].includes(next)) return fail(res, 422, 'Status inválido.');
    if (b.event?.id && (next === 'cancelado' || next === 'recusado')) {
      try { await google.deleteEvent(b.event.id); } catch (e) { return fail(res, 502, 'Não consegui remover o evento da agenda: ' + e.message); }
    }
    const updated = await store.update('bookings', (all) => {
      const x = all.find((y) => y.id === b.id);
      if (next === 'cancelado' || next === 'recusado') x.event = null;
      x.status = next; x.history.push({ at: new Date().toISOString(), status: next, by: 'artista' });
      return { value: all, result: x };
    });
    return send(res, 200, { ok: true, booking: updated });
  }

  if ((p === '/api/admin/catalog' || p === '/api/admin/portfolio') && req.method === 'PUT') {
    const d = await body(req, 2 * 1024 * 1024);
    if (!Array.isArray(d.items)) return fail(res, 422, 'Lista inválida.');
    const name = p.endsWith('catalog') ? 'catalog' : 'portfolio';
    await store.write(name, d.items);
    return send(res, 200, { ok: true });
  }
  if ((p === '/api/admin/catalog' || p === '/api/admin/portfolio') && req.method === 'GET') {
    return send(res, 200, { ok: true, items: await store.read(p.endsWith('catalog') ? 'catalog' : 'portfolio') });
  }

  if (p === '/api/admin/upload' && req.method === 'POST') {
    const d = await body(req, 16 * 1024 * 1024);
    const buf = Buffer.from(String(d.data || '').replace(/^data:[^,]+,/, ''), 'base64');
    const ext = sniff(buf);
    if (!ext) return fail(res, 422, 'Envie JPG, PNG ou WebP.');
    const base = (str(d.name, 60).toLowerCase().normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '') || 'imagem') + '-' + randomBytes(3).toString('hex');
    await writeFile(join(store.paths.media, `${base}.${ext}`), buf);
    return send(res, 200, { ok: true, url: `/media/${base}.${ext}` });
  }

  if (p === '/api/admin/settings' && req.method === 'PUT') {
    const d = await body(req, 50_000);
    const cur = await settings();
    const bk = d.booking || {};
    const hm = (v, def) => (/^\d{2}:\d{2}$/.test(v) ? v : def);
    const num = (v, def, min, max) => { const n = Number(v); return Number.isFinite(n) && n >= min && n <= max ? n : def; };
    const next = {
      ...cur,
      contact: { ...cur.contact, ...Object.fromEntries(['whatsapp', 'whatsappLabel', 'email', 'instagram', 'city', 'address', 'mapsUrl'].map((k) => [k, str(d.contact?.[k] ?? cur.contact[k], 300)])), whatsappConfirmed: Boolean(d.contact?.whatsappConfirmed ?? cur.contact.whatsappConfirmed) },
      booking: {
        ...cur.booking,
        workingDays: Array.isArray(bk.workingDays) ? bk.workingDays.map(Number).filter((n) => n >= 0 && n <= 6) : cur.booking.workingDays,
        open: hm(bk.open, cur.booking.open), close: hm(bk.close, cur.booking.close),
        breaks: Array.isArray(bk.breaks) ? bk.breaks.filter((b) => /^\d{2}:\d{2}$/.test(b.start) && /^\d{2}:\d{2}$/.test(b.end)).slice(0, 5) : cur.booking.breaks,
        sessionMinutes: num(bk.sessionMinutes, cur.booking.sessionMinutes, 30, 720),
        bufferMinutes: num(bk.bufferMinutes, cur.booking.bufferMinutes, 0, 240),
        stepMinutes: num(bk.stepMinutes, cur.booking.stepMinutes, 15, 240),
        minAdvanceHours: num(bk.minAdvanceHours, cur.booking.minAdvanceHours, 0, 24 * 60),
        maxDaysAhead: num(bk.maxDaysAhead, cur.booking.maxDaysAhead, 7, 365),
        holdHours: num(bk.holdHours, cur.booking.holdHours, 1, 24 * 14),
        daysOff: Array.isArray(bk.daysOff) ? bk.daysOff.filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x)).slice(0, 200) : cur.booking.daysOff,
      },
      configuredByArtist: true,
    };
    await store.write('settings', next);
    return send(res, 200, { ok: true, settings: next });
  }

  if (p === '/api/admin/google/connect' && req.method === 'GET') {
    if (!google.credentialsPresent()) return fail(res, 503, 'Faltam GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REDIRECT_URI no .env.');
    const state = randomBytes(16).toString('hex');
    return send(res, 302, '', { Location: google.authUrl(state), 'Set-Cookie': auth.cookie('ai_oauth', auth.makeToken({ state }, 10 * 60e3), { maxAge: 600, secure: SECURE }) });
  }
  if (p === '/api/admin/google/disconnect' && req.method === 'POST') { await google.disconnect(); return send(res, 200, { ok: true }); }
  if (p === '/api/admin/google/upcoming') {
    if (!(await google.isReady())) return send(res, 200, { ok: true, events: [], connected: false });
    return send(res, 200, { ok: true, connected: true, events: await google.upcoming(30) });
  }
  return fail(res, 404, 'Rota não encontrada.');
}

async function oauthCallback(req, res, url) {
  if (!session(req)) return send(res, 302, '', { Location: '/admin/?erro=login' });
  const st = auth.readToken(auth.cookies(req).ai_oauth || '');
  if (!st || st.state !== url.searchParams.get('state')) return send(res, 302, '', { Location: '/admin/?erro=estado' });
  if (url.searchParams.get('error')) return send(res, 302, '', { Location: '/admin/?erro=negado' });
  try { await google.exchangeCode(url.searchParams.get('code')); }
  catch (e) { console.error('oauth', e.message); return send(res, 302, '', { Location: '/admin/?erro=google' }); }
  send(res, 302, '', { Location: '/admin/?google=ok', 'Set-Cookie': auth.cookie('ai_oauth', '', { maxAge: 0, secure: SECURE }) });
}

// ---------- arquivos estáticos ----------
async function serveFile(res, base, rel, req) {
  const file = normalize(join(base, rel));
  if (!file.startsWith(normalize(base))) return fail(res, 403, 'Proibido.');
  try {
    const st = await stat(file);
    if (st.isDirectory()) return serveFile(res, base, join(rel, 'index.html'), req);
    const ext = extname(file).toLowerCase();
    const longCache = /\/(assets|media)\//.test(rel.replace(/\\/g, '/'));
    const etag = `"${st.size.toString(16)}-${st.mtimeMs.toString(16)}-${PUBLIC_URL.length.toString(16)}"`;
    if (req.headers['if-none-match'] === etag) return send(res, 304, '');
    let buf = await readFile(file);
    // O domínio real vem de PUBLIC_URL: canonical, Open Graph, sitemap e robots se ajustam sozinhos.
    if (['.html', '.xml', '.txt'].includes(ext) && !PUBLIC_URL.includes('localhost')) buf = Buffer.from(buf.toString('utf8').replaceAll(SITE_PLACEHOLDER, PUBLIC_URL));
    send(res, 200, buf, {
      'Content-Type': TYPES[ext] || 'application/octet-stream', ETag: etag,
      'Cache-Control': longCache ? 'public, max-age=2592000' : ext === '.html' ? 'no-cache' : 'public, max-age=86400',
    });
  } catch {
    const nf = await readFile(join(ROOT, '404.html')).catch(() => 'Página não encontrada');
    send(res, 404, nf, { 'Content-Type': 'text/html; charset=utf-8' });
  }
}

createServer(async (req, res) => {
  if (SECURE && req.headers['x-forwarded-proto'] === 'http') { res.writeHead(301, { Location: PUBLIC_URL + req.url }); return res.end(); }
  const url = new URL(req.url, PUBLIC_URL);
  const p = decodeURIComponent(url.pathname);
  try {
    if (p === '/api/content') return await publicContent(req, res);
    if (p === '/api/slots') return await publicSlots(req, res, url);
    if (p === '/api/bookings' && req.method === 'POST') return await createBooking(req, res);
    if (p.startsWith('/api/admin/')) return await admin(req, res, url);
    if (p === '/oauth/google/callback') return await oauthCallback(req, res, url);
    if (p.startsWith('/api/')) return fail(res, 404, 'Rota não encontrada.');
    if (p.startsWith('/media/')) return await serveFile(res, store.paths.media, p.slice(7), req);
    if (p === '/admin') return send(res, 301, '', { Location: '/admin/' });
    return await serveFile(res, ROOT, p.endsWith('/') ? p + 'index.html' : p, req);
  } catch (e) {
    console.error(req.method, p, e);
    if (!res.headersSent) fail(res, e.status || 500, e.status ? e.message : 'Erro interno. Tente de novo ou chame no WhatsApp.');
  }
}).listen(PORT, () => console.log(`Assis.ink em ${PUBLIC_URL} (porta ${PORT})`));
