#!/usr/bin/env node
// Every skill here is whole, or this says what is missing and exits 1: a SKILL.md named as its folder with a
// description; an openfilm.json with its version, its link back here, its kind, order and icon, a cover that is there,
// and its title, summary and details in each language OpenFilm shows; every file the brief names and nothing it does
// not (what is in the folder gets used); a brief short enough to read every time; a place in the README.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SKILLS = join(ROOT, 'skills');
const LANGUAGES = ['en', 'zh-CN', 'ja', 'ko', 'es'];
const REPOSITORY = 'https://github.com/openfilm/skills/tree/main/skills/';
const KINDS = ['workflow', 'style'];
const ICONS = ['copy', 'scissors', 'monitor', 'shapes', 'pip', 'pen', 'film', 'music', 'presentation', 'layers'];
/* the agent reads the whole brief each time it is used */
const MAX_WORDS = 800;
/* a skill is a brief and a picture or two */
const MAX_BYTES = 2 * 1024 * 1024;

const problems = [];
const say = (name, what) => problems.push(`${name}: ${what}`);

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

const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
const names = readdirSync(SKILLS).filter((n) => !n.startsWith('.')).sort();
const orders = new Map();
for (const name of names) {
  const dir = join(SKILLS, name);
  if (!statSync(dir).isDirectory()) { say(name, 'only folders belong in skills/'); continue; }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name) || name.length > 64) say(name, 'a name is lowercase letters, digits and hyphens, 64 at most');
  if (!readme.includes(`(skills/${name})`)) say(name, 'not in the README');
  if (!existsSync(join(dir, 'SKILL.md'))) { say(name, 'no SKILL.md'); continue; }
  const brief = readFileSync(join(dir, 'SKILL.md'), 'utf8');
  const fields = frontMatter(brief);
  if (!fields) say(name, 'SKILL.md starts with front matter between --- lines');
  else {
    if (fields.name !== name) say(name, `SKILL.md names it ${fields.name}`);
    const words = fields.description?.length ?? 0;
    if (words < 80 || words > 1024) say(name, `its description is ${words} characters; 80 to 1024 say what it makes and when`);
  }
  const words = brief.split(/\s+/).filter(Boolean).length;
  if (words > MAX_WORDS) say(name, `SKILL.md is ${words} words; a brief is at most ${MAX_WORDS}`);
  const named = new Set([...brief.matchAll(/<this skill's folder>\/([\w./-]+)/g)].map((m) => m[1]));
  let shown;
  try { shown = JSON.parse(readFileSync(join(dir, 'openfilm.json'), 'utf8')); }
  catch (e) { say(name, `openfilm.json: ${e instanceof Error ? e.message : e}`); continue; }
  if (!/^\d+\.\d+\.\d+$/.test(shown.version ?? '')) say(name, `its version is x.y.z, not ${shown.version}`);
  if (shown.repository !== REPOSITORY + name) say(name, `its repository is ${REPOSITORY + name}`);
  if (!KINDS.includes(shown.kind)) say(name, `its kind is ${KINDS.join(' or ')}`);
  if (!ICONS.includes(shown.icon)) say(name, `its icon is one of ${ICONS.join(', ')}`);
  if (!Number.isInteger(shown.order)) say(name, 'its order is a whole number');
  else if (orders.has(shown.order)) say(name, `its order ${shown.order} is ${orders.get(shown.order)}'s too`);
  else orders.set(shown.order, name);
  for (const field of ['title', 'summary', 'details']) {
    for (const lang of LANGUAGES) if (!shown[field]?.[lang]) say(name, `no ${field} in ${lang}`);
  }
  const own = new Set(['SKILL.md', 'openfilm.json', shown.cover, shown.preview].filter(Boolean));
  for (const file of [...own, ...named]) if (!existsSync(join(dir, file))) say(name, `${file} is named but not there`);
  for (const file of files(dir)) if (!own.has(file) && !named.has(file)) say(name, `${file} is in the folder but the brief never names it`);
  const bytes = files(dir).reduce((n, file) => n + statSync(join(dir, file)).size, 0);
  if (bytes > MAX_BYTES) say(name, `the folder is ${(bytes / 1024 / 1024).toFixed(1)} MB; a skill is 2 MB at most`);
}
if (problems.length) {
  for (const p of problems) console.error(p);
  process.exit(1);
}
console.log(`${names.length} skills, each whole`);
