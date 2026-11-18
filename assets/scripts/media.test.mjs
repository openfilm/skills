import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { hash, inspect, inspectPacks, reviewed } from './check.mjs';
import { build } from './build.mjs';

const SOURCE = '0'.repeat(40);
const NAME = { en: 'Gray Field', 'zh-CN': '灰色画面', ja: 'グレーの画面', ko: '회색 화면', es: 'Campo gris' };
// A 1×1 lossless WebP: not every FFmpeg build can write one.
const WEBP = Buffer.from('UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==', 'base64');

const ffmpeg = (...args) => execFileSync('ffmpeg', ['-nostdin', '-v', 'error', '-y', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });

// Tiny media made once, then copied into each test's own library.
const made = mkdtempSync(join(tmpdir(), 'openfilm-media-'));
process.on('exit', () => rmSync(made, { recursive: true, force: true }));
const at = (name) => join(made, name);
ffmpeg('-f', 'lavfi', '-i', 'color=c=gray:s=64x36:r=10:d=1', '-f', 'lavfi', '-i', 'sine=d=1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-shortest', at('clip.mp4'));
ffmpeg('-f', 'lavfi', '-i', 'color=c=gray:s=16x16:r=1:d=61', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', at('long.mp4'));
ffmpeg('-f', 'lavfi', '-i', 'color=c=gray:s=64x36', '-frames:v', '1', at('poster.jpg'));
ffmpeg('-f', 'lavfi', '-i', 'color=c=gray:s=32x32', '-frames:v', '1', at('picture.png'));
ffmpeg('-f', 'lavfi', '-i', 'color=c=gray:s=8193x2', '-frames:v', '1', at('wide.png'));
ffmpeg('-f', 'lavfi', '-i', 'sine=d=1', '-c:a', 'pcm_s16le', at('tone.wav'));
writeFileSync(at('picture.webp'), WEBP);
const read = (name) => readFileSync(at(name));

function library(t) {
  const root = mkdtempSync(join(tmpdir(), 'openfilm-media-library-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, 'revoked.json'), '[]\n');
  writeFileSync(join(root, 'approvals.json'), '{}');
  // files: { name in the folder: bytes }; fields replace item.json's, and one set to undefined is left out.
  function item(slug, media, files, fields = {}) {
    const dir = join(root, 'media', slug);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    for (const [name, bytes] of Object.entries(files)) writeFileSync(join(dir, name), bytes);
    const data = {
      cat: 'media', name: NAME, about: 'A plain gray test file for the media checks.', tags: ['gray', 'test'], by: 'openfilm',
      license: 'CC0-1.0', source: { kind: 'own' }, version: 1, main: Object.keys(files)[0], media,
      ...(media !== 'image' && { durationMs: 1000 }),
      files: Object.entries(files).map(([path, bytes]) => ({ path, bytes: bytes.length })), ...fields,
    };
    writeFileSync(join(dir, 'item.json'), JSON.stringify(data));
    return `media/${slug}`;
  }
  function approve(...ids) {
    const approvals = Object.fromEntries(ids.map((id) => [id, {
      fingerprint: inspect(id, { root }).fingerprint, evidence: 'Original first-party test media made with ffmpeg.',
    }]));
    writeFileSync(join(root, 'approvals.json'), JSON.stringify(approvals));
    return approvals;
  }
  return { root, item, approve };
}

test('a video, an image and audio pass as media', (t) => {
  const { root, item } = library(t);
  const video = inspect(item('clip', 'video', { 'media.mp4': read('clip.mp4'), 'poster.jpg': read('poster.jpg') }), { root });
  assert.deepEqual([...video.inputs.keys()], ['media.mp4', 'poster.jpg']);
  assert.ok(inspect(item('still', 'image', { 'media.png': read('picture.png') }), { root }));
  assert.ok(inspect(item('still', 'image', { 'media.webp': WEBP }, { durationMs: 0 }), { root }));
  assert.ok(inspect(item('tone', 'audio', { 'media.wav': read('tone.wav') }), { root }));
});

test('media builds into the catalog as its files and a video poster', (t) => {
  const { root, item, approve } = library(t);
  const ids = [
    item('clip', 'video', { 'media.mp4': read('clip.mp4'), 'poster.jpg': read('poster.jpg') }),
    item('still', 'image', { 'media.png': read('picture.png') }),
    item('tone', 'audio', { 'media.wav': read('tone.wav') }),
  ];
  mkdirSync(join(root, 'packs', 'gray'), { recursive: true });
  writeFileSync(join(root, 'packs', 'gray', 'pack.json'), JSON.stringify({
    name: NAME, about: 'A test pack of gray media.', by: 'openfilm', license: 'CC0-1.0', version: 1, items: ids,
  }));
  const approvals = approve(...ids);
  for (const { id, fingerprint } of inspectPacks({ root })) approvals[id] = { fingerprint, evidence: 'Pack reviewed by a maintainer.' };
  writeFileSync(join(root, 'approvals.json'), JSON.stringify(approvals));

  const { catalog, blobs } = build({ root, source: SOURCE });
  const parsed = JSON.parse(catalog);
  const file = (bytes) => ({ sha256: hash(bytes), bytes: bytes.length });
  const fingerprints = Object.fromEntries(reviewed({ root }).map((entry) => [entry.id, entry.fingerprint]));
  const entry = (id, media, durationMs, files) => ({
    id, name: NAME, about: 'A plain gray test file for the media checks.', tags: ['gray', 'test'], by: 'openfilm', durationMs, media,
    version: 1, revision: hash(Buffer.from(JSON.stringify([fingerprints[id], files]) + '\n')), fingerprint: fingerprints[id], files,
  });
  assert.deepEqual(parsed.items, [
    entry('media/clip', 'video', 1000, { 'community-media-clip.mp4': file(read('clip.mp4')), 'poster.jpg': file(read('poster.jpg')) }),
    entry('media/still', 'image', 0, { 'community-media-still.png': file(read('picture.png')) }),
    entry('media/tone', 'audio', 1000, { 'community-media-tone.wav': file(read('tone.wav')) }),
  ]);
  assert.deepEqual(parsed.packs.map((pack) => [pack.id, pack.items]), [['gray', ids]]);
  assert.deepEqual(blobs.get(hash(read('clip.mp4'))), { bytes: read('clip.mp4'), type: 'video/mp4' });
  assert.equal(blobs.get(hash(read('picture.png'))).type, 'image/png');
  assert.equal(blobs.get(hash(read('tone.wav'))).type, 'audio/wav');
});

test('a media file can be staged by its SHA-256 like audio', (t) => {
  const { root, item } = library(t);
  const bytes = read('clip.mp4');
  const id = item('clip', 'video', { 'poster.jpg': read('poster.jpg') }, {
    main: 'media.mp4', files: [{ path: 'media.mp4', bytes: bytes.length, sha256: hash(bytes) }, { path: 'poster.jpg', bytes: read('poster.jpg').length }],
  });
  assert.deepEqual(inspect(id, { root, allowMissing: true }).missing, [hash(bytes)]);
  const mediaDir = join(root, 'staged');
  mkdirSync(mediaDir);
  writeFileSync(join(mediaDir, hash(bytes)), bytes);
  assert.ok(inspect(id, { root, mediaDir }).inputs.get('media.mp4').equals(bytes));
});

test('the check refuses media that breaks the rules', (t) => {
  const { root, item } = library(t);
  const refused = (id, pattern) => assert.throws(() => inspect(id, { root }), pattern);
  const poster = read('poster.jpg');
  refused(item('clip', 'video', { 'media.mkv': read('clip.mp4'), 'poster.jpg': poster }), /main: a video is media.mp4, media.mov or media.webm/);
  refused(item('clip', 'video', { 'media.webm': read('clip.mp4'), 'poster.jpg': poster }), /media.webm: the file is not webm/);
  refused(item('clip', 'video', { 'media.mp4': read('long.mp4'), 'poster.jpg': poster }, { durationMs: 61_000 }), /durationMs: a video is up to 60 seconds/);
  refused(item('clip', 'video', { 'media.mp4': read('long.mp4'), 'poster.jpg': poster }, { durationMs: 60_000 }), /media.mp4: a video is up to 60 seconds/);
  refused(item('clip', 'video', { 'media.mp4': read('clip.mp4'), 'poster.jpg': poster }, { durationMs: 2000 }), /declared durationMs differs/);
  refused(item('clip', 'video', { 'media.mp4': read('clip.mp4') }), /a video needs a poster.jpg/);
  refused(item('clip', 'video', { 'media.mp4': read('clip.mp4'), 'poster.jpg': read('picture.png') }), /poster.jpg: expected a single mjpeg/);
  refused(item('clip', 'video', { 'media.mp4': read('clip.mp4'), 'poster.jpg': poster }, { durationMs: undefined }), /durationMs: a video/);
  refused(item('still', 'image', { 'media.png': read('picture.png'), 'poster.jpg': poster }), /poster.jpg is for a video only, not an image/);
  refused(item('still', 'image', { 'media.gif': read('picture.png') }), /main: an image is media.jpg, media.jpeg, media.png or media.webp/);
  refused(item('still', 'image', { 'media.jpg': read('picture.png') }), /media.jpg: expected one jpg picture/);
  refused(item('still', 'image', { 'media.png': read('wide.png') }), /at most 8192 px a side/);
  refused(item('still', 'image', { 'media.png': read('picture.png') }, { durationMs: 1000 }), /an image has no length/);
  refused(item('tone', 'audio', { 'media.ogg': read('tone.wav') }), /main: audio is media.m4a, media.mp3 or media.wav/);
  refused(item('tone', 'audio', { 'media.mp3': read('tone.wav') }), /media.mp3: the file is not mp3/);
  refused(item('tone', 'audio', { 'media.wav': read('tone.wav') }, { durationMs: 600_001 }), /durationMs: audio is up to 10 minutes/);
  refused(item('tone', 'audio', { 'media.wav': read('tone.wav'), 'poster.jpg': poster }), /poster.jpg is for a video only, not audio/);
  refused(item('tone', 'film', { 'media.wav': read('tone.wav') }), /media must be "video", "image" or "audio"/);
  refused(item('tone', 'audio', { 'media.wav': read('tone.wav') }, { media: undefined }), /invalid item.json fields/);
  refused(item('tone', 'audio', { 'media.wav': read('tone.wav') }, { files: [{ path: 'media.wav', bytes: 20 * 1024 * 1024 + 1 }] }), /at most 20 MiB/);
});

test('only media items say what media they are', (t) => {
  const { root, item } = library(t);
  const id = item('tone', 'audio', { 'media.wav': read('tone.wav') });
  const dir = join(root, 'sound', 'tone');
  mkdirSync(dir, { recursive: true });
  const data = JSON.parse(readFileSync(join(root, id, 'item.json'), 'utf8'));
  writeFileSync(join(dir, 'item.json'), JSON.stringify({ ...data, cat: 'sound' }));
  assert.throws(() => inspect('sound/tone', { root }), /invalid item.json fields/);
});
