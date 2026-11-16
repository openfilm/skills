#!/usr/bin/env node
// Builds index.json from registry/ and revoked.json, or says what is wrong and exits 1.
//
//   node scripts/build-index.mjs                       writes index.json
//   node scripts/build-index.mjs --check               writes nothing; exits 1 when index.json is not the build
//   node scripts/build-index.mjs --out <file>          writes the build there instead
//   node scripts/build-index.mjs --at <revision>       builds a revision's registry/, read from git as data
//   node scripts/build-index.mjs --only <list>         only the listings named in <list>, a path a line (those a pull
//                                                      request changes), for the review; with --out
//
// index.json is what OpenFilm reads, at https://raw.githubusercontent.com/openfilm/community/main/index.json (and at
// the old openfilm/skills address, which GitHub redirects): { version: 1, skills, revoked }. `skills` is every listing,
// its kind added, OpenFilm's own first and then by full name; `revoked` is revoked.json. Nobody edits it by hand: a
// pull request adds or changes a listing's file, and once merged, .github/workflows/index.yml rebuilds index.json.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildIndex, checkRevoked, checkUnique, indexText, problems, readRegistry, readRegistryAt, readRevoked } from './check.mjs';

export { buildIndex, indexText };

const ROOT = join(import.meta.dirname, '..');

/**
 * The build of a checkout, or of a revision read from git; throws, saying what is wrong, when a listing or revoked.json
 * is not well formed, so a broken listing never reaches index.json.
 * @param {{ root?: string, at?: string, only?: Set<string> }} [o]
 */
export function build({ root = ROOT, at, only } = {}) {
  const before = problems.length;
  let entries, revoked;
  if (at) ({ entries, revoked } = readRegistryAt(at, { root, only }));
  else {
    ({ entries } = readRegistry(root));
    revoked = readRevoked(root);
  }
  if (!only) {
    checkUnique(entries);
    if (revoked !== null) checkRevoked(revoked, entries);
  }
  const wrong = problems.splice(before);
  if (wrong.length) throw new Error(wrong.join('\n'));
  return buildIndex(entries, /** @type {unknown[]} */ (only ? [] : revoked));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (/** @type {string} */ name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
  const at = opt('--at');
  const list = opt('--only');
  const only = list ? new Set(readFileSync(resolve(list), 'utf8').split('\n').map((l) => l.trim()).filter(Boolean)) : undefined;
  const out = opt('--out');
  if (only && (!out || args.includes('--check'))) { console.error('build-index: --only builds part of the index, for --out'); process.exit(2); }
  let text;
  try { text = indexText(build({ at, only })); }
  catch (e) { console.error(e instanceof Error ? e.message : e); process.exit(1); }
  if (args.includes('--check')) {
    let now = '';
    try { now = readFileSync(join(ROOT, 'index.json'), 'utf8'); } catch { /* none */ }
    if (now !== text) { console.error('index.json is not the build of registry/ and revoked.json: run node scripts/build-index.mjs'); process.exit(1); }
    console.log('index.json is the build of registry/ and revoked.json');
  } else {
    writeFileSync(out ? resolve(out) : join(ROOT, 'index.json'), text);
    const n = JSON.parse(text).skills.length;
    console.log(`${out ?? 'index.json'}: ${n} ${n === 1 ? 'listing' : 'listings'}`);
  }
}
