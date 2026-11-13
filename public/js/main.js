// Assis.ink · página principal
import { Viewer } from './viewer.js';
import { initBooking, pickArt } from './booking.js';

document.documentElement.classList.add('js');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const STYLE_LABEL = { fineline: 'Fine line', floral: 'Floral', oriental: 'Oriental', blackgrey: 'Preto e cinza', oldschool: 'Old school', escrita: 'Escrita', anime: 'Anime', blackwork: 'Blackwork' };
const TAG_LABEL = { autoral: 'Autorais', flash: 'Flash', floral: 'Floral', ornamental: 'Ornamental', tradicional: 'Tradicional', personagens: 'Personagens' };
const STATUS_LABEL = { disponivel: 'Disponível', reservada: 'Reservada', tatuada: 'Já tatuada', consultar: 'Consultar disponibilidade' };

// ---------- conteúdo (API do servidor; se o site estiver em hospedagem estática, usa o arquivo de reserva) ----------
async function loadContent() {
  try {
    const r = await fetch('/api/content', { headers: { Accept: 'application/json' } });
    if (r.ok) { const d = await r.json(); if (d.ok) return { ...d, server: true }; }
  } catch {}
  const r = await fetch('/content-fallback.json');
  return { ...(await r.json()), server: false, calendar: false };
}

// ---------- WhatsApp ----------
let contact = null;
function waLink(text) {
  const base = `https://wa.me/${contact?.whatsapp || '558382058633'}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
function applyContact(c) {
  contact = c;
  const generic = waLink('Olá, Assis! Vim pelo site e gostaria de conversar sobre uma tatuagem.');
  $$('[data-wa]').forEach((a) => { a.href = generic; a.target = '_blank'; a.rel = 'noopener'; });
  $$('[data-wa-label]').forEach((a) => { a.textContent = c.whatsappLabel; });
  if (c.address) $$('[data-address]').forEach((el) => { el.textContent = c.address; });
}

// ---------- filtros genéricos ----------
function buildFilters(box, options, onChange) {
  box.innerHTML = options.map((o, i) => `<button type="button" data-key="${o.key}" aria-pressed="${i === 0}">${esc(o.label)}<small>${o.count}</small></button>`).join('');
  box.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    $$('button', box).forEach((x) => x.setAttribute('aria-pressed', x === b));
    onChange(b.dataset.key);
  });
}

function animateFilter(items, show) {
  items.forEach((el) => el.classList.toggle('is-hidden', !show(el)));
  if (window.gsap && !reduce) gsap.fromTo(items.filter((el) => !el.classList.contains('is-hidden')), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: .5, stagger: .04, ease: 'power2.out' });
  window.ScrollTrigger?.refresh();
}

// ---------- portfólio ----------
const viewer = new Viewer($('#viewer'));

function renderPortfolio(list) {
  const g = $('#gallery');
  const order = [...list].sort((a, b) => (b.featured === true) - (a.featured === true) || (b.date || '').localeCompare(a.date || ''));
  g.innerHTML = order.map((p) => {
    const im = p.images[0];
    const styles = p.styles.map((s) => STYLE_LABEL[s] || s).join(' · ');
    return `<button class="work reveal" type="button" data-id="${esc(p.id)}" data-styles="${esc(p.styles.join(' '))}" aria-label="Ver ${esc(p.title)} em tela cheia">
      <img src="${esc(im.thumb)}" width="${Math.min(im.w, 760)}" height="${Math.round(Math.min(im.w, 760) * im.h / im.w)}" alt="${esc(im.alt)}" loading="lazy" decoding="async">
      <span class="work__zoom" aria-hidden="true"></span>
      <span class="work__info"><span><h3>${esc(p.title)}</h3><p>${esc(styles)}${p.placement ? ' · ' + esc(p.placement) : ''}</p></span>${p.images.length > 1 ? `<span class="work__count">${p.images.length} fotos</span>` : ''}</span>
    </button>`;
  }).join('');
  const counts = {};
  list.forEach((p) => p.styles.forEach((s) => { counts[s] = (counts[s] || 0) + 1; }));
  const opts = [{ key: 'all', label: 'Todos', count: list.length }, ...Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ key: k, label: STYLE_LABEL[k] || k, count: n }))];
  const items = $$('.work', g);
  buildFilters($('[data-filters="portfolio"]'), opts, (k) => animateFilter(items, (el) => k === 'all' || el.dataset.styles.split(' ').includes(k)));
  g.addEventListener('click', (e) => {
    const b = e.target.closest('.work'); if (!b) return;
    const p = list.find((x) => x.id === b.dataset.id);
    viewer.open(p.images.map((im) => ({ src: im.src, thumb: im.thumb, alt: im.alt, w: im.w, h: im.h })), 0, () => `
      <h3>${esc(p.title)}</h3>
      <div class="row-meta"><span>${esc(p.styles.map((s) => STYLE_LABEL[s] || s).join(' · '))}</span>${p.placement ? `<span>${esc(p.placement)}</span>` : ''}${p.date ? `<span>${new Date(p.date + 'T12:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span>` : ''}</div>
      ${p.description ? `<p>${esc(p.description)}</p>` : ''}
      ${p.instagram ? `<a class="link" href="${esc(p.instagram)}" target="_blank" rel="noopener">Ver o post no Instagram</a>` : ''}`, { returnFocus: b });
  });
}

// ---------- catálogo ----------
function renderCatalog(list) {
  const c = $('#catalog');
  c.innerHTML = list.map((a) => `<button class="art art--${esc(a.status)} reveal" type="button" data-id="${esc(a.id)}" data-tags="${esc(a.tags.join(' '))}" aria-label="Ver arte ${esc(a.id)}, ${esc(a.title)}">
      <span class="art__img"><img src="${esc(a.image)}" alt="Desenho ${esc(a.title)}, arte disponível para tatuagem" loading="lazy" decoding="async"></span>
      <span class="art__body"><span class="art__id">${esc(a.id)}</span><span class="art__title">${esc(a.title)}</span>
      <span class="art__meta"><span class="status status--${esc(a.status)}">${STATUS_LABEL[a.status] || a.status}</span>${a.size ? `<span>${esc(a.size)}</span>` : ''}</span></span>
    </button>`).join('');
  const counts = {};
  list.forEach((a) => a.tags.forEach((t) => { counts[t] = (counts[t] || 0) + 1; }));
  const order = ['autoral', 'flash', 'floral', 'ornamental', 'tradicional', 'personagens'];
  const opts = [{ key: 'all', label: 'Todas', count: list.length }, ...order.filter((k) => counts[k]).map((k) => ({ key: k, label: TAG_LABEL[k], count: counts[k] }))];
  const items = $$('.art', c);
  buildFilters($('[data-filters="catalog"]'), opts, (k) => animateFilter(items, (el) => k === 'all' || el.dataset.tags.split(' ').includes(k)));
  c.addEventListener('click', (e) => {
    const b = e.target.closest('.art'); if (!b) return;
    const a = list.find((x) => x.id === b.dataset.id);
    const imgs = [{ src: a.image, thumb: a.image, alt: `Arte ${a.title}` }];
    if (a.sheet) imgs.push({ src: a.sheet, thumb: a.sheet, alt: `Folha original com a arte ${a.title}` });
    viewer.open(imgs, 0, (i) => `
      <h3>${esc(a.id)} · ${esc(a.title)}</h3>
      <div class="row-meta"><span class="status status--${esc(a.status)}">${STATUS_LABEL[a.status] || a.status}</span>${a.size ? `<span>Tamanho: ${esc(a.size)}</span>` : ''}<span>${esc(a.tags.map((t) => TAG_LABEL[t] || t).join(' · '))}</span></div>
      ${i === 1 ? '<p>Folha original publicada nos stories.</p>' : a.note ? `<p>${esc(a.note)}</p>` : ''}
      ${a.status === 'tatuada' ? '<p>Essa arte já foi tatuada. Peça uma ideia parecida como projeto personalizado.</p>' : `<button class="btn btn--red" type="button" data-want="${esc(a.id)}">Quero tatuar essa arte <i class="arrow" aria-hidden="true"></i></button>`}`,
    { paper: true, returnFocus: b });
  });
  $('#viewer').addEventListener('click', (e) => {
    const w = e.target.closest('[data-want]'); if (!w) return;
    const a = list.find((x) => x.id === w.dataset.want);
    viewer.close(false);
    pickArt(a);
    $('#agendar').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  });
}

// ---------- navegação ----------
function initNav() {
  const nav = $('.nav');
  const onScroll = () => nav.classList.toggle('is-solid', scrollY > 40);
  onScroll(); addEventListener('scroll', onScroll, { passive: true });
  const toggle = $('.nav__toggle'), menu = $('#menu');
  const setMenu = (open) => {
    toggle.setAttribute('aria-expanded', open); toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    menu.hidden = !open; document.body.style.overflow = open ? 'hidden' : '';
    if (open) $('a', menu).focus();
  };
  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); toggle.focus(); } });
  const links = $$('.nav__links a');
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting) links.forEach((l) => l.classList.toggle('is-current', l.getAttribute('href') === '#' + en.target.id));
  }), { rootMargin: '-45% 0px -50% 0px' });
  ['trabalhos', 'artes', 'maquina', 'sobre', 'processo', 'contato'].forEach((id) => io.observe(document.getElementById(id)));
  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
}

// ---------- animações ----------
function initMotion() {
  if (reduce || !window.gsap) { $$('.reveal').forEach((el) => { el.style.opacity = 1; el.style.transform = 'none'; }); return; }
  gsap.registerPlugin(ScrollTrigger);
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  tl.from('.hero__title .line > span', { yPercent: 110, duration: 1.3, stagger: .12 })
    .from('.hero .eyebrow, .hero__lead, .hero__ctas', { opacity: 0, y: 20, duration: 1, stagger: .08 }, '-=.9')
    .from('.hero__frame', { clipPath: 'inset(100% 0 0 0)', duration: 1.4, ease: 'power4.inOut' }, 0.1)
    .from('.hero__frame img', { scale: 1.25, duration: 1.8 }, 0.1)
    .fromTo('.hero__needle path', { strokeDashoffset: 1600 }, { strokeDashoffset: 0, duration: 2.2, ease: 'power2.inOut' }, .5)
    .from('.hero__foot > *', { opacity: 0, y: 10, stagger: .05, duration: .6 }, '-=1.4');
  gsap.to('.hero__frame img', { yPercent: -10, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.hero__script', { xPercent: -12, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  ScrollTrigger.batch('.reveal', { start: 'top 90%', once: true, onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: .9, stagger: .06, ease: 'power3.out' }) });
  $$('.section .title, .final__title').forEach((t) => gsap.from(t, { y: 50, opacity: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: t, start: 'top 88%', once: true } }));
  $$('.step').forEach((s, i) => ScrollTrigger.create({ trigger: s, start: 'top 75%', once: true, onEnter: () => setTimeout(() => s.classList.add('is-on'), i * 120) }));
  gsap.from('.about__photo img', { clipPath: 'inset(0 0 100% 0)', duration: 1.4, ease: 'power4.inOut', scrollTrigger: { trigger: '.about__photo', start: 'top 80%', once: true } });
}

// ---------- 3D sob demanda ----------
function initMachine() {
  const el = $('#machine');
  const io = new IntersectionObserver(async ([en]) => {
    if (!en.isIntersecting) return;
    io.disconnect();
    try {
      const mod = await import('./machine.js');
      const api = mod.mountMachine(el, { reduce });
      if (!api) return;
      $$('#parts button').forEach((b) => b.addEventListener('click', () => {
        const on = b.getAttribute('aria-pressed') !== 'true';
        $$('#parts button').forEach((x) => x.setAttribute('aria-pressed', 'false'));
        b.setAttribute('aria-pressed', on);
        api.focus(on ? b.dataset.part : null);
      }));
      $('[data-view="reset"]').addEventListener('click', () => { api.reset(); $$('#parts button').forEach((x) => x.setAttribute('aria-pressed', 'false')); });
      const auto = $('[data-view="auto"]');
      if (reduce) auto.setAttribute('aria-pressed', 'false');
      auto.addEventListener('click', () => { const on = auto.getAttribute('aria-pressed') !== 'true'; auto.setAttribute('aria-pressed', on); api.autoRotate(on); });
    } catch (e) { console.warn('3D indisponível, mantendo imagem estática.', e); }
  }, { rootMargin: '300px' });
  io.observe(el);
}

// ---------- início ----------
initNav();
initMachine();
const content = await loadContent();
applyContact(content.contact);
renderPortfolio(content.portfolio);
renderCatalog(content.catalog);
initBooking({ content, waLink, catalog: content.catalog });
if (document.readyState === 'complete') initMotion(); else addEventListener('load', initMotion, { once: true });
