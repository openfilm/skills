#!/usr/bin/env node
// Checks skills for OpenFilm, or says what is wrong and exits 1.
//
//   node scripts/check.mjs                 this index: every entry in index.json well formed, the skill it pins
//                                          fetched at its commit and checked, and the template
//   node scripts/check.mjs --no-fetch      the same, without fetching the pinned skills
//   node scripts/check.mjs <repository>    a skill's own repository: every skill in its skills/ folder
//
// A skill is whole when it has a SKILL.md named as its folder with a description; an openfilm.json with its version,
// its link back to its source, its kind and icon, and its title, summary and details in each language OpenFilm shows;
// every file the brief names and nothing it does not (what is in the folder gets used); a brief short enough to read
// every time.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const LANGUAGES = ['en', 'zh-CN', 'ja', 'ko', 'es'];
const KINDS = ['workflow', 'style'];
const ICONS = ['copy', 'scissors', 'monitor', 'shapes', 'pip', 'pen', 'film', 'music', 'presentation', 'layers'];
const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const VERSION = /^\d+\.\d+\.\d+$/;
const REPO = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/;
/* the agent reads the whole brief each time it is used */
const MAX_WORDS = 800;
/* a skill is a brief, a picture or two, and only the scripts and references it needs */
const MAX_BYTES = 2 * 1024 * 1024;

const problems = [];
const say = (/** @type {string} */ who, /** @type {string} */ what) => problems.push(`${who}: ${what}`);

/** The front matter's fields, one line each. @param {string} text */
function frontMatter(text) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!m) return null;
  /** @type {Record<string, string>} */
  const fields = {};
  for (const line of m[1].split('\n')) {
    const kv = /^([\w-]+):\s*(.*)$/.exec(line);
    if (kv) fields[kv[1]] = kv[2].trim();
  }
  return fields;
}

/** Every file in a folder, by its path inside it, dot files left out (git leaves them out too). @param {string} dir */
const files = (dir, base = '') => readdirSync(join(dir, base), { withFileTypes: true })
  .filter((e) => !e.name.startsWith('.'))
  .flatMap((e) => (e.isDirectory() ? files(dir, join(base, e.name)) : [join(base, e.name)]));

/**
 * One skill's folder. `repo`, when known, is the repository it comes from, which its openfilm.json links back to.
 * → its openfilm.json, or null when there is none to read.
 * @param {string} dir @param {string} name @param {{ repo?: string, who?: string }} [o]
 */
function checkSkill(dir, name, { repo, who = name } = {}) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) { say(who, `no folder at ${dir}`); return null; }
  if (!NAME.test(name) || name.length > 64) say(who, 'a name is lowercase letters, digits and hyphens, 64 at most');
  if (!existsSync(join(dir, 'SKILL.md'))) { say(who, 'no SKILL.md'); return null; }
  const brief = readFileSync(join(dir, 'SKILL.md'), 'utf8');
  const fields = frontMatter(brief);
  if (!fields) say(who, 'SKILL.md starts with front matter between --- lines');
  else {
    if (fields.name !== name) say(who, `SKILL.md names it ${fields.name}`);
    const chars = fields.description?.length ?? 0;
    if (chars < 80 || chars > 1024) say(who, `its description is ${chars} characters; 80 to 1024 say what it makes and when`);
  }
  const words = brief.split(/\s+/).filter(Boolean).length;
  if (words > MAX_WORDS) say(who, `SKILL.md is ${words} words; a brief is at most ${MAX_WORDS}`);
  const named = new Set([...brief.matchAll(/<this skill's folder>\/([\w./-]+)/g)].map((m) => m[1]));
  let shown;
  try { shown = JSON.parse(readFileSync(join(dir, 'openfilm.json'), 'utf8')); }
  catch (e) { say(who, `openfilm.json: ${e instanceof Error ? e.message : e}`); return null; }
  if (!VERSION.test(shown.version ?? '')) say(who, `its version is x.y.z, not ${shown.version}`);
  const source = repo && `${repo}/tree/main/skills/${name}`;
  if (source ? shown.repository !== source : !/^https:\/\//.test(shown.repository ?? '')) {
    say(who, `its repository is ${source ?? 'the https address of its folder'}`);
  }
  if (!KINDS.includes(shown.kind)) say(who, `its kind is ${KINDS.join(' or ')}`);
  if (!ICONS.includes(shown.icon)) say(who, `its icon is one of ${ICONS.join(', ')}`);
  if (shown.order !== undefined && !Number.isInteger(shown.order)) say(who, 'its order is a whole number');
  for (const field of ['title', 'summary', 'details']) {
    for (const lang of LANGUAGES) if (!shown[field]?.[lang]) say(who, `no ${field} in ${lang}`);
  }
  const own = new Set(['SKILL.md', 'openfilm.json', shown.cover, shown.preview].filter(Boolean));
  for (const file of [...own, ...named]) if (!existsSync(join(dir, file))) say(who, `${file} is named but not there`);
  for (const file of files(dir)) if (!own.has(file) && !named.has(file)) say(who, `${file} is in the folder but the brief never names it`);
  const bytes = files(dir).reduce((n, file) => n + statSync(join(dir, file)).size, 0);
  if (bytes > MAX_BYTES) say(who, `the folder is ${(bytes / 1024 / 1024).toFixed(1)} MB; a skill is 2 MB at most`);
  return shown;
}

/** The skills in a repository's skills/ folder. @param {string} dir @param {string} [repo] → how many */
function checkRepository(dir, repo) {
  const skills = join(dir, 'skills');
  const names = existsSync(skills) ? readdirSync(skills).filter((n) => !n.startsWith('.')).sort() : [];
  if (!names.length) say(dir, 'no skills: each one is a folder in skills/');
  for (const name of names) checkSkill(join(skills, name), name, { repo });
  return names.length;
}

/** A repository at one commit, in a new folder of its own. @param {string} repo @param {string} commit */
function fetchAt(repo, commit) {
  const dir = mkdtempSync(join(tmpdir(), 'openfilm-skill-'));
  const git = (/** @type {string[]} */ a) => execFileSync('git', ['-C', dir, ...a], { stdio: ['ignore', 'ignore', 'pipe'] });
  git(['init', '-q']);
  git(['fetch', '-q', '--depth', '1', repo, commit]);
  git(['checkout', '-q', 'FETCH_HEAD']);
  return dir;
}

/** index.json: every entry well formed and in order, and, unless `fetch` is false, the skill it pins. */
function checkIndex({ fetch = true } = {}) {
  let index;
  try { index = JSON.parse(readFileSync(join(ROOT, 'index.json'), 'utf8')); }
  catch (e) { say('index.json', e instanceof Error ? e.message : String(e)); return 0; }
  if (index.version !== 1) say('index.json', 'its version is 1');
  if (!Array.isArray(index.skills)) { say('index.json', 'skills is a list'); return 0; }
  const seen = new Set();
  /** @type {Map<string, string>} fetched folders, by repository and commit */
  const fetched = new Map();
  let previous = '';
  try {
    for (const entry of index.skills) {
      const { name, repo, path, version, commit } = entry ?? {};
      const who = `index.json ${name ?? '?'}`;
      const extra = Object.keys(entry ?? {}).filter((k) => !['name', 'repo', 'path', 'version', 'commit'].includes(k));
      if (extra.length) say(who, `${extra.join(', ')} is not a field; the skill's openfilm.json says the rest`);
      if (typeof name !== 'string' || !NAME.test(name)) { say(who, 'its name is lowercase letters, digits and hyphens'); continue; }
      if (seen.has(name)) say(who, 'listed twice');
      seen.add(name);
      if (name < previous) say(who, `out of order: the list goes by name, so it comes before ${previous}`);
      previous = name;
      const before = problems.length;
      if (typeof repo !== 'string' || !REPO.test(repo)) say(who, 'its repo is https://github.com/<owner>/<name>');
      if (path !== `skills/${name}`) say(who, `its path is skills/${name}`);
      if (!VERSION.test(version ?? '')) say(who, `its version is x.y.z, not ${version}`);
      if (!/^[0-9a-f]{40}$/.test(commit ?? '')) say(who, 'its commit is the whole 40-character id');
      if (!fetch || problems.length > before) continue;
      const key = `${repo} ${commit}`;
      if (!fetched.has(key)) {
        try { fetched.set(key, fetchAt(repo, commit)); }
        catch (e) { say(who, `cannot fetch ${repo} at ${commit.slice(0, 7)}: ${String(/** @type {any} */ (e).stderr ?? e).trim()}`); continue; }
      }
      const shown = checkSkill(join(/** @type {string} */ (fetched.get(key)), path), name, { repo, who });
      if (shown && shown.version !== version) say(who, `its openfilm.json at ${commit.slice(0, 7)} says ${shown.version}, not ${version}`);
    }
  } finally {
    for (const dir of fetched.values()) rmSync(dir, { recursive: true, force: true });
  }
  return index.skills.length;
}

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith('--'));
let summary;
if (target) {
  const dir = resolve(target);
  const repo = process.env.GITHUB_REPOSITORY ? `${process.env.GITHUB_SERVER_URL ?? 'https://github.com'}/${process.env.GITHUB_REPOSITORY}` : undefined;
  const n = checkRepository(dir, repo);
  summary = `${n} ${n === 1 ? 'skill' : 'skills'}, each whole`;
} else {
  const n = checkIndex({ fetch: !args.includes('--no-fetch') });
  checkRepository(join(ROOT, 'template'));
  summary = `index.json lists ${n} ${n === 1 ? 'skill' : 'skills'}, each whole; the template is whole`;
}
if (problems.length) {
  for (const p of problems) console.error(p);
  process.exit(1);
}
console.log(summary);
