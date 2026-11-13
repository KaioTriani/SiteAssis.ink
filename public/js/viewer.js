// Visualizador em tela cheia com zoom (roda, pinça, duplo toque, botões) e arraste.
export class Viewer {
  constructor(root) {
    this.root = root;
    this.stage = root.querySelector('#viewer-stage');
    this.img = root.querySelector('#viewer-img');
    this.meta = root.querySelector('#viewer-meta');
    this.thumbs = root.querySelector('#viewer-thumbs');
    this.zoomLabel = root.querySelector('#viewer-zoom');
    this.items = []; this.i = 0; this.s = 1; this.x = 0; this.y = 0;
    this.pointers = new Map();
    this.bind();
  }

  open(items, index, metaFn, opts = {}) {
    this.items = items; this.metaFn = metaFn; this.returnFocus = opts.returnFocus || document.activeElement;
    this.root.classList.toggle('is-paper', Boolean(opts.paper));
    this.root.hidden = false;
    document.body.style.overflow = 'hidden';
    this.thumbs.innerHTML = items.length > 1 ? items.map((it, k) => `<button type="button" data-k="${k}" aria-label="Imagem ${k + 1}"><img src="${it.thumb}" alt=""></button>`).join('') : '';
    this.root.querySelectorAll('[data-nav]').forEach((b) => { b.hidden = items.length < 2; });
    this.show(index);
    this.root.querySelector('[data-close]').focus();
  }

  close(restore = true) {
    this.root.hidden = true;
    document.body.style.overflow = '';
    this.img.removeAttribute('src');
    if (restore) this.returnFocus?.focus?.();
  }

  show(k) {
    this.i = (k + this.items.length) % this.items.length;
    const it = this.items[this.i];
    this.img.style.opacity = 0;
    this.img.onload = () => { this.reset(); this.img.style.opacity = 1; };
    this.img.src = it.src; this.img.alt = it.alt || '';
    this.meta.innerHTML = this.metaFn ? this.metaFn(this.i) : '';
    this.thumbs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-current', Number(b.dataset.k) === this.i));
  }

  // tamanho base da imagem (encaixada) e limites
  base() {
    const r = this.stage.getBoundingClientRect();
    const nw = this.img.naturalWidth || 1, nh = this.img.naturalHeight || 1;
    const fit = Math.min((r.width - 32) / nw, (r.height - 32) / nh, nw < 900 ? 2.5 : 1);
    return { r, w: nw * fit, h: nh * fit, max: Math.max(2, Math.min(6, 2.5 / fit)) };
  }

  reset() {
    const { r, w, h } = this.base();
    this.s = 1; this.x = (r.width - w) / 2; this.y = (r.height - h) / 2;
    this.img.style.maxWidth = 'none'; this.img.style.maxHeight = 'none';
    this.img.style.width = w + 'px'; this.img.style.height = h + 'px';
    this.img.style.position = 'absolute'; this.img.style.left = '0'; this.img.style.top = '0';
    this.apply();
  }

  apply() {
    const { r, w, h } = this.base();
    const sw = w * this.s, sh = h * this.s;
    this.x = sw <= r.width ? (r.width - sw) / 2 : Math.min(0, Math.max(r.width - sw, this.x));
    this.y = sh <= r.height ? (r.height - sh) / 2 : Math.min(0, Math.max(r.height - sh, this.y));
    this.img.style.transform = `translate(${this.x}px, ${this.y}px) scale(${this.s})`;
    this.zoomLabel.textContent = Math.round(this.s * 100) + '%';
    this.stage.classList.toggle('is-zoomed', this.s > 1.01);
  }

  zoomAt(factor, cx, cy) {
    const { max } = this.base();
    const next = Math.min(max, Math.max(1, this.s * factor));
    const k = next / this.s;
    this.x = cx - (cx - this.x) * k; this.y = cy - (cy - this.y) * k; this.s = next;
    this.apply();
  }

  bind() {
    const local = (e) => { const r = this.stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    this.root.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) return this.close();
      const nav = e.target.closest('[data-nav]'); if (nav) return this.show(this.i + Number(nav.dataset.nav));
      const z = e.target.closest('[data-zoom]');
      if (z) { const r = this.stage.getBoundingClientRect(); return this.zoomAt(z.dataset.zoom === 'in' ? 1.5 : 1 / 1.5, r.width / 2, r.height / 2); }
      const t = e.target.closest('[data-k]'); if (t) return this.show(Number(t.dataset.k));
    });
    this.stage.addEventListener('wheel', (e) => { e.preventDefault(); const [x, y] = local(e); this.zoomAt(e.deltaY < 0 ? 1.18 : 1 / 1.18, x, y); }, { passive: false });
    this.stage.addEventListener('dblclick', (e) => { const [x, y] = local(e); if (this.s > 1.01) { this.s = 1; this.apply(); } else this.zoomAt(2.5, x, y); });
    let last = null, pinch = null, tap = 0, moved = false;
    this.stage.addEventListener('pointerdown', (e) => {
      this.stage.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, local(e)); moved = false;
      if (this.pointers.size === 2) { const [a, b] = [...this.pointers.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), s: this.s }; }
      last = local(e); this.stage.classList.add('is-dragging');
    });
    this.stage.addEventListener('pointermove', (e) => {
      if (!this.pointers.has(e.pointerId)) return;
      const p = local(e); this.pointers.set(e.pointerId, p);
      if (this.pointers.size === 2 && pinch) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        this.zoomAt((pinch.s * d / pinch.d) / this.s, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); moved = true;
      } else if (last) {
        const dx = p[0] - last[0], dy = p[1] - last[1];
        if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
        if (this.s > 1.01) { this.x += dx; this.y += dy; this.apply(); }
        else this.swipe = (this.swipe || 0) + dx;
        last = p;
      }
    });
    const end = (e) => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) pinch = null;
      if (this.pointers.size === 0) {
        this.stage.classList.remove('is-dragging'); last = null;
        if (this.s <= 1.01 && Math.abs(this.swipe || 0) > 60 && this.items.length > 1) this.show(this.i + (this.swipe < 0 ? 1 : -1));
        else if (!moved && e.pointerType === 'touch') {
          const now = Date.now();
          if (now - tap < 300) { const [x, y] = local(e); if (this.s > 1.01) { this.s = 1; this.apply(); } else this.zoomAt(2.5, x, y); }
          tap = now;
        }
        this.swipe = 0;
      }
    };
    this.stage.addEventListener('pointerup', end);
    this.stage.addEventListener('pointercancel', end);
    addEventListener('resize', () => { if (!this.root.hidden) this.reset(); });
    addEventListener('keydown', (e) => {
      if (this.root.hidden) return;
      if (e.key === 'Escape') this.close();
      else if (e.key === 'ArrowRight') this.show(this.i + 1);
      else if (e.key === 'ArrowLeft') this.show(this.i - 1);
      else if (e.key === '+' || e.key === '=') { const r = this.stage.getBoundingClientRect(); this.zoomAt(1.5, r.width / 2, r.height / 2); }
      else if (e.key === '-') { const r = this.stage.getBoundingClientRect(); this.zoomAt(1 / 1.5, r.width / 2, r.height / 2); }
      else if (e.key === 'Tab') {
        const f = [...this.root.querySelectorAll('button:not([hidden]), a[href]')].filter((x) => x.offsetParent !== null);
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
        else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
      }
    });
  }
}
