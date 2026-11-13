// Gera release/assis-ink.zip para publicar (sem data/, .env, referências e ferramentas de desenvolvimento).
// Uso: node tools/package.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'release');
const stage = join(out, 'assis-ink');
const zip = join(out, 'assis-ink.zip');
rmSync(stage, { recursive: true, force: true });
if (existsSync(zip)) rmSync(zip);
mkdirSync(stage, { recursive: true });
for (const p of ['server.mjs', 'package.json', 'lib', 'public', 'data-seed', '.env.example', 'README.md']) cpSync(join(root, p), join(stage, p), { recursive: true });
mkdirSync(join(stage, 'tools'));
cpSync(join(root, 'tools', 'set-password.mjs'), join(stage, 'tools', 'set-password.mjs'));
cpSync(join(root, 'tools', 'functest.mjs'), join(stage, 'tools', 'functest.mjs'));
if (process.platform === 'win32') {
  execFileSync('powershell.exe', ['-NoProfile', '-Command', `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('${stage}', '${zip}')`], { stdio: 'inherit' });
} else {
  execFileSync('zip', ['-r', '-q', zip, '.'], { cwd: stage, stdio: 'inherit' });
}
rmSync(stage, { recursive: true, force: true });
console.log('Pacote gerado:', zip);
