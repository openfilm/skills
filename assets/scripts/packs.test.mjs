import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { hash, inspect, inspectPacks, text } from './check.mjs';
import { fileURLToPath } from 'node:url';

/* the two starter items, kept here as test material since the Community's library was emptied */
const FIXTURES = fileURLToPath(new URL('./fixtures/', import.meta.url));
import { blobsOf, build, versionsRaised } from './build.mjs';

const ITEMS = ['sound/glass-pulse', 'transition/glitch'];
const SOURCE = '0'.repeat(40);

// A copy of the library's two items, both by openfilm, approved as they are.
function library(t) {
  const root = mkdtempSync(join(tmpdir(), 'openfilm-packs-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const id of ITEMS) cpSync(join(FIXTURES, id), join(root, id), { recursive: true });
  writeFileSync(join(root, 'revoked.json'), '[]\n');
  const approvals = Object.fromEntries(ITEMS.map((id) => [id, {
    fingerprint: inspect(id, { root }).fingerprint, evidence: 'Original first-party work reviewed by a maintainer.',
  }]));
  const approve = () => writeFileSync(join(root, 'approvals.json'), JSON.stringify(approvals));
  approve();
  function pack(slug, fields = {}) {
    const dir = join(root, 'packs', slug);
    mkdirSync(dir, { recursive: true });
    const data = {
      name: { en: 'Starter Pack', 'zh-CN': '入门包', ja: 'スターターパック', ko: '스타터 팩', es: 'Paquete inicial' },
      about: 'A test pack of a sound and a transition.', by: 'openfilm', license: 'CC0-1.0', version: 1, items: ITEMS, ...fields,
    };
    writeFileSync(join(dir, 'pack.json'), JSON.stringify(data));
    return { dir, data };
  }
  function approvePacks() {
    for (const { id, fingerprint } of inspectPacks({ root })) approvals[id] = { fingerprint, evidence: 'Pack reviewed by a maintainer.' };
    approve();
  }
  return { root, pack, approvePacks };
}

test('a catalog with no packs is what it was before packs', (t) => {
  const { root } = library(t);
  const { catalog } = build({ root, source: SOURCE });
  const parsed = JSON.parse(catalog);
  assert.deepEqual(Object.keys(parsed), ['version', 'source', 'items']);
  assert.ok(catalog.equals(text({ version: 1, source: SOURCE, items: parsed.items })));
});

test('a pack builds into the catalog with its cover as a blob', (t) => {
  const { root, pack, approvePacks } = library(t);
  const { dir } = pack('starter', { cover: 'cover.jpg' });
  const cover = readFileSync(join(FIXTURES, 'transition/glitch/poster.jpg'));
  writeFileSync(join(dir, 'cover.jpg'), cover);
  assert.throws(() => build({ root, source: SOURCE }), /packs\/starter: maintainer approval/);
  approvePacks();
  const { catalog, blobs } = build({ root, source: SOURCE });
  const parsed = JSON.parse(catalog);
  assert.deepEqual(Object.keys(parsed), ['version', 'source', 'items', 'packs']);
  assert.equal(parsed.version, 1);
  assert.deepEqual(parsed.items.map((item) => item.id), ITEMS);
  const [entry] = parsed.packs;
  const shown = {
    name: { en: 'Starter Pack', 'zh-CN': '入门包', ja: 'スターターパック', ko: '스타터 팩', es: 'Paquete inicial' },
    about: 'A test pack of a sound and a transition.', by: 'openfilm', license: 'CC0-1.0', items: ITEMS,
    cover: { sha256: hash(cover), bytes: cover.length },
  };
  assert.deepEqual(entry, { id: 'starter', version: 1, revision: hash(text({ id: 'starter', version: 1, ...shown })), ...shown });
  assert.deepEqual(blobs.get(hash(cover)), { bytes: cover, type: 'image/jpeg' });
  assert.ok(blobsOf(parsed).some((file) => file.sha256 === hash(cover) && file.bytes === cover.length));
});

test('packs are sorted, may leave items out, and a lone item stays as it is', (t) => {
  const { root, pack, approvePacks } = library(t);
  pack('zeta', { items: ['transition/glitch'] });
  pack('alpha', { items: ['sound/glass-pulse'] });
  approvePacks();
  assert.deepEqual(JSON.parse(build({ root, source: SOURCE }).catalog).packs.map((entry) => [entry.id, entry.items]),
    [['alpha', ['sound/glass-pulse']], ['zeta', ['transition/glitch']]]);
  rmSync(join(root, 'packs', 'zeta'), { recursive: true });
  assert.throws(() => build({ root, source: SOURCE }), /withdrawn/);
});

test('the check refuses a pack that breaks the rules', (t) => {
  const { root, pack } = library(t);
  const refused = (pattern) => assert.throws(() => inspectPacks({ root }), pattern);
  const { dir } = pack('starter', { items: ['sound/glass-pulse', 'music/missing'] });
  refused(/music\/missing is not an item/);
  pack('starter', { by: 'someone' });
  refused(/is by someone else/);
  pack('starter', { items: [...ITEMS, ITEMS[0]] });
  refused(/each item once/);
  pack('starter', { items: Array.from({ length: 201 }, (_, i) => `sound/s${i}`) });
  refused(/1–200 items/);
  pack('starter', { items: [] });
  refused(/1–200 items/);
  pack('starter', { license: 'CC-BY-4.0' });
  refused(/CC0/);
  pack('starter', { tags: ['extra'] });
  refused(/invalid pack.json fields/);
  pack('starter');
  writeFileSync(join(dir, 'cover.jpg'), readFileSync(join(FIXTURES, 'transition/glitch/poster.jpg')));
  refused(/unexpected file: cover.jpg/);
  pack('starter', { cover: 'cover.jpg' });
  writeFileSync(join(dir, 'cover.jpg'), Buffer.alloc(1024 * 1024 + 1, 0xff));
  refused(/at most 1 MiB/);
  writeFileSync(join(dir, 'cover.jpg'), readFileSync(join(FIXTURES, 'transition/glitch/preview.mp4')));
  refused(/mjpeg/);
  rmSync(join(dir, 'cover.jpg'));
  pack('starter');
  assert.equal(inspectPacks({ root }).length, 1);
  pack('second', { items: ['transition/glitch'] });
  refused(/transition\/glitch is in packs\/second and packs\/starter/);
});

test('a pack slug is a short lowercase slug', (t) => {
  const { root, pack } = library(t);
  pack('Bad_Slug');
  assert.throws(() => inspectPacks({ root }), /expected packs\/<slug>/);
  rmSync(join(root, 'packs'), { recursive: true });
  pack('a'.repeat(65));
  assert.throws(() => inspectPacks({ root }), /expected packs\/<slug>/);
});

test('a catalog holds at most 200 packs', (t) => {
  const { root } = library(t);
  for (let i = 0; i <= 200; i++) mkdirSync(join(root, 'packs', `p${i}`), { recursive: true });
  assert.throws(() => inspectPacks({ root }), /Limit of 200 packs/);
});

test('a changed pack needs a higher version before it is published', () => {
  const item = { id: 'sound/a', version: 1, fingerprint: 'a' };
  const pack = { id: 'starter', version: 2, revision: 'r' };
  assert.doesNotThrow(() => versionsRaised({ items: [item] }, { items: [item], packs: [pack] }));
  assert.doesNotThrow(() => versionsRaised({ items: [item], packs: [pack] }, { items: [item], packs: [pack] }));
  assert.throws(() => versionsRaised({ items: [item], packs: [pack] }, { items: [item], packs: [{ ...pack, revision: 's' }] }),
    /packs\/starter: raise its version/);
  assert.doesNotThrow(() => versionsRaised({ items: [item], packs: [pack] }, { items: [item], packs: [{ ...pack, version: 3, revision: 's' }] }));
  assert.throws(() => versionsRaised({ items: [item] }, { items: [{ ...item, fingerprint: 'b' }] }), /sound\/a: raise its version/);
});
