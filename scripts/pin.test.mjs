// node --test scripts/*.test.mjs
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { pinSkills } from './pin.mjs';

const commit = 'f'.repeat(40);

/** A checkout of this repository with no listings, and a skill repository's checkout. */
function setup(/** @type {import('node:test').TestContext} */ t) {
  const root = mkdtempSync(join(tmpdir(), 'openfilm-pin-root-'));
  const dir = mkdtempSync(join(tmpdir(), 'openfilm-pin-repo-'));
  t.after(() => { rmSync(root, { recursive: true, force: true }); rmSync(dir, { recursive: true, force: true }); });
  copyFileSync(join(import.meta.dirname, '..', 'kinds.json'), join(root, 'kinds.json'));
  writeFileSync(join(root, 'revoked.json'), '[]\n');
  for (const [name, version] of [['my-skill', '0.2.0'], ['other', '1.0.0']]) {
    mkdirSync(join(dir, 'skills', name), { recursive: true });
    writeFileSync(join(dir, 'skills', name, 'SKILL.md'), `---\nname: ${name}\n---\n`);
    writeFileSync(join(dir, 'skills', name, 'openfilm.json'), JSON.stringify({ version }));
  }
  return { root, dir };
}

test('pin writes each skill\'s listing in registry/ and rebuilds index.json', (t) => {
  const { root, dir } = setup(t);
  const repo = 'https://github.com/Someone/skills';
  const pinned = pinSkills({ dir, repo, commit, root });
  assert.deepEqual(pinned.map((p) => p.file), ['registry/skill/someone/my-skill.json', 'registry/skill/someone/other.json']);
  assert.deepEqual(JSON.parse(readFileSync(join(root, 'registry/skill/someone/my-skill.json'), 'utf8')),
    { name: 'my-skill', repo, path: 'skills/my-skill', version: '0.2.0', commit });
  const index = JSON.parse(readFileSync(join(root, 'index.json'), 'utf8'));
  assert.deepEqual(index.skills.map((/** @type {any} */ s) => `${s.kind} ${s.name} ${s.version}`), ['skill my-skill 0.2.0', 'skill other 1.0.0']);
  assert.deepEqual(index.revoked, []);

  // pinned again at a newer commit, the same file moves
  writeFileSync(join(dir, 'skills', 'my-skill', 'openfilm.json'), JSON.stringify({ version: '0.3.0' }));
  pinSkills({ dir, repo, commit: 'e'.repeat(40), root });
  assert.equal(JSON.parse(readFileSync(join(root, 'registry/skill/someone/my-skill.json'), 'utf8')).commit, 'e'.repeat(40));
  assert.equal(JSON.parse(readFileSync(join(root, 'index.json'), 'utf8')).skills[0].version, '0.3.0');
});

test('pin lists another kind, and never over someone else\'s listing', (t) => {
  const { root, dir } = setup(t);
  pinSkills({ dir, repo: 'https://github.com/someone/skills', commit, root, kind: 'workbench' });
  assert.ok(existsSync(join(root, 'registry/workbench/someone/my-skill.json')));
  assert.throws(() => pinSkills({ dir, repo: 'https://github.com/someone/skills', commit, root }), /already listed as a workbench/);
  assert.throws(() => pinSkills({ dir, repo: 'https://github.com/someone/other-repo', commit, root, kind: 'workbench' }), /already listed, from https:\/\/github\.com\/someone\/skills/);
  assert.throws(() => pinSkills({ dir, repo: 'https://github.com/some_one/skills', commit, root }), /cannot be listed/);
  assert.throws(() => pinSkills({ dir, repo: 'https://github.com/someone/skills', commit, root, kind: 'sound' }), /a kind is one of workbench, skill, connector/);
});
