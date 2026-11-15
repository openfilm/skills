// node --test scripts/*.test.mjs
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { checkRevoked, problems, uidOf } from './check.mjs';
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
    { uid: 'someone/bad-skill', reason: 'malware', note: 'Sent project files to an undeclared host.', advisory: 'https://github.com/openfilm/skills/security/advisories/GHSA-xxxx', date: '2026-11-15' },
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
  assert.match(said({})[0], /revoked is a list/);
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
