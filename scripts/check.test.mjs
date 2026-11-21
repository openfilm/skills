// node --test scripts/*.test.mjs
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildIndex, checkListing, checkRegistry, checkRevoked, checkUnique, fetchAt, indexText, problems, uidOf } from './check.mjs';
import { folderDigest } from './digest.mjs';

const listed = [{ name: 'replicate', repo: 'https://github.com/openfilm/skill-replicate', commit: 'e'.repeat(40) }];
/** What checkRevoked says of a list. @param {unknown} revoked */
function said(revoked, skills = listed) {
  problems.length = 0;
  checkRevoked(revoked, skills);
  return problems.splice(0);
}

test('a full name is the owner, lowercased, and the name', () => {
  assert.equal(uidOf('https://github.com/WEBGRS/skill-x', 'x'), 'webgrs/x');
  assert.equal(uidOf('https://github.com/local/skill-x', 'x'), 'github-local/x');
});

test('withdrawals as OpenFilm reads them pass', () => {
  assert.deepEqual(said([]), []);
  assert.deepEqual(said([
    { uid: 'someone/bad-skill', reason: 'malware', note: 'Sent project files to an undeclared host.', advisory: 'https://github.com/openfilm/community/security/advisories/GHSA-xxxx', date: '2026-11-15' },
    { uid: 'someone/old', commits: ['a'.repeat(40)], reason: 'broken' },
    { uid: 'someone/copy', digests: ['b'.repeat(64)], reason: 'impersonation' },
    { uid: 'openfilm/replicate', commits: ['c'.repeat(40)], reason: 'policy' },
  ]), []);
});

test('a malformed withdrawal is said', () => {
  const out = said([
    { uid: 'Someone/Bad', reason: 'malware' },
    { uid: 'someone/x', reason: 'because' },
    { uid: 'someone/x', reason: 'broken', commits: ['abc'] },
    { uid: 'someone/x', reason: 'broken', digests: [] },
    { uid: 'someone/x', reason: 'broken', advisory: 'http://example.com/a' },
    { uid: 'someone/x', reason: 'broken', date: '2026-02-30' },
    { uid: 'someone/x', reason: 'broken', why: 'extra' },
  ]);
  assert.equal(out.length, 7);
  assert.match(out[0], /uid/);
  assert.match(out[1], /reason/);
  assert.match(out[2], /commits/);
  assert.match(out[3], /digests/);
  assert.match(out[4], /advisory/);
  assert.match(out[5], /date/);
  assert.match(out[6], /why is not a field/);
  assert.match(said({})[0], /revoked.json: it is a list/);
});

test('a version withdrawn cannot stay listed', () => {
  assert.match(said([{ uid: 'openfilm/replicate', reason: 'malware' }])[0], /still listed/);
  assert.match(said([{ uid: 'openfilm/replicate', commits: ['e'.repeat(40)], reason: 'broken' }])[0], /still listed/);
});

test('a folder digest is the app\'s: paths, sizes and bytes in name order', () => {
  const dir = mkdtempSync(join(tmpdir(), 'openfilm-digest-'));
  try {
    mkdirSync(join(dir, 'scripts'));
    writeFileSync(join(dir, 'SKILL.md'), 'brief');
    writeFileSync(join(dir, 'scripts', 'a.mjs'), 'code');
    const digest = folderDigest(dir);
    assert.match(digest, /^[0-9a-f]{64}$/);
    writeFileSync(join(dir, 'scripts', 'a.mjs'), 'code!');
    assert.notEqual(folderDigest(dir), digest);
    writeFileSync(join(dir, 'scripts', 'a.mjs'), 'code');
    assert.equal(folderDigest(dir), digest);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

const KINDS = ['workbench', 'skill', 'connector'];
const LISTED = { name: 'my-skill', repo: 'https://github.com/Someone/skill-my-skill', path: 'skills/my-skill', version: '0.1.0', commit: 'a'.repeat(40) };
/** What checkListing says of a file, and what it gives. @param {string} file @param {unknown} entry */
function listing(file, entry) {
  problems.length = 0;
  const out = checkListing(file, typeof entry === 'string' ? entry : JSON.stringify(entry), KINDS);
  return { out, said: problems.splice(0) };
}

test('a listing is its file, under its kind, its owner and its name', () => {
  const { out, said } = listing('registry/skill/someone/my-skill.json', LISTED);
  assert.deepEqual(said, []);
  assert.deepEqual(out, { kind: 'skill', ...LISTED });
  const files = [{ path: 'SKILL.md', size: 10, sha256: 'c'.repeat(64) }, { path: 'scripts/a.mjs', size: 4, sha256: 'd'.repeat(64) }];
  assert.deepEqual(listing('registry/workbench/someone/my-skill.json', { ...LISTED, files }).out, { kind: 'workbench', ...LISTED, files });
  // pasted from a web page, on one line
  assert.deepEqual(listing('registry/skill/someone/my-skill.json', JSON.stringify(LISTED)).said, []);
});

test('nobody lists under someone else\'s name', () => {
  const { out, said } = listing('registry/skill/openfilm/my-skill.json', LISTED);
  assert.equal(out, null);
  assert.equal(said.length, 1);
  assert.match(said[0], /its repository is Someone's, so it is listed under someone: registry\/skill\/someone\/my-skill\.json/);
  assert.match(listing('registry/skill/someone/my-skill.json', { ...LISTED, repo: 'https://github.com/openfilm/skill-my-skill' }).said[0], /listed under openfilm/);
});

test('a listing out of place or malformed is said', () => {
  const said = (/** @type {string} */ file, /** @type {unknown} */ entry) => listing(file, entry).said;
  assert.match(said('registry/skill/someone/My-Skill.json', LISTED)[0], /registry\/<kind>\/<owner>\/<name>\.json/);
  assert.match(said('registry/someone/my-skill.json', LISTED)[0], /registry\/<kind>\/<owner>\/<name>\.json/);
  assert.match(said('registry/template/someone/my-skill.json', LISTED)[0], /its kind is one of workbench, skill, connector, not template/);
  assert.match(said('registry/skill/someone/other.json', LISTED)[0], /its name is my-skill, so its file is registry\/skill\/someone\/my-skill\.json/);
  assert.match(said('registry/skill/someone/my-skill.json', '{ "name": ')[0], /JSON/);
  assert.match(said('registry/skill/someone/my-skill.json', [LISTED])[0], /a listing is an object/);
  assert.match(said('registry/skill/someone/my-skill.json', { ...LISTED, kind: 'skill' })[0], /kind is not a field/);
  assert.match(said('registry/skill/someone/my-skill.json', { ...LISTED, path: 'my-skill' })[0], /its path is skills\/my-skill/);
  assert.match(said('registry/skill/someone/my-skill.json', { ...LISTED, version: 'v1' })[0], /its version is x\.y\.z/);
  assert.match(said('registry/skill/someone/my-skill.json', { ...LISTED, commit: 'abc1234' })[0], /whole 40-character id/);
  assert.match(said('registry/skill/someone/my-skill.json', { ...LISTED, repo: 'https://gitlab.com/someone/x' })[0], /its repo is https:\/\/github\.com/);
  assert.match(said('registry/skill/someone/my-skill.json', { ...LISTED, files: [{ path: '../x', size: 1, sha256: 'c'.repeat(64) }] })[0], /inside the folder/);
  assert.match(said('registry/skill/someone/my-skill.json', { ...LISTED, files: [{ path: 'a.md', size: 1, sha256: 'c'.repeat(64) }] })[0], /SKILL\.md/);
});

test('one full name is listed once, whatever its kind', () => {
  problems.length = 0;
  checkUnique([{ ...LISTED, kind: 'skill' }, { ...LISTED, kind: 'workbench' }, { ...LISTED, name: 'other', kind: 'skill' }]);
  const out = problems.splice(0);
  assert.equal(out.length, 1);
  assert.match(out[0], /someone\/my-skill is listed twice/);
});

test('the check reads registry/, revoked.json, and whether index.json is their build', async () => {
  const root = mkdtempSync(join(tmpdir(), 'openfilm-registry-'));
  try {
    mkdirSync(join(root, 'registry', 'skill', 'someone'), { recursive: true });
    writeFileSync(join(root, 'registry', 'skill', 'someone', 'my-skill.json'), JSON.stringify(LISTED));
    writeFileSync(join(root, 'revoked.json'), '[]\n');
    problems.length = 0;
    assert.equal(await checkRegistry({ root, fetch: false, index: false }), 1);
    assert.deepEqual(problems.splice(0), []);
    assert.equal(await checkRegistry({ root, fetch: false }), 1);
    assert.match(problems.splice(0)[0], /index\.json: it is not the build/);
    writeFileSync(join(root, 'index.json'), indexText(buildIndex([{ kind: 'skill', ...LISTED }], [])));
    await checkRegistry({ root, fetch: false });
    assert.deepEqual(problems.splice(0), []);
    // a stray file, and a withdrawal of what is still listed
    writeFileSync(join(root, 'registry', 'README.md'), 'hi');
    writeFileSync(join(root, 'revoked.json'), JSON.stringify([{ uid: 'someone/my-skill', reason: 'malware' }]));
    await checkRegistry({ root, fetch: false });
    const out = problems.splice(0);
    assert.ok(out.some((p) => /^registry\/README\.md: a listing is registry/.test(p)), out.join('\n'));
    assert.ok(out.some((p) => /still listed/.test(p)), out.join('\n'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a fetched skill reads as committed, line ends and all', () => {
  const src = mkdtempSync(join(tmpdir(), 'check-src-'));
  let dir;
  try {
    const git = (/** @type {string[]} */ a) => execFileSync('git', ['-C', src, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { encoding: 'utf8' }).trim();
    git(['init', '-q']);
    // what Git for Windows' core.autocrlf does, on any system
    writeFileSync(join(src, '.gitattributes'), '* text eol=crlf\n');
    writeFileSync(join(src, 'SKILL.md'), 'one\ntwo\n');
    git(['add', '.']);
    git(['commit', '-q', '-m', 'a skill']);
    const commit = git(['rev-parse', 'HEAD']);
    dir = fetchAt(src, commit);
    assert.equal(readFileSync(join(dir, 'SKILL.md'), 'utf8'), 'one\ntwo\n');
  } finally {
    rmSync(src, { recursive: true, force: true });
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});
