// node --test scripts/*.test.mjs
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { build, buildIndex, indexText } from './build-index.mjs';

const commit = 'a'.repeat(40);
const entry = (/** @type {string} */ owner, /** @type {string} */ name, extra = {}) => ({ name, repo: `https://github.com/${owner}/skill-${name}`, path: `skills/${name}`, version: '0.1.0', commit, ...extra });

/** A checkout with these listings, by file. @param {Record<string, unknown>} files */
function checkout(files, revoked = []) {
  const root = mkdtempSync(join(tmpdir(), 'openfilm-build-'));
  for (const [file, value] of Object.entries(files)) {
    mkdirSync(join(root, file, '..'), { recursive: true });
    writeFileSync(join(root, file), JSON.stringify(value));
  }
  writeFileSync(join(root, 'revoked.json'), JSON.stringify(revoked));
  return root;
}

test('the index is OpenFilm\'s own first, then by full name, each with its kind', () => {
  const index = buildIndex([
    { kind: 'skill', ...entry('zed', 'alpha') },
    { kind: 'workbench', ...entry('Bob', 'zoo') },
    { kind: 'skill', ...entry('openfilm', 'replicate') },
    { kind: 'connector', ...entry('bob', 'alpha', { files: [{ path: 'SKILL.md', size: 1, sha256: 'b'.repeat(64) }] }) },
    { kind: 'skill', ...entry('openfilm', 'keynote') },
  ], [{ uid: 'someone/bad', reason: 'malware' }]);
  assert.equal(index.version, 1);
  assert.deepEqual(index.skills.map((s) => `${s.repo.split('/')[3]}/${s.name}`), ['openfilm/keynote', 'openfilm/replicate', 'bob/alpha', 'Bob/zoo', 'zed/alpha']);
  assert.deepEqual(Object.keys(index.skills[2]), ['name', 'kind', 'repo', 'path', 'version', 'commit', 'files']);
  assert.deepEqual(Object.keys(index.skills[0]), ['name', 'kind', 'repo', 'path', 'version', 'commit']);
  assert.deepEqual(index.revoked, [{ uid: 'someone/bad', reason: 'malware' }]);
  assert.match(indexText(index), /^\{\n {2}"version": 1,\n {2}"skills": \[\n/);
  assert.ok(indexText(index).endsWith('}\n'));
});

test('a checkout is built from registry/ and revoked.json, and never with a broken listing', (t) => {
  const root = checkout({
    'registry/skill/someone/my-skill.json': entry('someone', 'my-skill'),
    'registry/skill/openfilm/replicate.json': entry('openfilm', 'replicate'),
  });
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const index = build({ root });
  assert.deepEqual(index.skills.map((s) => s.name), ['replicate', 'my-skill']);
  assert.deepEqual(index.revoked, []);
  writeFileSync(join(root, 'registry', 'skill', 'someone', 'my-skill.json'), JSON.stringify(entry('other', 'my-skill')));
  assert.throws(() => build({ root }), /listed under other/);
  writeFileSync(join(root, 'registry', 'skill', 'someone', 'my-skill.json'), JSON.stringify(entry('someone', 'my-skill')));
  writeFileSync(join(root, 'revoked.json'), JSON.stringify([{ uid: 'someone/my-skill', reason: 'malware' }]));
  assert.throws(() => build({ root }), /still listed/);
});

test('a revision is built from git as data, all of it or only the files named', (t) => {
  const root = checkout({ 'registry/skill/openfilm/replicate.json': entry('openfilm', 'replicate') });
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (/** @type {string[]} */ a) => execFileSync('git', ['-C', root, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
  git(['init', '-q']);
  git(['add', '-A']);
  git(['commit', '-qm', 'one']);
  mkdirSync(join(root, 'registry', 'workbench', 'someone'), { recursive: true });
  writeFileSync(join(root, 'registry', 'workbench', 'someone', 'board.json'), JSON.stringify(entry('someone', 'board')));
  git(['add', '-A']);
  git(['commit', '-qm', 'two']);
  // what is on disk is not what is read
  rmSync(join(root, 'registry'), { recursive: true, force: true });
  assert.deepEqual(build({ root, at: 'HEAD' }).skills.map((s) => `${s.kind} ${s.name}`), ['skill replicate', 'workbench board']);
  assert.deepEqual(build({ root, at: 'HEAD~1' }).skills.map((s) => s.name), ['replicate']);
  assert.deepEqual(build({ root, at: 'HEAD', only: new Set(['registry/workbench/someone/board.json']) }).skills.map((s) => s.name), ['board']);
  assert.throws(() => build({ root, at: '--output=x' }), /not a revision/);
  // a revision before registry/ lists nothing
  const empty = mkdtempSync(join(tmpdir(), 'openfilm-build-'));
  t.after(() => rmSync(empty, { recursive: true, force: true }));
  execFileSync('git', ['-C', empty, 'init', '-q']);
  execFileSync('git', ['-C', empty, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'zero']);
  assert.deepEqual(build({ root: empty, at: 'HEAD' }), { version: 1, skills: [], revoked: [] });
});
