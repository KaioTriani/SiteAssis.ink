// Painel do artista: pedidos, Google Agenda, catálogo, portfólio e configurações.
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TZ = 'America/Fortaleza';
const STATUS = { aguardando: 'Aguardando', confirmado: 'Confirmado', concluido: 'Concluído', recusado: 'Recusado', cancelado: 'Cancelado' };
const ART_STATUS = { consultar: 'Consultar disponibilidade', disponivel: 'Disponível', reservada: 'Reservada', tatuada: 'Já tatuada' };
const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

async function api(path, opts = {}) {
  const r = await fetch(path, { ...opts, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch', ...(opts.headers || {}) }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const d = await r.json().catch(() => ({ ok: false, error: 'Resposta inválida do servidor' }));
  if (r.status === 401 && !path.endsWith('/login')) { showLogin(); throw new Error('Sessão expirada'); }
  if (!r.ok || !d.ok) throw new Error(d.error || 'Erro ' + r.status);
  return d;
}

function alertBox(msg, kind = 'ok', ttl = 6000) {
  const el = document.createElement('div'); el.className = `alert alert--${kind}`; el.innerHTML = msg;
  $('#alerts').prepend(el); if (ttl) setTimeout(() => el.remove(), ttl);
}

const fmt = (iso, opts = { dateStyle: 'short', timeStyle: 'short' }) => iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: TZ, ...opts }) : '';
const fmtDay = (ymd) => ymd ? ymd.split('-').reverse().join('/') : '';
// "2026-11-20T14:00" no fuso de João Pessoa -> ISO
const localToIso = (v) => new Date(v + ':00-03:00').toISOString();
const isoToLocal = (iso) => { const d = new Date(Date.parse(iso) - 3 * 3600e3); return d.toISOString().slice(0, 16); };

// ---------- sessão ----------
let state = { bookings: [], filter: 'aguardando', current: null, settings: null, google: null, catalog: [], portfolio: [] };

function showLogin() {
  $('#login').hidden = false; $('#tabs').hidden = true; $('#logout').hidden = true;
  $$('[data-panel]').forEach((p) => { p.hidden = true; });
  $('#login input').focus();
}

$('#login').addEventListener('submit', async (e) => {
  e.preventDefault();
  try { await api('/api/admin/login', { method: 'POST', body: { password: e.target.password.value } }); e.target.reset(); boot(); }
  catch (err) { $('#login .form__error').textContent = err.message; }
});
$('#logout').addEventListener('click', async () => { await api('/api/admin/logout', { method: 'POST' }).catch(() => {}); showLogin(); });

$('#tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) tab(b.dataset.tab); });
function tab(name) {
  $$('#tabs button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.tab === name));
  $$('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== name; });
  if (name === 'agenda') loadAgenda();
  if (name === 'catalogo') loadCatalog();
  if (name === 'portfolio') loadPortfolio();
  if (name === 'config') fillSettings();
  history.replaceState(null, '', '#' + name);
}

async function boot() {
  let s;
  try { s = await api('/api/admin/session'); } catch { return showLogin(); }
  state.settings = s.settings; state.google = s.google;
  $('#login').hidden = true; $('#tabs').hidden = false; $('#logout').hidden = false;
  $('#alerts').innerHTML = '';
  const q = new URLSearchParams(location.search);
  if (q.get('google') === 'ok') alertBox('Google Agenda conectada.');
  if (q.get('erro')) alertBox({ login: 'Faça login antes de conectar o Google.', estado: 'A conexão com o Google expirou. Tente de novo.', negado: 'A permissão do Google foi negada.', google: 'O Google recusou a conexão. Confira o client ID, o secret e o redirect URI no .env.' }[q.get('erro')] || 'Erro na conexão.', 'err', 0);
  if (q.size) history.replaceState(null, '', location.pathname + location.hash);
  if (!s.google.connected) alertBox('A Google Agenda ainda não está conectada. Sem ela, o site recebe pedidos com datas de preferência, mas não mostra horários livres e você não consegue confirmar sessões. <button class="link" data-goto="agenda">Conectar agora</button>', 'warn', 0);
  if (!s.settings.contact.whatsappConfirmed) alertBox('Confirme o número de WhatsApp em Configurações. Hoje o site usa ' + esc(s.settings.contact.whatsappLabel) + '.', 'warn', 0);
  if (!s.settings.configuredByArtist) alertBox('Revise as regras da agenda (dias, horários e duração da sessão) em Configurações. Os valores atuais são padrões.', 'warn', 0);
  await loadBookings();
  tab((location.hash || '#pedidos').slice(1));
}
document.addEventListener('click', (e) => { const g = e.target.closest('[data-goto]'); if (g) tab(g.dataset.goto); });

// ---------- pedidos ----------
async function loadBookings() {
  const d = await api('/api/admin/bookings');
  state.bookings = d.bookings;
  const pending = d.bookings.filter((b) => b.status === 'aguardando').length;
  $('#badge').textContent = pending || '';
  drawList();
}

$('#status-filter').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  $$('#status-filter button').forEach((x) => x.setAttribute('aria-pressed', x === b));
  state.filter = b.dataset.s; drawList();
});

function drawList() {
  const f = state.filter;
  const list = state.bookings.filter((b) => f === 'all' || f.split(',').includes(b.status));
  $('#booking-list').innerHTML = list.length ? list.map((b) => `<li><button data-id="${b.id}" aria-current="${state.current === b.id}">
    <span><span class="pill pill--${b.status}">${STATUS[b.status]}</span> <small>${esc(b.id)}</small></span>
    <b>${esc(b.client.name)}</b>
    <small>${esc(b.tattoo.projectType)}${b.tattoo.art ? ' · ' + esc(b.tattoo.art) : ''} · ${esc(b.tattoo.placement)}</small>
    <small>${b.schedule.slotStart ? 'Horário: ' + fmt(b.schedule.slotStart) : 'Preferência: ' + fmtDay(b.schedule.preferredDate)} · recebido ${fmt(b.createdAt, { dateStyle: 'short' })}</small>
  </button></li>`).join('') : '<li class="muted">Nenhum pedido aqui.</li>';
  if (state.current) drawDetail(state.bookings.find((b) => b.id === state.current));
}
$('#booking-list').addEventListener('click', (e) => { const b = e.target.closest('[data-id]'); if (!b) return; state.current = b.dataset.id; drawList(); });

function waClient(b, text) {
  let n = b.client.whatsapp.replace(/\D/g, ''); if (!n.startsWith('55')) n = '55' + n;
  return `https://wa.me/${n}${text ? '?text=' + encodeURIComponent(text) : ''}`;
}

function drawDetail(b) {
  if (!b) { $('#booking-detail').innerHTML = '<p class="muted">Selecione um pedido.</p>'; return; }
  const s = state.settings.booking;
  const startDefault = b.event?.start || b.schedule.slotStart || (b.schedule.preferredDate ? new Date(b.schedule.preferredDate + 'T' + s.open + ':00-03:00').toISOString() : '');
  const rows = [
    ['WhatsApp', `<a class="link" href="${waClient(b)}" target="_blank" rel="noopener">${esc(b.client.whatsapp)}</a>`],
    ['E-mail', b.client.email ? `<a class="link" href="mailto:${esc(b.client.email)}">${esc(b.client.email)}</a>` : '-'],
    ['Projeto', esc(b.tattoo.projectType)], ['Arte', esc(b.tattoo.art || '-')], ['Estilo', esc(b.tattoo.style || '-')],
    ['Local', esc(b.tattoo.placement)], ['Tamanho', esc(b.tattoo.size || '-')], ['Primeira tatuagem', esc(b.tattoo.firstTattoo)],
    ['Descrição', esc(b.tattoo.description || '-')],
    ['Agenda', b.schedule.slotStart ? `Pré-reserva: ${fmt(b.schedule.slotStart, { dateStyle: 'full', timeStyle: 'short' })}` : `Preferência: ${fmtDay(b.schedule.preferredDate)}${b.schedule.altDate ? ' ou ' + fmtDay(b.schedule.altDate) : ''}`],
    ['Período', esc(b.schedule.period)], ['Observações', esc(b.notes || '-')],
    ['Sessão confirmada', b.event ? `${fmt(b.event.start, { dateStyle: 'full', timeStyle: 'short' })} · <a class="link" href="${esc(b.event.link)}" target="_blank" rel="noopener">abrir na Google Agenda</a>` : '-'],
    ['Histórico', b.history.map((h) => `${fmt(h.at)} · ${STATUS[h.status]} (${h.by})`).join('\n')],
  ];
  $('#booking-detail').innerHTML = `
    <span class="pill pill--${b.status}">${STATUS[b.status]}</span> <small class="muted">${esc(b.id)} · recebido ${fmt(b.createdAt)}</small>
    <h2>${esc(b.client.name)}</h2>
    <dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
    ${b.refs.length ? `<h3 class="adm__h2" style="margin-top:0">Referências</h3><div class="refs">${b.refs.map((r) => `<a href="/api/admin/bookings/${b.id}/ref/${r}" target="_blank" rel="noopener"><img src="/api/admin/bookings/${b.id}/ref/${r}" alt="Referência enviada"></a>`).join('')}</div>` : ''}
    ${b.status === 'aguardando' ? `<div class="confirm-box">
      <b>Confirmar sessão</b>
      <div class="row"><label class="field"><span>Data e horário</span><input type="datetime-local" id="c-start" value="${startDefault ? isoToLocal(startDefault) : ''}"></label>
      <label class="field"><span>Duração (min)</span><input type="number" id="c-min" min="30" step="15" value="${s.sessionMinutes}"></label></div>
      <label class="consent"><input type="checkbox" id="c-invite" ${b.client.email ? 'checked' : 'disabled'}><span>Enviar convite da Google Agenda para o e-mail do cliente${b.client.email ? '' : ' (cliente não informou e-mail)'}</span></label>
      <p class="muted">O pedido só muda para confirmado depois que o evento for criado na Google Agenda, sem conflito com outros compromissos.</p>
      <div class="adm__btns"><button class="btn btn--red btn--small" data-act="confirm" ${state.google.connected ? '' : 'disabled'}>Criar evento e confirmar</button>${state.google.connected ? '' : '<button class="link" data-goto="agenda">Conectar a Google Agenda</button>'}</div>
    </div>` : ''}
    <div class="adm__btns">
      <a class="btn btn--line btn--small" href="${waClient(b, `Olá, ${b.client.name.split(' ')[0]}! Aqui é o Assis, recebi seu pedido ${b.id} pelo site.`)}" target="_blank" rel="noopener">Responder no WhatsApp</a>
      ${b.status === 'aguardando' ? '<button class="btn btn--line btn--small" data-act="recusado">Recusar</button>' : ''}
      ${b.status === 'confirmado' ? '<button class="btn btn--line btn--small" data-act="concluido">Marcar como concluído</button><button class="btn btn--line btn--small danger" data-act="cancelado">Cancelar sessão (remove da agenda)</button>' : ''}
      ${['recusado', 'cancelado', 'concluido'].includes(b.status) ? '<button class="btn btn--line btn--small" data-act="aguardando">Reabrir</button>' : ''}
    </div>`;
}

$('#booking-detail').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-act]'); if (!btn) return;
  const b = state.bookings.find((x) => x.id === state.current);
  btn.disabled = true;
  try {
    if (btn.dataset.act === 'confirm') {
      const v = $('#c-start').value; if (!v) throw new Error('Defina data e horário.');
      const d = await api(`/api/admin/bookings/${b.id}/confirm`, { method: 'POST', body: { start: localToIso(v), minutes: Number($('#c-min').value), invite: $('#c-invite').checked } });
      alertBox(`Sessão confirmada e criada na Google Agenda. <a class="link" href="${d.notifyUrl}" target="_blank" rel="noopener">Avisar o cliente no WhatsApp</a>`, 'ok', 0);
    } else {
      const act = btn.dataset.act;
      if ((act === 'cancelado' || act === 'recusado') && !confirm(act === 'cancelado' ? 'Cancelar a sessão e remover o evento da Google Agenda?' : 'Recusar este pedido?')) { btn.disabled = false; return; }
      await api(`/api/admin/bookings/${b.id}/status`, { method: 'POST', body: { status: act } });
      alertBox('Pedido atualizado.');
    }
    await loadBookings();
  } catch (err) { alertBox(esc(err.message), 'err', 10000); btn.disabled = false; }
});

// ---------- agenda ----------
async function loadAgenda() {
  const s = await api('/api/admin/session'); state.google = s.google;
  const g = s.google;
  $('#google-box').innerHTML = !g.credentials
    ? `<p>Faltam as credenciais do Google no servidor (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REDIRECT_URI no arquivo .env). O passo a passo está no README do projeto.</p>`
    : g.connected
      ? `<p>Conectada à conta <b>${esc(g.account || 'Google')}</b> desde ${fmt(g.connectedAt)}. Agenda usada: <code>${esc(g.calendarId)}</code>.</p><div class="adm__btns"><button class="btn btn--line btn--small" id="g-off">Desconectar</button></div>`
      : `<p>Conecte a Google Agenda para o site mostrar horários livres, evitar conflitos e criar os eventos das sessões confirmadas. O site só lê os intervalos ocupados; nenhum detalhe dos seus compromissos aparece para os clientes.</p><div class="adm__btns"><a class="btn btn--red btn--small" href="/api/admin/google/connect">Conectar Google Agenda</a></div>`;
  $('#g-off')?.addEventListener('click', async () => { if (!confirm('Desconectar a Google Agenda?')) return; await api('/api/admin/google/disconnect', { method: 'POST' }); loadAgenda(); });
  if (!g.connected) { $('#events').innerHTML = '<li class="muted">Conecte a agenda para ver os compromissos.</li>'; return; }
  try {
    const d = await api('/api/admin/google/upcoming');
    $('#events').innerHTML = d.events.length ? d.events.map((ev) => `<li class="${ev.booking ? 'is-site' : ''}"><span><b>${esc(ev.summary)}</b><br><small class="muted">${fmt(ev.start, { dateStyle: 'full', timeStyle: 'short' })}${ev.booking ? ' · pedido ' + esc(ev.booking) : ''}</small></span>${ev.link ? `<a class="link" href="${esc(ev.link)}" target="_blank" rel="noopener">abrir</a>` : ''}</li>`).join('') : '<li class="muted">Nenhum compromisso nos próximos 30 dias.</li>';
  } catch (err) { $('#events').innerHTML = `<li class="danger">${esc(err.message)}</li>`; }
}

// ---------- imagens enviadas pelo painel (redimensionadas no navegador) ----------
function resize(file, max, type = 'image/webp', q = 0.86) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); resolve({ data: c.toDataURL(type, q), w: c.width, h: c.height });
    };
    img.onerror = () => reject(new Error('Imagem inválida'));
    img.src = url;
  });
}
async function upload(file, max, name) {
  const r = await resize(file, max);
  const d = await api('/api/admin/upload', { method: 'POST', body: { data: r.data, name } });
  return { url: d.url, w: r.w, h: r.h };
}

// ---------- catálogo ----------
async function loadCatalog() { state.catalog = (await api('/api/admin/catalog')).items; drawCatalog(); }
function drawCatalog() {
  $('#catalog-edit').innerHTML = state.catalog.map((a, i) => `<div class="edit" data-i="${i}">
    <div class="edit__img"><img src="${esc(a.image)}" alt=""></div>
    <div class="edit__body">
      <div class="edit__row"><b>${esc(a.id)}</b><label><input type="checkbox" data-k="hidden" ${a.hidden ? 'checked' : ''}> ocultar</label></div>
      <label class="field"><span>Título</span><input data-k="title" value="${esc(a.title)}"></label>
      <label class="field"><span>Status</span><select data-k="status">${Object.entries(ART_STATUS).map(([k, v]) => `<option value="${k}" ${a.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="field"><span>Tamanho</span><input data-k="size" value="${esc(a.size)}" placeholder="ex.: até 22 cm"></label>
      <label class="field"><span>Categorias (autoral, flash, floral, ornamental, tradicional, personagens)</span><input data-k="tags" value="${esc(a.tags.join(', '))}"></label>
      <label class="field"><span>Observação</span><input data-k="note" value="${esc(a.note || '')}"></label>
    </div></div>`).join('');
}
$('#catalog-edit').addEventListener('input', (e) => {
  const card = e.target.closest('[data-i]'); const k = e.target.dataset.k; if (!card || !k) return;
  const a = state.catalog[card.dataset.i];
  a[k] = k === 'hidden' ? e.target.checked : k === 'tags' ? e.target.value.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean) : e.target.value;
});
$('#new-art').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const up = await upload(f, 1600, 'arte');
    const n = Math.max(0, ...state.catalog.map((a) => Number(a.id.replace(/\D/g, '')) || 0)) + 1;
    state.catalog.unshift({ id: 'AI-' + String(n).padStart(2, '0'), slug: 'arte-' + n, title: 'Nova arte', tags: ['autoral'], image: up.url, sheet: '', size: '', status: 'disponivel', note: '' });
    drawCatalog(); alertBox('Imagem enviada. Preencha os dados e clique em Salvar catálogo.');
  } catch (err) { alertBox(esc(err.message), 'err'); }
});

// ---------- portfólio ----------
async function loadPortfolio() { state.portfolio = (await api('/api/admin/portfolio')).items; drawPortfolio(); }
function drawPortfolio() {
  $('#portfolio-edit').innerHTML = state.portfolio.map((p, i) => `<div class="work-edit" data-i="${i}">
    <div class="work-edit__imgs">${p.images.map((im) => `<img src="${esc(im.thumb)}" alt="">`).join('')}</div>
    <div class="edit__body">
      <div class="edit__row"><label><input type="checkbox" data-k="featured" ${p.featured ? 'checked' : ''}> destaque</label><label><input type="checkbox" data-k="hidden" ${p.hidden ? 'checked' : ''}> ocultar do site</label><button class="link danger" data-del="${i}">Excluir</button></div>
      <div class="row"><label class="field"><span>Título</span><input data-k="title" value="${esc(p.title)}"></label><label class="field"><span>Local do corpo</span><input data-k="placement" value="${esc(p.placement)}"></label></div>
      <div class="row"><label class="field"><span>Estilos</span><input data-k="styles" value="${esc(p.styles.join(', '))}"></label><label class="field"><span>Data (AAAA-MM-DD)</span><input data-k="date" value="${esc(p.date)}"></label></div>
      <label class="field"><span>Descrição</span><input data-k="description" value="${esc(p.description)}"></label>
      <label class="field"><span>Texto alternativo da foto (para Google e leitores de tela)</span><input data-k="alt" value="${esc(p.images[0]?.alt || '')}"></label>
      <label class="field"><span>Link do post no Instagram</span><input data-k="instagram" value="${esc(p.instagram)}"></label>
    </div></div>`).join('');
}
$('#portfolio-edit').addEventListener('input', (e) => {
  const card = e.target.closest('[data-i]'); const k = e.target.dataset.k; if (!card || !k) return;
  const p = state.portfolio[card.dataset.i];
  if (k === 'featured' || k === 'hidden') p[k] = e.target.checked;
  else if (k === 'styles') p.styles = e.target.value.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
  else if (k === 'alt') p.images.forEach((im, j) => { im.alt = e.target.value + (j ? ` (foto ${j + 1})` : ''); });
  else p[k] = e.target.value;
});
$('#portfolio-edit').addEventListener('click', (e) => {
  const d = e.target.closest('[data-del]'); if (!d) return;
  if (!confirm('Excluir este trabalho do portfólio? (salve para aplicar)')) return;
  state.portfolio.splice(Number(d.dataset.del), 1); drawPortfolio();
});
$('#new-work').addEventListener('change', async (e) => {
  const files = [...e.target.files]; e.target.value = ''; if (!files.length) return;
  alertBox('Enviando fotos...', 'ok', 3000);
  try {
    const images = [];
    for (const f of files.slice(0, 8)) {
      const full = await upload(f, 2000, 'tattoo');
      const thumb = await upload(f, 760, 'tattoo-thumb');
      images.push({ src: full.url, thumb: thumb.url, w: full.w, h: full.h, alt: 'Tatuagem feita por Assis.ink em João Pessoa' });
    }
    state.portfolio.unshift({ id: 'trabalho-' + Date.now().toString(36), title: 'Novo trabalho', styles: [], placement: '', date: new Date().toISOString().slice(0, 10), description: '', instagram: '', featured: false, images });
    drawPortfolio(); alertBox('Fotos enviadas. Preencha os dados e clique em Salvar portfólio.');
  } catch (err) { alertBox(esc(err.message), 'err'); }
});

$$('[data-save]').forEach((b) => b.addEventListener('click', async () => {
  const name = b.dataset.save;
  try { await api('/api/admin/' + name, { method: 'PUT', body: { items: state[name] } }); alertBox(name === 'catalog' ? 'Catálogo salvo. O site já mostra as mudanças.' : 'Portfólio salvo. O site já mostra as mudanças.'); }
  catch (err) { alertBox(esc(err.message), 'err'); }
}));

// ---------- configurações ----------
function fillSettings() {
  const s = state.settings, f = $('#settings');
  for (const [k, v] of Object.entries(s.contact)) { const el = f.elements['c.' + k]; if (!el) continue; if (el.type === 'checkbox') el.checked = v; else el.value = v; }
  const b = s.booking;
  ['open', 'close', 'sessionMinutes', 'bufferMinutes', 'minAdvanceHours', 'maxDaysAhead', 'stepMinutes', 'holdHours'].forEach((k) => { f.elements['b.' + k].value = b[k]; });
  f.elements['b.breakStart'].value = b.breaks[0]?.start || ''; f.elements['b.breakEnd'].value = b.breaks[0]?.end || '';
  f.elements['b.daysOff'].value = b.daysOff.join('\n');
  $('#wdays').innerHTML = DAYS.map((d, i) => `<label><input type="checkbox" value="${i}" ${b.workingDays.includes(i) ? 'checked' : ''}><span>${d}</span></label>`).join('');
}
$('#settings').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target, g = (k) => f.elements[k].value.trim();
  const body = {
    contact: { whatsapp: g('c.whatsapp').replace(/\D/g, ''), whatsappLabel: g('c.whatsappLabel'), whatsappConfirmed: f.elements['c.whatsappConfirmed'].checked, email: g('c.email'), instagram: g('c.instagram'), city: g('c.city'), address: g('c.address') },
    booking: {
      workingDays: $$('#wdays input:checked').map((i) => Number(i.value)), open: g('b.open'), close: g('b.close'),
      breaks: g('b.breakStart') && g('b.breakEnd') ? [{ start: g('b.breakStart'), end: g('b.breakEnd') }] : [],
      sessionMinutes: g('b.sessionMinutes'), bufferMinutes: g('b.bufferMinutes'), minAdvanceHours: g('b.minAdvanceHours'), maxDaysAhead: g('b.maxDaysAhead'), stepMinutes: g('b.stepMinutes'), holdHours: g('b.holdHours'),
      daysOff: g('b.daysOff').split(/\s+/).filter(Boolean),
    },
  };
  try { const d = await api('/api/admin/settings', { method: 'PUT', body }); state.settings = d.settings; alertBox('Configurações salvas.'); }
  catch (err) { alertBox(esc(err.message), 'err'); }
});

boot();
