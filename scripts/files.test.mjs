import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileManifest } from './files.mjs';

test('pinned file metadata uses UTF-8 bytes, stable hashes and portable paths', () => {
  const dir = mkdtempSync(join(tmpdir(), 'skill-manifest-'));
  mkdirSync(join(dir, 'scripts'));
  writeFileSync(join(dir, 'SKILL.md'), '你好');
  writeFileSync(join(dir, 'scripts', 'run.mjs'), 'a');
  const files = fileManifest(dir);
  assert.equal(files.find((file) => file.path === 'SKILL.md').size, 6);
  assert.ok(files.some((file) => file.path === 'scripts/run.mjs'));
  const before = files.find((file) => file.path === 'scripts/run.mjs').sha256;
  writeFileSync(join(dir, 'scripts', 'run.mjs'), 'b');
  assert.notEqual(fileManifest(dir).find((file) => file.path === 'scripts/run.mjs').sha256, before);
});

test('the committed blob reader keeps hashes independent of Windows checkout line endings', () => {
  const dir = mkdtempSync(join(tmpdir(), 'skill-manifest-crlf-'));
  writeFileSync(join(dir, 'SKILL.md'), 'a\r\n');
  const committed = fileManifest(dir, () => Buffer.from('a\n'));
  assert.equal(committed[0].size, 2);
  assert.notEqual(committed[0].sha256, fileManifest(dir)[0].sha256);
});
