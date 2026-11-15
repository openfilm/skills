import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { ROOT, inspect, reviewed } from './check.mjs';

function fixture(t, id) {
  const root = mkdtempSync(join(tmpdir(), 'openfilm-review-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const dir = join(root, id);
  cpSync(join(ROOT, id), dir, { recursive: true });
  const metadata = join(dir, 'item.json');
  const item = JSON.parse(readFileSync(metadata, 'utf8'));
  return { root, dir, item, save: () => writeFileSync(metadata, JSON.stringify(item)) };
}

test('review rejects duplicate or unrecognized data', (t) => {
  const { root, item, save } = fixture(t, 'transition/glitch');
  item.tags.push(item.tags[0]);
  save();
  assert.throws(() => inspect('transition/glitch', { root }), /unique/);
  item.tags.pop();
  item.files.push(item.files[0]);
  save();
  assert.throws(() => inspect('transition/glitch', { root }), /duplicate/);
});

test('an external file must exist and match its SHA-256 before release', (t) => {
  const id = 'sound/glass-pulse';
  const { root, dir, item, save } = fixture(t, id);
  const original = inspect(id, { root }).inputs.get('sound.m4a');
  rmSync(join(dir, 'sound.m4a'));
  item.files[0].sha256 = 'f'.repeat(64);
  save();
  assert.equal(inspect(id, { root, allowMissing: true }).missing.length, 1);
  assert.throws(() => inspect(id, { root }), /stage the attachment/);
  const mediaDir = join(root, 'attachments');
  mkdirSync(mediaDir);
  writeFileSync(join(mediaDir, item.files[0].sha256), original);
  assert.throws(() => inspect(id, { root, mediaDir }), /SHA-256 mismatch/);
});

test('overlay markup cannot escape through a CSS comment', (t) => {
  const id = 'transition/glitch';
  const { root, dir, item, save } = fixture(t, id);
  const file = join(dir, 'overlay.css');
  const data = readFileSync(file, 'utf8') + '/* </style><meta http-equiv="refresh" content="0"> */';
  writeFileSync(file, data);
  item.files.find((file) => file.path === 'overlay.css').bytes = Buffer.byteLength(data);
  save();
  assert.throws(() => inspect(id, { root }), /no external resources or HTML/);
});

test('metadata with a plausible CC0 URL needs a matching maintainer approval', (t) => {
  const id = 'transition/glitch';
  const { root, item, save } = fixture(t, id);
  const old = inspect(id, { root });
  writeFileSync(join(root, 'approvals.json'), JSON.stringify({ [id]: {
    fingerprint: old.fingerprint, evidence: 'Original first-party work reviewed by a maintainer.',
  } }));
  assert.equal(reviewed({ root }).length, 1);
  item.source = { kind: 'cc0', url: 'https://example.invalid/no-license' };
  save();
  assert.throws(() => reviewed({ root }), /maintainer approval/);
});
