#!/usr/bin/env node
// Checks skills for OpenFilm, or says what is wrong and exits 1.
//
//   node scripts/check.mjs                 this repository: every listing in registry/ well formed, the skill it pins
//                                          fetched at its commit and checked; revoked.json; index.json the build of
//                                          both (scripts/build-index.mjs); kinds.json and the template
//   node scripts/check.mjs --no-fetch      the same, without fetching the pinned skills
//   node scripts/check.mjs --no-index      the same, but index.json may not be rebuilt yet: a pull request adds only
//                                          its listing's file, and index.json is rebuilt on main once it is merged
//   node scripts/check.mjs <repository>    a skill's own repository: every skill in its skills/ folder
//
// A listing is one file, registry/<kind>/<owner>/<name>.json: { name, repo, path, version, commit, files? }. Its kind
// is one of kinds.json's code track; its owner is its repository's owner, lowercased, so nobody lists under someone
// else's name; `files`, when there, is every file of the skill's folder with its size and sha256, as OpenFilm reads it.
//
// revoked.json is what OpenFilm has withdrawn, which every OpenFilm disables wherever it is installed. Each entry names
// a `uid` (`owner/name`), a `reason`, and optionally the `commits` or folder `digests` it covers (none: every version),
// a `note`, an `advisory` (https) and a `date` (YYYY-MM-DD). See POLICIES/takedown-and-appeals.md.
//
// A skill is whole when it has a SKILL.md named as its folder with a description; an openfilm.json with its version,
// its link back to its source, its kind and icon, and its title, summary and details in each language OpenFilm shows;
// every file the brief names and nothing it does not (what is in the folder gets used); a brief short enough to read
// every time.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(import.meta.dirname, '..');
const LANGUAGES = ['en', 'zh-CN', 'ja', 'ko', 'es'];
const KINDS = ['workflow', 'style'];
const PLATFORMS = ['macos', 'windows', 'linux'];
const ICONS = ['copy', 'scissors', 'monitor', 'shapes', 'pip', 'pen', 'film', 'music', 'presentation', 'layers'];
const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const VERSION = /^\d+\.\d+\.\d+$/;
const REPO = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/;
/* as OpenFilm reads a withdrawal: whose it is and its name */
const UID = /^[a-z0-9][a-z0-9-]{0,63}\/[a-z0-9][a-z0-9-]{0,63}$/;
/* a listing's file: its kind, its owner and its name */
export const LISTING = /^registry\/([a-z0-9-]+)\/([a-z0-9][a-z0-9-]{0,63})\/([a-z0-9][a-z0-9-]{0,63})\.json$/;
const LISTING_FIELDS = ['name', 'repo', 'path', 'version', 'commit', 'files'];
/* a listing is a few lines; its file manifest a few hundred */
const MAX_LISTING_BYTES = 128 * 1024;
/* as OpenFilm reads a file manifest (studio/server/skill-catalog.mjs): files, and bytes in all */
const MAX_MANIFEST_FILES = 512;
const MAX_MANIFEST_BYTES = 20 * 1024 * 1024;
const REASONS = ['malware', 'impersonation', 'rights', 'broken', 'policy'];
const REVOKED_FIELDS = ['uid', 'commits', 'digests', 'reason', 'note', 'advisory', 'date'];
/* the agent reads the whole brief each time it is used */
const MAX_WORDS = 800;
/* a skill is a brief, a picture or two, and only the scripts and references it needs */
const MAX_BYTES = 2 * 1024 * 1024;

export const problems = [];
const say = (/** @type {string} */ who, /** @type {string} */ what) => problems.push(`${who}: ${what}`);

/** The front matter's fields, one line each. @param {string} text */
function frontMatter(text) {
  // A Windows checkout may have CRLF line ends
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text.replace(/\r\n/g, '\n'));
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
  .flatMap((e) => (e.isDirectory() ? files(dir, posix.join(base, e.name)) : [posix.join(base, e.name)]));

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
  if (shown.needs !== undefined) {
    const langs = shown.needs && typeof shown.needs === 'object' && !Array.isArray(shown.needs) ? Object.entries(shown.needs) : null;
    if (!langs || !langs.length || langs.some(([lang, text]) => !LANGUAGES.includes(lang) || typeof text !== 'string' || !text.trim())) {
      say(who, `its needs say, by language (${LANGUAGES.join(', ')}), what it needs beyond OpenFilm`);
    }
  }
  if (shown.platforms !== undefined && (!Array.isArray(shown.platforms) || !shown.platforms.length || shown.platforms.some((p) => !PLATFORMS.includes(p)))) {
    say(who, `its platforms are some of ${PLATFORMS.join(', ')}`);
  }
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

/**
 * A repository at one commit, in a new folder of its own: its files as data, nothing in it run. The caller removes it.
 * @param {string} repo @param {string} commit
 */
export function fetchAt(repo, commit) {
  const dir = mkdtempSync(join(tmpdir(), 'openfilm-skill-'));
  const git = (/** @type {string[]} */ a) => execFileSync('git', ['-C', dir, ...a], { stdio: ['ignore', 'ignore', 'pipe'] });
  git(['init', '-q']);
  /* files as committed: no line-end conversion, whatever core.autocrlf or the repository's .gitattributes say (Git for Windows sets core.autocrlf) */
  mkdirSync(join(dir, '.git', 'info'), { recursive: true });
  writeFileSync(join(dir, '.git', 'info', 'attributes'), '* -text\n');
  git(['fetch', '-q', '--depth', '1', repo, commit]);
  git(['checkout', '-q', 'FETCH_HEAD']);
  return dir;
}

/**
 * A listed skill's full name, as OpenFilm gives it: its repository's owner, lowercased, and its name (SPEC.md).
 * @param {string} repo @param {string} name
 */
export function uidOf(repo, name) {
  const owner = repo.split('/')[3].toLowerCase();
  return `${owner === 'local' || owner === 'project' ? `github-${owner}` : owner}/${name}`;
}

/**
 * revoked.json: each entry well formed, and nothing it withdraws still listed.
 * @param {unknown} revoked @param {{ name?: string, repo?: string, commit?: string }[]} skills
 */
export function checkRevoked(revoked, skills) {
  if (!Array.isArray(revoked)) { say('revoked.json', 'it is a list'); return; }
  const listed = new Map(skills.filter((s) => typeof s?.repo === 'string' && REPO.test(s.repo) && typeof s.name === 'string')
    .map((s) => [uidOf(/** @type {string} */ (s.repo), /** @type {string} */ (s.name)), s.commit]));
  revoked.forEach((entry, i) => {
    const who = `revoked.json [${i}] ${typeof entry?.uid === 'string' ? entry.uid : '?'}`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) { say(who, 'an entry is an object'); return; }
    const extra = Object.keys(entry).filter((k) => !REVOKED_FIELDS.includes(k));
    if (extra.length) say(who, `${extra.join(', ')} is not a field; an entry has ${REVOKED_FIELDS.join(', ')}`);
    if (typeof entry.uid !== 'string' || !UID.test(entry.uid)) say(who, 'its uid is <owner>/<name>, lowercase');
    if (!REASONS.includes(entry.reason)) say(who, `its reason is one of ${REASONS.join(', ')}`);
    for (const [field, pattern, what] of /** @type {const} */ ([['commits', /^[0-9a-f]{40}$/, 'whole 40-character commit ids'], ['digests', /^[0-9a-f]{64}$/, '64-character sha256 digests of the folder']])) {
      if (entry[field] === undefined) continue;
      if (!Array.isArray(entry[field]) || !entry[field].length || entry[field].some((v) => typeof v !== 'string' || !pattern.test(v))) say(who, `its ${field} are ${what}`);
    }
    if (entry.note !== undefined && (typeof entry.note !== 'string' || !entry.note.trim() || entry.note.length > 500)) say(who, 'its note is a sentence, 500 characters at most');
    if (entry.advisory !== undefined && (typeof entry.advisory !== 'string' || !/^https:\/\/\S{4,300}$/.test(entry.advisory))) say(who, 'its advisory is an https address');
    if (entry.date !== undefined && (typeof entry.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)
      || Number.isNaN(Date.parse(`${entry.date}T00:00:00Z`)) || new Date(`${entry.date}T00:00:00Z`).toISOString().slice(0, 10) !== entry.date)) {
      say(who, 'its date is YYYY-MM-DD');
    }
    const commit = listed.get(entry.uid);
    if (commit !== undefined && !entry.digests && (!entry.commits || entry.commits.includes(commit))) {
      say(who, `still listed at ${String(commit).slice(0, 7)}: a withdrawn version leaves registry/`);
    }
  });
}

/** kinds.json: each kind named in every language, on a track, landing in a place, at a tier it describes. */
function checkKinds() {
  let kinds;
  try { kinds = JSON.parse(readFileSync(join(ROOT, 'kinds.json'), 'utf8')); }
  catch (e) { say('kinds.json', e instanceof Error ? e.message : String(e)); return; }
  for (const [id, track] of Object.entries(kinds?.tracks ?? {})) {
    const home = track?.home;
    if (typeof track?.about !== 'string' || !track.about) say(`kinds.json track ${id}`, 'its about says what the track is');
    if (typeof home !== 'string' || !/^[a-z]+\/$/.test(home) || !existsSync(join(ROOT, home))) say(`kinds.json track ${id}`, 'its home is a folder of this repository, as assets/');
  }
  const seen = new Set();
  for (const kind of Array.isArray(kinds?.kinds) ? kinds.kinds : []) {
    const who = `kinds.json ${kind?.id ?? '?'}`;
    if (typeof kind?.id !== 'string' || !NAME.test(kind.id) || seen.has(kind.id)) say(who, 'its id is a name of its own');
    seen.add(kind?.id);
    for (const lang of LANGUAGES) if (typeof kind?.names?.[lang] !== 'string' || !kind.names[lang]) say(who, `no name in ${lang}`);
    for (const [field, list] of [['track', 'tracks'], ['lands', 'places'], ['tier', 'tiers']]) {
      if (!Object.hasOwn(kinds[list] ?? {}, kind?.[field])) say(who, `its ${field} is one of ${list}: ${Object.keys(kinds[list] ?? {}).join(', ')}`);
    }
  }
  if (!seen.size) say('kinds.json', 'kinds is a list');
}

/** The kinds listed in registry/: those on kinds.json's code track. @param {string} [root] */
export function listedKinds(root = ROOT) {
  try {
    const kinds = JSON.parse(readFileSync(join(root, 'kinds.json'), 'utf8'));
    return (Array.isArray(kinds?.kinds) ? kinds.kinds : []).filter((/** @type {any} */ k) => k?.track === 'code').map((/** @type {any} */ k) => String(k.id));
  } catch { return []; }
}

/**
 * A file manifest, as OpenFilm reads one: every file of the folder by its path, with its size and sha256; SKILL.md
 * among them. @param {unknown} files @param {string} who
 */
function checkManifest(files, who) {
  if (!Array.isArray(files) || !files.length || files.length > MAX_MANIFEST_FILES) { say(who, `its files are a list of 1 to ${MAX_MANIFEST_FILES}`); return; }
  const seen = new Set();
  let total = 0;
  for (const file of files) {
    const extra = file && typeof file === 'object' ? Object.keys(file).filter((k) => !['path', 'size', 'sha256'].includes(k)) : [];
    if (!file || typeof file !== 'object' || extra.length || typeof file.path !== 'string' || file.path.includes('\\')
      || file.path.split('/').some((/** @type {string} */ p) => !p || p === '.' || p === '..') || seen.has(file.path)
      || !Number.isSafeInteger(file.size) || file.size < 0 || typeof file.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(file.sha256)) {
      say(who, `its files are { path, size, sha256 }, each path once and inside the folder, not ${JSON.stringify(file)?.slice(0, 120)}`);
      return;
    }
    seen.add(file.path);
    total += file.size;
  }
  if (!seen.has('SKILL.md')) say(who, 'its files have SKILL.md');
  if (total > MAX_MANIFEST_BYTES) say(who, `its files are ${(total / 1024 / 1024).toFixed(1)} MB; OpenFilm takes 20 MB at most`);
}

/**
 * One listing: `file` its path in this repository, `text` what it holds. → its entry in index.json, its kind added, or
 * null when it is not one (what is wrong is said).
 * @param {string} file @param {string} text @param {string[]} [kinds] the kinds listed here
 * @returns {{ name: string, kind: string, repo: string, path: string, version: string, commit: string, files?: { path: string, size: number, sha256: string }[] } | null}
 */
export function checkListing(file, text, kinds = listedKinds()) {
  const before = problems.length;
  const at = LISTING.exec(file);
  if (!at) { say(file, 'a listing is registry/<kind>/<owner>/<name>.json, in lowercase letters, digits and hyphens'); return null; }
  const [, kind, owner, fileName] = at;
  if (!kinds.includes(kind)) say(file, `its kind is one of ${kinds.join(', ')}, not ${kind}`);
  let entry;
  try { entry = JSON.parse(text); }
  catch (e) { say(file, e instanceof Error ? e.message : String(e)); return null; }
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) { say(file, 'a listing is an object'); return null; }
  const { name, repo, path, version, commit, files } = entry;
  const extra = Object.keys(entry).filter((k) => !LISTING_FIELDS.includes(k));
  if (extra.length) say(file, `${extra.join(', ')} is not a field; a listing has ${LISTING_FIELDS.join(', ')}, and the skill's openfilm.json says the rest`);
  if (typeof name !== 'string' || !NAME.test(name) || name.length > 64) say(file, 'its name is lowercase letters, digits and hyphens');
  else if (name !== fileName) say(file, `its name is ${name}, so its file is registry/${kind}/${owner}/${name}.json`);
  if (typeof repo !== 'string' || !REPO.test(repo)) say(file, 'its repo is https://github.com/<owner>/<name>');
  else if (typeof name === 'string') {
    const whose = uidOf(repo, name).split('/')[0];
    if (whose !== owner) say(file, `its repository is ${repo.split('/')[3]}'s, so it is listed under ${whose}: registry/${kind}/${whose}/${fileName}.json`);
  }
  if (path !== `skills/${name}`) say(file, `its path is skills/${name}`);
  if (typeof version !== 'string' || !VERSION.test(version)) say(file, `its version is x.y.z, not ${version}`);
  if (typeof commit !== 'string' || !/^[0-9a-f]{40}$/.test(commit)) say(file, 'its commit is the whole 40-character id');
  if (files !== undefined) checkManifest(files, file);
  if (problems.length > before) return null;
  return { name, kind, repo, path, version, commit, ...(files ? { files: files.map((/** @type {any} */ f) => ({ path: f.path, size: f.size, sha256: f.sha256 })) } : {}) };
}

/**
 * Every listing in a checkout's registry/. → the entries of those that are well formed, and how many files there are.
 * @param {string} [root] @param {string[]} [kinds]
 */
export function readRegistry(root = ROOT, kinds = listedKinds()) {
  const dir = join(root, 'registry');
  /** @type {NonNullable<ReturnType<typeof checkListing>>[]} */
  const entries = [];
  let count = 0;
  /** @param {string} base */
  const walk = (base) => {
    for (const e of readdirSync(join(root, base), { withFileTypes: true })) {
      const file = posix.join(base, e.name);
      if (e.isDirectory()) { walk(file); continue; }
      count += 1;
      if (!e.isFile()) { say(file, 'a listing is a file'); continue; }
      const size = statSync(join(root, file)).size;
      if (size > MAX_LISTING_BYTES) { say(file, `${size} bytes; a listing is ${MAX_LISTING_BYTES / 1024} KB at most`); continue; }
      const entry = checkListing(file, readFileSync(join(root, file), 'utf8'), kinds);
      if (entry) entries.push(entry);
    }
  };
  if (existsSync(dir)) walk('registry');
  return { entries, count };
}

/**
 * The listings of one revision, read from git as data: nothing of it is checked out or run. `only` keeps the files it
 * names (those a pull request changes). A revision before registry/ has none, and no revoked.json: an empty list.
 * @param {string} rev @param {{ root?: string, only?: Set<string>, kinds?: string[] }} [o]
 */
export function readRegistryAt(rev, { root = ROOT, only, kinds = listedKinds() } = {}) {
  if (!/^[\w^~./-]+$/.test(rev) || rev.startsWith('-')) throw new Error(`${rev} is not a revision`);
  const git = (/** @type {string[]} */ a) => execFileSync('git', ['-C', root, ...a], { maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  /** @type {NonNullable<ReturnType<typeof checkListing>>[]} */
  const entries = [];
  let count = 0;
  for (const line of git(['ls-tree', '-r', '-z', '--full-tree', rev, '--', 'registry']).toString('utf8').split('\0')) {
    const m = /^(\d+) (\w+) ([0-9a-f]+)\t(.+)$/s.exec(line);
    if (!m) continue;
    const [, mode, type, object, file] = m;
    if (only && !only.has(file)) continue;
    count += 1;
    if (type !== 'blob' || !['100644', '100755'].includes(mode)) { say(file, 'a listing is a file'); continue; }
    const size = Number(git(['cat-file', '-s', object]).toString().trim());
    if (size > MAX_LISTING_BYTES) { say(file, `${size} bytes; a listing is ${MAX_LISTING_BYTES / 1024} KB at most`); continue; }
    const entry = checkListing(file, git(['cat-file', 'blob', object]).toString('utf8'), kinds);
    if (entry) entries.push(entry);
  }
  let revoked = [];
  try { revoked = JSON.parse(git(['show', `${rev}:revoked.json`]).toString('utf8')); }
  catch (e) { if (!/does not exist|exists on disk, but not in/.test(String(/** @type {any} */ (e).stderr ?? ''))) throw e; }
  return { entries, count, revoked };
}

/** No two listings with one full name, whatever their kinds. @param {{ name: string, kind: string, repo: string }[]} entries */
export function checkUnique(entries) {
  const seen = new Map();
  for (const e of entries) {
    const uid = uidOf(e.repo, e.name);
    if (seen.has(uid)) say(`registry/${e.kind}/${uid}.json`, `${uid} is listed twice, also as registry/${seen.get(uid)}/${uid}.json`);
    else seen.set(uid, e.kind);
  }
}

/** revoked.json in a checkout, or null when it cannot be read. @param {string} [root] */
export function readRevoked(root = ROOT) {
  try { return JSON.parse(readFileSync(join(root, 'revoked.json'), 'utf8')); }
  catch (e) { say('revoked.json', e instanceof Error ? e.message : String(e)); return null; }
}

/**
 * A listed skill fetched at its commit and checked: as its repository would, its version that of its openfilm.json,
 * and its file manifest, when it has one, the folder's every file.
 * @param {NonNullable<ReturnType<typeof checkListing>>} entry @param {Map<string, string>} fetched folders by repository and commit
 */
function checkFetched(entry, fetched) {
  const { name, kind, repo, path, version, commit, files: manifest } = entry;
  const who = `registry/${kind}/${uidOf(repo, name)}.json`;
  const key = `${repo} ${commit}`;
  if (!fetched.has(key)) {
    try { fetched.set(key, fetchAt(repo, commit)); }
    catch (e) { say(who, `cannot fetch ${repo} at ${commit.slice(0, 7)}: ${String(/** @type {any} */ (e).stderr ?? e).trim()}`); return; }
  }
  const dir = join(/** @type {string} */ (fetched.get(key)), path);
  const shown = checkSkill(dir, name, { repo, who });
  if (shown && shown.version !== version) say(who, `its openfilm.json at ${commit.slice(0, 7)} says ${shown.version}, not ${version}`);
  if (!manifest || !shown) return;
  const there = new Set(files(dir));
  for (const file of manifest) {
    const at = join(dir, ...file.path.split('/'));
    if (!there.has(file.path)) { say(who, `its files name ${file.path}, which is not in the folder at ${commit.slice(0, 7)}`); continue; }
    const bytes = readFileSync(at);
    if (bytes.length !== file.size || createHash('sha256').update(bytes).digest('hex') !== file.sha256) say(who, `${file.path} at ${commit.slice(0, 7)} is not the size and sha256 its files say`);
  }
  for (const file of there) if (!manifest.some((f) => f.path === file)) say(who, `${file} is in the folder but not in its files`);
}

/**
 * The index of these listings and withdrawals: OpenFilm's own first, then by full name, each in index.json's field
 * order. @param {{ name: string, kind: string, repo: string, path: string, version: string, commit: string, files?: unknown[] }[]} entries
 * @param {unknown[]} revoked
 */
export function buildIndex(entries, revoked) {
  const key = (/** @type {typeof entries[number]} */ e) => {
    const uid = uidOf(e.repo, e.name);
    return `${uid.startsWith('openfilm/') ? 0 : 1} ${uid}`;
  };
  const skills = [...entries].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0))
    .map(({ name, kind, repo, path, version, commit, files }) => ({ name, kind, repo, path, version, commit, ...(files ? { files } : {}) }));
  return { version: 1, skills, revoked };
}

/** index.json's text. @param {unknown} index */
export const indexText = (index) => `${JSON.stringify(index, null, 2)}\n`;

/**
 * registry/ and revoked.json: every listing well formed and, unless `fetch` is false, the skill it pins; and, unless
 * `index` is false, index.json their build. → how many are listed.
 * @param {{ root?: string, fetch?: boolean, index?: boolean }} [o]
 */
export async function checkRegistry({ root = ROOT, fetch = true, index = true } = {}) {
  const { entries } = readRegistry(root);
  checkUnique(entries);
  const revoked = readRevoked(root);
  if (revoked !== null) checkRevoked(revoked, entries);
  /** @type {Map<string, string>} */
  const fetched = new Map();
  try {
    if (fetch) for (const entry of entries) checkFetched(entry, fetched);
  } finally {
    for (const dir of fetched.values()) rmSync(dir, { recursive: true, force: true });
  }
  if (index && revoked !== null) {
    let now = '';
    try { now = readFileSync(join(root, 'index.json'), 'utf8'); } catch { /* none: said below */ }
    if (now !== indexText(buildIndex(entries, revoked))) say('index.json', 'it is not the build of registry/ and revoked.json: run node scripts/build-index.mjs');
  }
  return entries.length;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const target = args.find((a) => !a.startsWith('--'));
  let summary;
  if (target) {
    const dir = resolve(target);
    const repo = process.env.GITHUB_REPOSITORY ? `${process.env.GITHUB_SERVER_URL ?? 'https://github.com'}/${process.env.GITHUB_REPOSITORY}` : undefined;
    const n = checkRepository(dir, repo);
    summary = `${n} ${n === 1 ? 'skill' : 'skills'}, each whole`;
  } else {
    const index = !args.includes('--no-index');
    const n = await checkRegistry({ fetch: !args.includes('--no-fetch'), index });
    checkRepository(join(ROOT, 'template'));
    checkKinds();
    summary = `registry/ lists ${n}, each whole; revoked.json${index ? ', index.json (their build)' : ''}, the template and kinds.json are whole`;
  }
  if (problems.length) {
    for (const p of problems) console.error(p);
    process.exit(1);
  }
  console.log(summary);
}
