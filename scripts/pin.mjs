#!/usr/bin/env node
// Lists a repository's skills in index.json, or moves them to a newer commit.
//
//   node scripts/pin.mjs <repository>          its skills at the tip of its default branch
//   node scripts/pin.mjs <repository> <ref>    at a branch, a tag (v1.2.0) or a commit
//
// Each skill in its skills/ folder gets an entry pinned to that commit, with the version its openfilm.json says.
// Then run `node scripts/check.mjs` and open a pull request.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const INDEX = join(import.meta.dirname, '..', 'index.json');
const [input, ref = 'HEAD'] = process.argv.slice(2);
const fail = (/** @type {string} */ why) => { console.error(`pin: ${why}`); process.exit(1); };
if (!input) fail('name a repository: node scripts/pin.mjs https://github.com/<owner>/<name> [ref]');
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
  const skills = join(dir, 'skills');
  const names = existsSync(skills) ? readdirSync(skills).filter((n) => existsSync(join(skills, n, 'SKILL.md'))).sort() : [];
  if (!names.length) fail(`${repo} has no skills: each one is a folder in skills/ with a SKILL.md`);

  const index = JSON.parse(readFileSync(INDEX, 'utf8'));
  for (const name of names) {
    let version;
    try { version = JSON.parse(readFileSync(join(skills, name, 'openfilm.json'), 'utf8')).version; }
    catch { fail(`${name} has no openfilm.json to read its version from`); }
    const entry = { name, repo, path: `skills/${name}`, version, commit };
    const at = index.skills.findIndex((/** @type {{ name: string }} */ s) => s.name === name);
    if (at >= 0 && index.skills[at].repo !== repo) fail(`${name} is already listed, from ${index.skills[at].repo}`);
    if (at >= 0) index.skills[at] = entry;
    else index.skills.push(entry);
    console.log(`${name} ${version} at ${commit.slice(0, 7)}`);
  }
  index.skills.sort((/** @type {{ name: string }} */ a, /** @type {{ name: string }} */ b) => (a.name < b.name ? -1 : 1));
  writeFileSync(INDEX, `${JSON.stringify(index, null, 2)}\n`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
