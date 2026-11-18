import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { inspect } from './check.mjs';
import { build } from './build.mjs';

const NAME = { en: 'Test', 'zh-CN': '测试', ja: 'テスト', ko: '테스트', es: 'Prueba' };
const ffmpeg = (...args) => execFileSync('ffmpeg', ['-nostdin', '-v', 'error', '-y', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
const made = mkdtempSync(join(tmpdir(), 'openfilm-kinds-'));
process.on('exit', () => rmSync(made, { recursive: true, force: true }));
ffmpeg('-f', 'lavfi', '-i', 'color=c=red@0.5:s=64x48,format=rgba', '-frames:v', '1', join(made, 'sticker.png'));
ffmpeg('-f', 'lavfi', '-i', 'color=c=gray:s=64x36', '-frames:v', '1', join(made, 'sample.jpg'));
ffmpeg('-f', 'lavfi', '-i', 'color=c=gray:s=2048x16', '-frames:v', '1', join(made, 'huge.png'));
const GRADE = { mix: [1.05, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0.95, 0], sat: 0.9, all: Array.from({ length: 17 }, (_, i) => i / 16) };

function library(t) {
  const root = mkdtempSync(join(tmpdir(), 'openfilm-kinds-library-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, 'revoked.json'), '[]\n');
  function item(cat, slug, files, fields = {}) {
    const dir = join(root, cat, slug);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    for (const [name, bytes] of Object.entries(files)) writeFileSync(join(dir, name), bytes);
    writeFileSync(join(dir, 'item.json'), JSON.stringify({
      cat, name: NAME, about: 'A small test item for the new kinds.', tags: ['test'], by: 'tester', license: 'CC0-1.0',
      source: { kind: 'own' }, version: 1, main: Object.keys(files)[0],
      files: Object.entries(files).map(([path, bytes]) => ({ path, bytes: bytes.length })), ...fields,
    }));
    return `${cat}/${slug}`;
  }
  return { root, item };
}

test('a text style is its variables, carried in the catalog', (t) => {
  const { root, item } = library(t);
  const id = item('text', 'bold', { 'style.json': JSON.stringify({ vars: { '--weight': '900', '--color': '#ffcc00' } }) });
  const { fingerprint } = inspect(id, { root });
  writeFileSync(join(root, 'approvals.json'), JSON.stringify({ [id]: { fingerprint, evidence: 'Made for the test suite.' } }));
  const catalog = JSON.parse(build({ root, source: '0'.repeat(40) }).catalog);
  assert.deepEqual(catalog.items[0].vars, { '--weight': '900', '--color': '#ffcc00' });
  assert.equal(catalog.items[0].durationMs, 0);
  assert.deepEqual(catalog.items[0].files, {});
  for (const vars of [{ '--bg': 'url(https://x.test/a.png)' }, { color: 'red' }, { '--x': 'a;b' }, {}]) {
    item('text', 'bad', { 'style.json': JSON.stringify({ vars }) });
    assert.throws(() => inspect('text/bad', { root }), /style\.json/);
  }
  item('text', 'timed', { 'style.json': JSON.stringify({ vars: { '--weight': '700' } }) }, { durationMs: 3000 });
  assert.throws(() => inspect('text/timed', { root }), /no length/);
});

test('a filter is its grade and the picture it is shown on', (t) => {
  const { root, item } = library(t);
  const id = item('filter', 'warm', { 'grade.json': JSON.stringify(GRADE), 'sample.jpg': readFileSync(join(made, 'sample.jpg')) });
  const { fingerprint } = inspect(id, { root });
  writeFileSync(join(root, 'approvals.json'), JSON.stringify({ [id]: { fingerprint, evidence: 'Made for the test suite.' } }));
  const catalog = JSON.parse(build({ root, source: '0'.repeat(40) }).catalog);
  assert.deepEqual(catalog.items[0].grade, GRADE);
  assert.deepEqual(Object.keys(catalog.items[0].files), ['sample.jpg']);
  item('filter', 'bad', { 'grade.json': JSON.stringify({ ...GRADE, all: [0, 1] }), 'sample.jpg': readFileSync(join(made, 'sample.jpg')) });
  assert.throws(() => inspect('filter/bad', { root }), /grade\.json/);
});

test('a sticker is its picture on a page of its own', (t) => {
  const { root, item } = library(t);
  const id = item('sticker', 'dot', { 'sticker.png': readFileSync(join(made, 'sticker.png')) }, { durationMs: 3000 });
  const { fingerprint } = inspect(id, { root });
  writeFileSync(join(root, 'approvals.json'), JSON.stringify({ [id]: { fingerprint, evidence: 'Made for the test suite.' } }));
  const { catalog, blobs } = build({ root, source: '0'.repeat(40) });
  const entry = JSON.parse(catalog).items[0];
  assert.deepEqual([entry.w, entry.h], [64, 48]);
  assert.deepEqual(Object.keys(entry.files).sort(), ['files/sticker.html', 'files/sticker.png', 'saved.json']);
  const page = blobs.get(entry.files['files/sticker.html'].sha256).bytes.toString('utf8');
  assert.match(page, /img-src 'self'/);
  assert.match(page, /<img src="sticker\.png"/);
  item('sticker', 'huge', { 'sticker.png': readFileSync(join(made, 'huge.png')) }, { durationMs: 3000 });
  assert.throws(() => inspect('sticker/huge', { root }), /1024×1024/);
});

test('a template is a group of its own locked pages and its pictures', (t) => {
  const { root, item } = library(t);
  ffmpeg('-f', 'lavfi', '-i', 'color=c=gray:s=64x36:r=10:d=1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', join(made, 'preview.mp4'));
  const tpl = { clips: [
    { track: 0, at: 0.5, time: [0, 2], page: 'title', size: { w: 1000, h: 400 }, place: { x: 0.5, y: 0.5, fit: 0.3 }, texts: { '.t1': 'Hello' }, props: [{ name: 'Title', type: 'text', at: '.t1' }] },
    { track: 1, at: 0, time: [0, 3], picture: 'example-1' },
  ] };
  const files = {
    'template.json': JSON.stringify(tpl), 'poster.jpg': readFileSync(join(made, 'sample.jpg')), 'preview.mp4': readFileSync(join(made, 'preview.mp4')),
    'title.html': '<div class="w"><h1 class="t1">Hello</h1></div>', 'title.css': '.w{display:grid;place-items:center}.t1{color:#fff;animation:a 1s both}@keyframes a{from{opacity:0}}',
    'example-1.jpg': readFileSync(join(made, 'sample.jpg')),
  };
  const id = item('template', 'hello', files, { durationMs: 3000 });
  const { fingerprint } = inspect(id, { root });
  writeFileSync(join(root, 'approvals.json'), JSON.stringify({ [id]: { fingerprint, evidence: 'Made for the test suite.' } }));
  const { catalog, blobs } = build({ root, source: '0'.repeat(40) });
  const entry = JSON.parse(catalog).items[0];
  assert.equal(entry.slots, 1);
  const saved = JSON.parse(blobs.get(entry.files['saved.json'].sha256).bytes.toString('utf8'));
  assert.equal(saved.kind, 'group');
  assert.deepEqual(saved.clips[0].clip.overrides, [{ at: '.t1', text: 'Hello' }]);
  assert.equal(saved.clips[1].clip.src, 'example-1.jpg');
  const page = blobs.get(entry.files['files/title.html'].sha256).bytes.toString('utf8');
  assert.match(page, /default-src 'none'/);
  assert.match(page, /<h1 class="t1">Hello<\/h1>/);
  for (const markup of ['<script>alert(1)</script>', '<img src="x.png">', '<div onclick="x()">a</div>', '<a href="https://x.test">a</a>']) {
    item('template', 'bad', { ...files, 'title.html': markup }, { durationMs: 3000 });
    assert.throws(() => inspect('template/bad', { root }), /markup only/);
  }
});
