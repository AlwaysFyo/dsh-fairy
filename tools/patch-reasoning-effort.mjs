// Force @ayanehana/dsh-reasoning-effort to use its own model+effort popup
// (the `.re-model-menu` UI the reference project shows) instead of the
// native-menu integration. The 0.9.0 bundle matches the native menu with
// `props.t('menu.aria')`, a locale key its own dictionaries never define, so
// the native path silently injects nothing at all.
//
// Usage: node tools/patch-reasoning-effort.mjs [--check]
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const TARGET = 'dev/profile/node_modules/@ayanehana/dsh-reasoning-effort/lib/client/index.js';
const BEFORE = 'const entry = ctx.slots.entries?.(SLOT).find(';
const AFTER = 'const entry = false && ctx.slots.entries?.(SLOT).find(';

const file = path.resolve(TARGET);
if (!existsSync(file)) {
  console.error(`missing ${TARGET} — install @ayanehana/dsh-reasoning-effort in dev/profile first`);
  process.exit(1);
}
const source = await readFile(file, 'utf8');
const patched = source.includes(AFTER);
const check = process.argv.includes('--check');

if (check) {
  console.log(patched ? 'patched' : 'unpatched');
  process.exit(patched ? 0 : 1);
}
if (patched) {
  console.log('already patched');
  process.exit(0);
}
if (!source.includes(BEFORE)) {
  console.error('detection line not found — plugin bundle changed, re-check the patch');
  process.exit(1);
}
await writeFile(file, source.replace(BEFORE, AFTER), 'utf8');
console.log('patched dev/profile/@ayanehana/dsh-reasoning-effort → custom model+effort popup');
