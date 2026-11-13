// Formulário de agendamento em etapas: validação, referências, horários livres e envio.
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let form, ctx, step = 1, refs = [], slotMode = false, catalog = [];
const MAX_REFS = 6;

export function pickArt(a) {
  if (!form) return;
  const box = $('#picked');
  box.hidden = false;
  $('img', box).src = a.image; $('img', box).alt = a.title;
  $('b', box).textContent = a.title; $('small', box).textContent = a.id + (a.size ? ' · ' + a.size : '');
  form.artId.value = a.id;
  $('#art-text-field').hidden = true;
  const isFlash = a.tags.includes('flash');
  const radio = $$('input[name="projectType"]', form).find((r) => r.value === (isFlash ? 'Flash disponível' : 'Arte autoral'));
  if (radio) radio.checked = true;
  if (a.size && !form.size.value) form.size.value = a.size;
  if (step > 2) go(2);
}

function unpick() {
  $('#picked').hidden = true; form.artId.value = ''; $('#art-text-field').hidden = false;
}

// ---------- validação ----------
function setErr(name, msg) {
  const input = form.elements[name];
  const el = input?.length && !input.tagName ? input[0] : input;
  const field = (el?.closest('.field')) || (name === 'consent' ? $('.consent', form) : null) || (name === 'slot' ? $('#slots-ui') : null);
  if (!field) return;
  field.classList.add('is-invalid');
  let p = $('.field__err', field);
  if (!p) { p = document.createElement('small'); p.className = 'field__err'; field.append(p); }
  p.textContent = msg;
  el?.setAttribute?.('aria-invalid', 'true');
}
function clearErrs() {
  $$('.is-invalid', form).forEach((f) => f.classList.remove('is-invalid'));
  $$('.field__err', form).forEach((p) => p.remove());
  $$('[aria-invalid]', form).forEach((i) => i.removeAttribute('aria-invalid'));
  $('.form__error', form).textContent = '';
}

function validate(n) {
  clearErrs();
  const e = {};
  const v = (k) => (form.elements[k]?.value || '').trim();
  if (n === 1) {
    if (v('name').length < 3) e.name = 'Informe seu nome completo.';
    if (v('whatsapp').replace(/\D/g, '').length < 10) e.whatsapp = 'Informe um WhatsApp com DDD.';
    if (v('email') && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v('email'))) e.email = 'Confira o e-mail.';
  }
  if (n === 2) {
    if (!form.querySelector('input[name="projectType"]:checked')) e.projectType = 'Escolha o tipo de projeto.';
    if (!v('placement')) e.placement = 'Escolha o local do corpo.';
    if (refs.some((r) => r.loading)) e.refs = 'Aguarde as imagens terminarem de carregar.';
  }
  if (n === 3) {
    if (slotMode) { if (!v('slotStart')) e.slot = 'Escolha um horário ou indique datas de preferência.'; }
    else {
      const today = new Date().toISOString().slice(0, 10);
      if (!v('preferredDate')) e.preferredDate = 'Escolha uma data de preferência.';
      else if (v('preferredDate') < today) e.preferredDate = 'Escolha uma data a partir de hoje.';
      if (v('altDate') && v('altDate') < today) e.altDate = 'Escolha uma data a partir de hoje.';
    }
  }
  if (n === 4 && !form.consent.checked) e.consent = 'Marque a autorização para enviar.';
  Object.entries(e).forEach(([k, m]) => setErr(k, m));
  if (Object.keys(e).length) {
    $('.form__error', form).textContent = 'Confira os campos destacados.';
    const first = $('.is-invalid input, .is-invalid select, .is-invalid textarea', form);
    first?.focus();
    return false;
  }
  return true;
}

// ---------- etapas ----------
function go(n) {
  step = n;
  $$('.step-panel', form).forEach((p) => p.classList.toggle('is-active', Number(p.dataset.step) === n));
  $$('[data-step-dot]', form).forEach((d) => {
    const k = Number(d.dataset.stepDot);
    d.classList.toggle('is-active', k === n); d.classList.toggle('is-done', k < n);
    if (k === n) d.setAttribute('aria-current', 'step'); else d.removeAttribute('aria-current');
  });
  $('[data-prev]', form).hidden = n === 1;
  $('[data-next]', form).hidden = n === 4;
  $('[data-submit]', form).hidden = n !== 4;
  if (n === 3 && ctx.content.calendar && !slotsLoaded) loadSlots();
  if (n === 4) review();
  const top = form.getBoundingClientRect().top;
  if (top < 0 || top > innerHeight * .6) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('.step-panel.is-active legend', form)?.setAttribute('tabindex', '-1');
  $('.step-panel.is-active legend', form)?.focus({ preventScroll: true });
}

// ---------- referências (comprimidas no navegador antes de enviar) ----------
function compress(file) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return reject(new Error('Formato não suportado'));
    if (file.size > 10 * 1024 * 1024) return reject(new Error('Imagem maior que 10 MB'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 2000 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', .86));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não consegui ler a imagem')); };
    img.src = url;
  });
}

function drawThumbs() {
  $('#thumbs').innerHTML = refs.map((r, i) => r.loading
    ? `<li class="is-loading">carregando</li>`
    : `<li><img src="${r.data}" alt="Referência ${i + 1}"><button type="button" data-rm="${i}" aria-label="Remover referência ${i + 1}">×</button></li>`).join('');
}

async function addFiles(files) {
  const list = [...files].slice(0, MAX_REFS - refs.length);
  if (files.length > list.length) $('.form__error', form).textContent = `Máximo de ${MAX_REFS} imagens.`;
  for (const f of list) {
    const r = { name: f.name, loading: true }; refs.push(r); drawThumbs();
    try { r.data = await compress(f); r.loading = false; }
    catch (e) { refs.splice(refs.indexOf(r), 1); $('.form__error', form).textContent = `${f.name}: ${e.message}.`; }
    drawThumbs();
  }
}

// ---------- horários livres ----------
let slotsLoaded = false, days = {};
async function loadSlots() {
  slotsLoaded = true;
  try {
    const r = await fetch('/api/slots');
    const d = await r.json();
    if (!d.enabled || !Object.keys(d.days).length) {
      $('#pref-hint').textContent = d.enabled ? 'Não há horários livres no período aberto da agenda. Indique suas datas de preferência e o Assis retorna.' : 'Indique suas datas de preferência. O Assis confere a agenda e confirma com você.';
      return;
    }
    days = d.days;
    $('[data-session]').textContent = d.sessionMinutes >= 60 ? `${Math.round(d.sessionMinutes / 60 * 10) / 10} h` : `${d.sessionMinutes} min`;
    $('#cal').innerHTML = Object.keys(days).map((ymd) => {
      const dt = new Date(ymd + 'T12:00:00-03:00');
      return `<button type="button" data-day="${ymd}" aria-pressed="false" aria-label="${dt.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}"><small>${dt.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</small><b>${dt.getDate()}</b><small>${dt.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</small></button>`;
    }).join('');
    setSlotMode(true);
    $('#times').innerHTML = '<p>Escolha um dia para ver os horários.</p>';
  } catch {
    $('#pref-hint').textContent = 'Não consegui consultar a agenda agora. Indique suas datas de preferência.';
  }
}

function setSlotMode(on) {
  slotMode = on;
  $('#slots-ui').hidden = !on; $('#pref-ui').hidden = on;
  $('#back-slots').hidden = on || !Object.keys(days).length;
  if (!on) form.slotStart.value = '';
}

// ---------- revisão ----------
function data() {
  const f = new FormData(form);
  const g = (k) => (f.get(k) || '').toString().trim();
  return {
    name: g('name'), whatsapp: g('whatsapp'), email: g('email'), website: g('website'),
    projectType: g('projectType'), artId: g('artId'), artText: g('artText'), style: g('style'), placement: g('placement'), size: g('size'),
    firstTattoo: g('firstTattoo') || 'Não', description: g('description'),
    slotStart: slotMode ? g('slotStart') : '', preferredDate: slotMode ? '' : g('preferredDate'), altDate: slotMode ? '' : g('altDate'),
    period: g('period') || 'Flexível', notes: g('notes'), consent: form.consent.checked,
    refs: refs.filter((r) => !r.loading).map((r) => ({ name: r.name, data: r.data })),
  };
}
const fmtDay = (ymd) => ymd ? new Date(ymd + 'T12:00:00-03:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
const fmtSlot = (iso) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Fortaleza', weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' });
function artLabel(d) { const a = catalog.find((x) => x.id === d.artId); return a ? `${a.id} · ${a.title}` : d.artText; }

function review() {
  const d = data();
  const rows = [
    ['Nome', d.name], ['WhatsApp', d.whatsapp], ['E-mail', d.email || 'não informado'],
    ['Projeto', d.projectType], ['Arte', artLabel(d) || 'nenhuma'], ['Estilo', d.style || 'a definir'], ['Local', d.placement], ['Tamanho', d.size || 'a definir'],
    ['Primeira tatuagem', d.firstTattoo], ['Descrição', d.description || '-'], ['Referências', d.refs.length ? `${d.refs.length} imagem(ns)` : 'nenhuma'],
    d.slotStart ? ['Horário escolhido', fmtSlot(d.slotStart)] : ['Datas', [fmtDay(d.preferredDate), fmtDay(d.altDate)].filter(Boolean).join(' ou ')],
    ['Período', d.period],
  ];
  $('#review').innerHTML = rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
}

// Mensagem montada no navegador (usada quando o servidor não está disponível)
function localMessage(d) {
  return ['Olá, Assis! Tudo bem?', '', 'Gostaria de solicitar um agendamento para fazer uma tatuagem.', '',
    '*Meus dados:*', `Nome: ${d.name}`, `WhatsApp: ${d.whatsapp}`, `E-mail: ${d.email || 'não informado'}`, '',
    '*Informações da tatuagem:*', `Tipo de projeto: ${d.projectType}`, `Arte escolhida: ${artLabel(d) || 'nenhuma'}`, `Estilo: ${d.style || 'a definir'}`,
    `Local do corpo: ${d.placement}`, `Tamanho aproximado: ${d.size || 'a definir'}`, `Primeira tatuagem: ${d.firstTattoo}`, `Descrição: ${d.description || '-'}`, '',
    '*Preferências de agendamento:*', `Primeira opção de data: ${fmtDay(d.preferredDate) || 'não informado'}`, `Segunda opção: ${fmtDay(d.altDate) || 'não informado'}`, `Horário preferido: ${d.period}`,
    ...(d.refs.length ? ['', 'Tenho imagens de referência e vou enviar aqui na conversa.'] : []),
    ...(d.notes ? ['', `Obs.: ${d.notes}`] : []),
    '', 'Gostaria de conversar sobre os detalhes do projeto e verificar a disponibilidade da agenda!'].join('\n');
}

function done({ id, whatsappUrl, registered, schedule }) {
  form.hidden = true;
  const box = $('#done'); box.hidden = false;
  $('[data-protocol]', box).textContent = id || '';
  $('.done__title', box).firstChild.textContent = id ? 'Pedido ' : 'Quase lá';
  $('.done__status', box).innerHTML = registered ? '<b>Status:</b> solicitação recebida, aguardando confirmação do Assis.' : '<b>Status:</b> falta enviar a mensagem no WhatsApp.';
  $('[data-done-text]', box).textContent = registered
    ? (schedule?.slotStart ? `O horário de ${fmtSlot(schedule.slotStart)} ficou pré-reservado para você enquanto o Assis analisa. A sessão só está confirmada quando ele aprovar e o compromisso entrar na agenda. Para agilizar, envie também o resumo pelo WhatsApp.` : 'Seu pedido foi registrado. O agendamento só é confirmado depois que o Assis aprovar e o horário entrar na agenda. Para agilizar, envie também o resumo pelo WhatsApp.')
    : 'Não consegui registrar o pedido pelo site agora. Toque no botão abaixo para enviar tudo pelo WhatsApp; as imagens de referência você manda direto na conversa.';
  $('[data-done-wa]', box).href = whatsappUrl;
  box.focus();
  box.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function submit() {
  if (!validate(4)) return;
  const btn = $('[data-submit]', form);
  btn.disabled = true; btn.textContent = 'Enviando...';
  const d = data();
  try {
    if (!ctx.content.server) throw new Error('offline');
    const r = await fetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
    const res = await r.json().catch(() => ({}));
    if (r.ok && res.ok) return done({ id: res.id, whatsappUrl: res.whatsappUrl, registered: true, schedule: res.schedule });
    if (r.status === 422 || r.status === 409 || r.status === 429) {
      const fields = res.fields || {};
      const stepOf = { name: 1, whatsapp: 1, email: 1, projectType: 2, placement: 2, refs: 2, slot: 3, preferredDate: 3, consent: 4 };
      const first = Math.min(4, ...Object.keys(fields).map((k) => stepOf[k] || 4));
      if (fields.slot) { slotsLoaded = false; form.slotStart.value = ''; }
      if (Object.keys(fields).length) go(first);
      Object.entries(fields).forEach(([k, m]) => setErr(k, m));
      $('.form__error', form).textContent = res.error || 'Confira os dados.';
      return;
    }
    throw new Error(res.error || 'erro');
  } catch {
    done({ whatsappUrl: ctx.waLink(localMessage(d)), registered: false });
  } finally {
    btn.disabled = false; btn.textContent = 'Enviar pedido';
  }
}

export function initBooking(c) {
  ctx = c; catalog = c.catalog; form = $('#booking-form');
  const today = new Date(); today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  form.preferredDate.min = form.altDate.min = today.toISOString().slice(0, 10);

  $('[data-next]', form).addEventListener('click', () => { if (validate(step)) go(step + 1); });
  $('[data-prev]', form).addEventListener('click', () => { clearErrs(); go(step - 1); });
  form.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox' && step < 4) { e.preventDefault(); if (validate(step)) go(step + 1); }
  });
  form.addEventListener('input', (e) => { const f = e.target.closest('.is-invalid'); if (f) { f.classList.remove('is-invalid'); $('.field__err', f)?.remove(); } });
  $('[data-unpick]').addEventListener('click', unpick);

  const drop = $('#drop'), input = $('input[type="file"]', drop);
  input.addEventListener('change', () => { addFiles(input.files); input.value = ''; });
  ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, () => drop.classList.remove('is-over')));
  drop.addEventListener('drop', (e) => { e.preventDefault(); addFiles(e.dataTransfer.files); });
  $('#thumbs').addEventListener('click', (e) => { const b = e.target.closest('[data-rm]'); if (b) { refs.splice(Number(b.dataset.rm), 1); drawThumbs(); } });

  $('#cal').addEventListener('click', (e) => {
    const b = e.target.closest('[data-day]'); if (!b) return;
    $$('#cal button').forEach((x) => x.setAttribute('aria-pressed', x === b));
    form.slotStart.value = '';
    $('#times').innerHTML = days[b.dataset.day].map((s) => `<button type="button" data-start="${s.start}" aria-pressed="false">${s.label}</button>`).join('');
  });
  $('#times').addEventListener('click', (e) => {
    const b = e.target.closest('[data-start]'); if (!b) return;
    $$('#times button').forEach((x) => x.setAttribute('aria-pressed', x === b));
    form.slotStart.value = b.dataset.start;
    $('#slots-ui').classList.remove('is-invalid'); $('#slots-ui .field__err')?.remove();
  });
  $('#no-slot').addEventListener('click', () => setSlotMode(false));
  $('#back-slots').addEventListener('click', () => setSlotMode(true));

  $('[data-restart]').addEventListener('click', () => {
    form.reset(); refs = []; drawThumbs(); unpick(); setSlotMode(Boolean(Object.keys(days).length));
    slotsLoaded = false;
    $('#done').hidden = true; form.hidden = false; go(1);
  });
}
