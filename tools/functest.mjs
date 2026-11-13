// Testes funcionais da API e do cálculo de horários. Uso: node tools/functest.mjs [url]
import { readFileSync } from 'node:fs';
import * as slots from '../lib/slots.mjs';
const BASE = process.argv[2] || 'http://localhost:4330';
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'OK   ' : 'FALHA') + ' ' + msg); if (!cond) fails++; };

// --- horários ---
const rules = JSON.parse(readFileSync(new URL('../data-seed/settings.json', import.meta.url))).booking;
const now = Date.parse('2026-11-16T10:00:00-03:00'); // segunda
const { from, to } = slots.windowFor(rules, now);
const c = slots.candidates(rules, from, to);
ok(c.length > 0, `gera candidatos (${c.length})`);
ok(c.every((s) => s.start >= now + 48 * 3600e3), 'respeita antecedência mínima de 48h');
ok(!c.some((s) => slots.localDate(s.start, '-03:00').weekday === 0), 'não abre domingo');
ok(c.every((s) => { const a = slots.localDate(s.start, '-03:00').hm, b = slots.localDate(s.end, '-03:00').hm; return a >= '09:00' && b <= '18:00' && !(a < '13:00' && b > '12:00'); }), 'dentro do expediente e fora da pausa');
const busy = [{ start: Date.parse('2026-11-19T14:00:00-03:00'), end: Date.parse('2026-11-19T16:00:00-03:00') }];
const free = slots.freeSlots(rules, c, busy);
const day = free.filter((s) => slots.localDate(s.start, '-03:00').ymd === '2026-11-19').map((s) => slots.localDate(s.start, '-03:00').hm);
ok(!day.includes('13:00') && !day.includes('14:00') && !day.includes('15:00'), `bloqueia conflito + intervalo de 30 min (livres no dia 19: ${day.join(', ')})`);

// --- API ---
const j = async (p, o = {}) => { const r = await fetch(BASE + p, { ...o, headers: { 'Content-Type': 'application/json', ...(o.headers || {}) }, body: o.body ? JSON.stringify(o.body) : undefined, redirect: 'manual' }); return { r, d: await r.json().catch(() => null) }; };
let { r, d } = await j('/api/content');
ok(r.ok && d.portfolio.length && d.catalog.length, 'conteúdo público');
ok(!JSON.stringify(d).includes('refresh_token') && !('bookings' in d), 'conteúdo público sem dados privados');
({ r, d } = await j('/api/slots')); ok(r.ok && d.enabled === false, 'sem Google: horários desativados, sem simular');
({ r, d } = await j('/api/bookings', { method: 'POST', body: { name: 'x' } })); ok(r.status === 422 && d.fields.whatsapp && d.fields.consent, 'valida campos obrigatórios');
({ r, d } = await j('/api/bookings', { method: 'POST', body: { name: 'Teste Slot', whatsapp: '83999990000', projectType: 'Outro', placement: 'Braço', consent: true, slotStart: new Date(Date.now() + 5 * 864e5).toISOString() } }));
ok(r.status === 409, 'recusa horário quando a agenda não está conectada');
({ r, d } = await j('/api/bookings', { method: 'POST', body: { name: 'Teste Ref', whatsapp: '83999990000', projectType: 'Outro', placement: 'Braço', consent: true, preferredDate: '2026-12-01', refs: [{ data: 'data:image/png;base64,' + Buffer.from('<svg></svg>').toString('base64') }] } }));
ok(r.status === 422 && d.fields.refs, 'recusa arquivo que não é imagem real');
({ r, d } = await j('/api/admin/bookings')); ok(r.status === 401, 'painel exige login');
({ r } = await j('/api/admin/login', { method: 'POST', body: { password: 'errada' } })); ok(r.status === 401, 'senha errada recusada');
const pw = readFileSync(new URL('../.senha-painel-local.txt', import.meta.url), 'utf8').trim().split('\n').pop();
({ r } = await j('/api/admin/login', { method: 'POST', body: { password: pw } }));
const cookie = (r.headers.get('set-cookie') || '').split(';')[0];
ok(r.ok && cookie.startsWith('ai_session='), 'login do painel');
const H = { Cookie: cookie, 'X-Requested-With': 'fetch' };
({ r, d } = await j('/api/admin/bookings', { headers: H })); ok(r.ok && Array.isArray(d.bookings), `lista pedidos (${d.bookings.length})`);
const b = d.bookings.find((x) => x.status === 'aguardando');
if (b) {
  ({ r, d } = await j(`/api/admin/bookings/${b.id}/confirm`, { method: 'POST', headers: H, body: { start: new Date(Date.now() + 7 * 864e5).toISOString() } }));
  ok(r.status === 409, 'não confirma sem evento na Google Agenda');
  ({ r, d } = await j(`/api/admin/bookings/${b.id}/status`, { method: 'POST', headers: { Cookie: cookie }, body: { status: 'recusado' } }));
  ok(r.status === 403, 'bloqueia alteração sem cabeçalho anti-CSRF');
  if (b.refs[0]) { const rr = await fetch(`${BASE}/api/admin/bookings/${b.id}/ref/${b.refs[0]}`); ok(rr.status === 401, 'referência do cliente não é pública'); }
}
({ r } = await fetch(BASE + '/data/bookings.json').then((r) => ({ r }))); ok(r.status === 404, 'arquivos de dados não ficam expostos');
({ r } = await fetch(BASE + '/../server.mjs').then((r) => ({ r }))); ok(r.status !== 200, 'não serve arquivos fora de public/');
console.log(fails ? `\n${fails} falha(s)` : '\nTudo certo');
process.exit(fails ? 1 : 0);
