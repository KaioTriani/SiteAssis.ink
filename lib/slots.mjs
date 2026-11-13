// Cálculo de horários livres a partir das regras do artista + intervalos ocupados.
// João Pessoa usa UTC-03:00 o ano inteiro (sem horário de verão), definido em settings.booking.utcOffset.

const pad = (n) => String(n).padStart(2, '0');

export function localDate(ms, offset) {
  const sign = offset.startsWith('-') ? -1 : 1;
  const [h, m] = offset.slice(1).split(':').map(Number);
  const d = new Date(ms + sign * (h * 60 + m) * 60000);
  return { ymd: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`, weekday: d.getUTCDay(), hm: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` };
}

export const at = (ymd, hm, offset) => Date.parse(`${ymd}T${hm}:00${offset}`);

const overlaps = (a, b) => a.start < b.end && b.start < a.end;

export function windowFor(rules, now = Date.now()) {
  const from = now + rules.minAdvanceHours * 3600e3;
  const to = now + rules.maxDaysAhead * 864e5;
  return { from, to };
}

// Lista de candidatos (sem consultar agenda) entre from e to.
export function candidates(rules, from, to) {
  const out = [];
  const dur = rules.sessionMinutes * 60e3;
  const step = (rules.stepMinutes || 60) * 60e3;
  const off = rules.utcOffset;
  let day = localDate(from, off).ymd;
  for (let i = 0; i < 400; i++) {
    const dayStart = at(day, '00:00', off);
    if (dayStart > to) break;
    const wd = new Date(dayStart + 12 * 3600e3).getUTCDay();
    const isOff = (rules.daysOff || []).includes(day);
    if (rules.workingDays.includes(wd) && !isOff) {
      const open = at(day, rules.open, off);
      const close = at(day, rules.close, off);
      const breaks = (rules.breaks || []).map((b) => ({ start: at(day, b.start, off), end: at(day, b.end, off) }));
      for (let s = open; s + dur <= close; s += step) {
        const slot = { start: s, end: s + dur };
        if (s < from || s > to) continue;
        if (breaks.some((b) => overlaps(slot, b))) continue;
        out.push(slot);
      }
    }
    day = localDate(dayStart + 36 * 3600e3, off).ymd;
  }
  return out;
}

// Remove candidatos que batem com ocupados (Google) ou com reservas pendentes, respeitando o intervalo entre sessões.
export function freeSlots(rules, cands, busyList) {
  const buf = (rules.bufferMinutes || 0) * 60e3;
  return cands.filter((c) => !busyList.some((b) => overlaps({ start: c.start - buf, end: c.end + buf }, b)));
}

export function isCandidate(rules, start, now = Date.now()) {
  const { from, to } = windowFor(rules, now);
  return candidates(rules, from, to).some((c) => c.start === start);
}

export function groupByDay(slots, offset) {
  const days = {};
  for (const s of slots) {
    const { ymd, hm } = localDate(s.start, offset);
    (days[ymd] ||= []).push({ start: new Date(s.start).toISOString(), end: new Date(s.end).toISOString(), label: hm });
  }
  return days;
}
