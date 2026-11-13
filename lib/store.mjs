// Armazenamento em arquivos JSON dentro de DATA_DIR (fora da pasta pública).
// Escrita atômica (arquivo temporário + rename) e fila para evitar gravações simultâneas.
import { readFile, writeFile, rename, mkdir, copyFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DATA_DIR = process.env.DATA_DIR || fileURLToPath(new URL('../data/', import.meta.url));
const SEED_DIR = fileURLToPath(new URL('../data-seed/', import.meta.url));

export const paths = {
  uploads: join(DATA_DIR, 'uploads'),
  media: join(DATA_DIR, 'media'),
};

const cache = new Map();
let queue = Promise.resolve();

export async function init() {
  await mkdir(paths.uploads, { recursive: true });
  await mkdir(paths.media, { recursive: true });
  for (const name of ['portfolio', 'catalog', 'settings']) {
    const file = join(DATA_DIR, name + '.json');
    try { await access(file); } catch { await copyFile(join(SEED_DIR, name + '.json'), file); }
  }
  for (const name of ['bookings']) {
    const file = join(DATA_DIR, name + '.json');
    try { await access(file); } catch { await writeFile(file, '[]'); }
  }
}

export async function read(name) {
  if (cache.has(name)) return structuredClone(cache.get(name));
  const raw = await readFile(join(DATA_DIR, name + '.json'), 'utf8').catch(() => null);
  const value = raw ? JSON.parse(raw) : null;
  cache.set(name, value);
  return structuredClone(value);
}

export function write(name, value) {
  queue = queue.then(async () => {
    const file = join(DATA_DIR, name + '.json');
    const tmp = file + '.' + process.pid + '.tmp';
    await writeFile(tmp, JSON.stringify(value, null, 2));
    await rename(tmp, file);
    cache.set(name, structuredClone(value));
  });
  return queue;
}

// Atualiza um arquivo com uma função, dentro da fila (leitura + escrita sem corrida).
export function update(name, fn) {
  const run = queue.then(async () => {
    const current = await read(name);
    const next = await fn(current);
    const file = join(DATA_DIR, name + '.json');
    const tmp = file + '.' + process.pid + '.tmp';
    await writeFile(tmp, JSON.stringify(next.value ?? next, null, 2));
    await rename(tmp, file);
    cache.set(name, structuredClone(next.value ?? next));
    return next.result ?? next;
  });
  queue = run.catch(() => {});
  return run;
}
