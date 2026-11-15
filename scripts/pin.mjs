#!/usr/bin/env node
// Lists a repository's skills, or moves them to a newer commit: writes each one's file in registry/, then rebuilds
// index.json.
//
//   node scripts/pin.mjs <repository>                   its skills at the tip of its default branch
//   node scripts/pin.mjs <repository> <ref>             at a branch, a tag (v1.2.0) or a commit
//   node scripts/pin.mjs <repository> [ref] --kind <k>  listed as another kind of kinds.json's code track (skill)
//
// Each skill in its skills/ folder gets registry/<kind>/<owner>/<name>.json, pinned to that commit, with the version
// its openfilm.json says. Then run `node scripts/check.mjs` and open a pull request.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, indexText } from './build-index.mjs';
import { LISTING, listedKinds, uidOf } from './check.mjs';

const ROOT = join(import.meta.dirname, '..');

/**
 * Writes the listing of each skill in a repository's checkout, at one commit, and rebuilds index.json. Throws, saying
 * why, when one cannot be listed. → the listings written, by their files.
 * @param {{ dir: string, repo: string, commit: string, kind?: string, root?: string }} o
 */
export function pinSkills({ dir, repo, commit, kind = 'skill', root = ROOT }) {
  const kinds = listedKinds(root);
  if (!kinds.includes(kind)) throw new Error(`a kind is one of ${kinds.join(', ')}`);
  const skills = join(dir, 'skills');
  const names = existsSync(skills) ? readdirSync(skills).filter((n) => existsSync(join(skills, n, 'SKILL.md'))).sort() : [];
  if (!names.length) throw new Error(`${repo} has no skills: each one is a folder in skills/ with a SKILL.md`);
  /** @type {{ file: string, entry: { name: string, repo: string, path: string, version: string, commit: string } }[]} */
  const out = [];
  for (const name of names) {
    let version;
    try { version = JSON.parse(readFileSync(join(skills, name, 'openfilm.json'), 'utf8')).version; }
    catch { throw new Error(`${name} has no openfilm.json to read its version from`); }
    const uid = uidOf(repo, name);
    const file = `registry/${kind}/${uid}.json`;
    if (!LISTING.test(file)) throw new Error(`${uid} cannot be listed: an owner and a name are lowercase letters, digits and hyphens`);
    for (const other of kinds) {
      const there = join(root, 'registry', other, `${uid}.json`);
      if (!existsSync(there)) continue;
      if (other !== kind) throw new Error(`${uid} is already listed as a ${other}: registry/${other}/${uid}.json`);
      const listed = JSON.parse(readFileSync(there, 'utf8'));
      if (listed.repo !== repo) throw new Error(`${uid} is already listed, from ${listed.repo}`);
    }
    out.push({ file, entry: { name, repo, path: `skills/${name}`, version, commit } });
  }
  for (const { file, entry } of out) {
    mkdirSync(join(root, file, '..'), { recursive: true });
    writeFileSync(join(root, file), `${JSON.stringify(entry, null, 2)}\n`);
  }
  writeFileSync(join(root, 'index.json'), indexText(build({ root })));
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const k = args.indexOf('--kind');
  const kind = k >= 0 ? args.splice(k, 2)[1] : 'skill';
  const [input, ref = 'HEAD'] = args;
  const fail = (/** @type {string} */ why) => { console.error(`pin: ${why}`); process.exit(1); };
  if (!input) fail('name a repository: node scripts/pin.mjs https://github.com/<owner>/<name> [ref] [--kind skill]');
  const repo = input.replace(/\/+$/, '').replace(/\.git$/, '');
  if (!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(repo)) fail(`${input} is not https://github.com/<owner>/<name>`);

  const dir = mkdtempSync(join(tmpdir(), 'openfilm-pin-'));
  try {
    const git = (/** @type {string[]} */ a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    git(['init', '-q']);
    try { git(['fetch', '-q', '--depth', '1', repo, ref]); }
    catch { fail(`cannot fetch ${ref} from ${repo}`); }
    git(['checkout', '-q', 'FETCH_HEAD']);
    const commit = git(['rev-parse', 'HEAD']);
    let pinned = [];
    try { pinned = pinSkills({ dir, repo, commit, kind }); }
    catch (e) { fail(e instanceof Error ? e.message : String(e)); }
    for (const { file, entry } of pinned) console.log(`${file}: ${entry.version} at ${commit.slice(0, 7)}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
