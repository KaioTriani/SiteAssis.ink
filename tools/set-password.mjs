// Define a senha do painel e o segredo de sessão no .env.
// Uso: node tools/set-password.mjs "senha-forte-aqui"
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { hashPassword } from '../lib/auth.mjs';
const pw = process.argv[2];
if (!pw || pw.length < 10) { console.error('Use uma senha com pelo menos 10 caracteres.'); process.exit(1); }
const file = new URL('../.env', import.meta.url);
let env = existsSync(file) ? readFileSync(file, 'utf8') : readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
const set = (k, v) => { env = new RegExp(`^${k}=.*$`, 'm').test(env) ? env.replace(new RegExp(`^${k}=.*$`, 'm'), `${k}=${v}`) : env + `\n${k}=${v}\n`; };
set('ADMIN_PASSWORD_HASH', hashPassword(pw));
if (!/^SESSION_SECRET=.{32,}$/m.test(env)) set('SESSION_SECRET', randomBytes(32).toString('hex'));
writeFileSync(file, env);
console.log('Senha do painel salva em .env');
