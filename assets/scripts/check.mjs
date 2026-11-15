#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const CATEGORIES = ['sound', 'music', 'transition', 'effect'];
export const LANGUAGES = ['en', 'zh-CN', 'ja', 'ko', 'es'];
export const HEX = /^[a-f0-9]{64}$/;
export const MB = 1024 * 1024;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ITEM_KEYS = ['cat', 'name', 'about', 'tags', 'by', 'license', 'source', 'version', 'files', 'main', 'durationMs'];
export const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const text = (value) => Buffer.from(JSON.stringify(value) + '\n');

function requireThat(ok, message) { if (!ok) throw new Error(message); }
const record = (value) => value && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => record(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const cleanText = (value, min, max) => typeof value === 'string' && value.trim().length >= min && value.length <= max;
const https = (value) => {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; }
  catch { return false; }
};

function fileAt(path, max) {
  const info = lstatSync(path);
  requireThat(info.isFile() && info.size > 0 && info.size <= max, 'expected a regular file within the size limit');
  return readFileSync(path);
}

export function probe(bytes, options = []) {
  return JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-protocol_whitelist', 'pipe', ...options, '-show_streams', '-show_format', '-of', 'json', '-i', 'pipe:0'], {
    input: bytes, timeout: 15_000, maxBuffer: MB, stdio: ['pipe', 'pipe', 'pipe'],
  }));
}

function audioIsValid(bytes, main) {
  const { streams, format } = probe(bytes);
  const codec = main.endsWith('.m4a') ? 'aac' : 'mp3';
  const container = main.endsWith('.m4a') ? 'm4a' : 'mp3';
  requireThat(format.format_name?.split(',').includes(container) && streams.length === 1 && streams[0].codec_type === 'audio' &&
    streams[0].codec_name === codec, 'main must contain a single AAC or MP3 audio stream');
}

function pictureIsValid(bytes, file, codec) {
  const { streams, format } = probe(bytes);
  const stream = streams[0];
  requireThat(streams.length === 1 && stream.codec_type === 'video' && stream.codec_name === codec && stream.width <= 1920 &&
    stream.height <= 1080 && stream.width > 0 && stream.height > 0 &&
    (codec !== 'h264' || format.format_name?.split(',').includes('mp4')), `${file}: expected a single ${codec} picture stream up to 1920×1080`);
}

function durationOf(path) {
  const result = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-protocol_whitelist', 'file', '-show_entries', 'format=duration', '-of', 'json', path], {
    timeout: 15_000, stdio: ['ignore', 'pipe', 'pipe'],
  }));
  return Number(result.format?.duration);
}

function cssIsValid(bytes) {
  const css = bytes.toString('utf8');
  const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
  requireThat(body.trim() && /^[\x09\x0a\x0d\x20-\x7e]+$/.test(body) &&
    !/[<\\]/.test(css) && !/@(?!keyframes\s)/i.test(body) &&
    !/\b(?:url|(?:-webkit-)?image-set|image|src|paint|element)\s*\(/i.test(body),
  'overlay.css must be local CSS with no external resources or HTML');
}

export function idsIn(root = ROOT) {
  return CATEGORIES.flatMap((cat) => {
    let entries;
    try { entries = readdirSync(join(root, cat), { withFileTypes: true }); }
    catch (error) { if (error.code === 'ENOENT') return []; throw error; }
    return entries.map((entry) => {
      requireThat(entry.isDirectory(), `${cat}/${entry.name}: expected an item directory`);
      return `${cat}/${entry.name}`;
    });
  }).sort();
}

export function inspect(id, { root = ROOT, mediaDir, allowMissing = false } = {}) {
  const [cat, slug, extra] = id.split('/');
  requireThat(CATEGORIES.includes(cat) && SLUG.test(slug ?? '') && id.length < 100 && extra === undefined, 'expected <category>/<slug>');
  const dir = join(root, cat, slug);
  requireThat(lstatSync(join(root, cat)).isDirectory() && lstatSync(dir).isDirectory(), 'item must be a real directory');
  const metadata = fileAt(join(dir, 'item.json'), 32 * 1024);
  const item = JSON.parse(metadata);
  requireThat(exact(item, ITEM_KEYS) && item.cat === cat, 'invalid item.json fields or category');
  requireThat(exact(item.name, LANGUAGES) && LANGUAGES.every((lang) => cleanText(item.name[lang], 1, 60)), 'a name in all five languages is required');
  requireThat(cleanText(item.about, 10, 300), 'about must be 10–300 characters');
  requireThat(Array.isArray(item.tags) && item.tags.length > 0 && item.tags.length <= 12 &&
    item.tags.every((tag) => typeof tag === 'string' && tag.length <= 40 && SLUG.test(tag)) &&
    new Set(item.tags).size === item.tags.length, 'tags must be 1–12 unique lowercase slugs');
  requireThat(typeof item.by === 'string' && /^[a-zA-Z0-9-]{1,39}$/.test(item.by), 'by must be the contributor’s GitHub login');
  requireThat(item.license === 'CC0-1.0', 'CC0-1.0 is required');
  const source = item.source;
  requireThat((exact(source, ['kind']) && source.kind === 'own') ||
    (exact(source, ['kind', 'url']) && source.kind === 'cc0' && https(source.url)), 'provide an original work or its public CC0 source URL');
  requireThat(Number.isSafeInteger(item.version) && item.version >= 1, 'version must be a positive integer');
  requireThat(Number.isInteger(item.durationMs) && item.durationMs >= 1 && item.durationMs <= 3_600_000, 'invalid durationMs');
  const audio = cat === 'sound' || cat === 'music';
  const allowed = audio ? [item.main] : ['overlay.css', 'poster.jpg', 'preview.mp4'];
  requireThat(audio ? typeof item.main === 'string' && /^(sound|music)\.(m4a|mp3)$/.test(item.main) && item.main.startsWith(cat + '.')
    : item.main === 'overlay.css' && item.durationMs <= 10_000, 'invalid main file or overlay duration');
  requireThat(Array.isArray(item.files) && item.files.length === allowed.length &&
    new Set(item.files.map((file) => file?.path)).size === allowed.length, 'missing, duplicate or unexpected files');
  const allowedLocal = new Set(['item.json']);
  const inputs = new Map();
  const missing = [];
  for (const file of item.files) {
    const external = file?.sha256 !== undefined;
    requireThat(exact(file, external ? ['path', 'bytes', 'sha256'] : ['path', 'bytes']) && allowed.includes(file.path), 'invalid file entry');
    requireThat(!external || (audio && typeof file.sha256 === 'string' && HEX.test(file.sha256)), 'only audio can use an external SHA-256');
    const limit = file.path.endsWith('.css') ? 32 * 1024 : cat === 'music' ? 8 * MB : 2 * MB;
    requireThat(Number.isInteger(file.bytes) && file.bytes > 0 && file.bytes <= limit, `${file.path}: invalid size`);
    if (!external) allowedLocal.add(file.path);
    let path;
    if (external) {
      if (mediaDir) path = join(mediaDir, file.sha256);
      if (!path && allowMissing) { missing.push(file.sha256); continue; }
      requireThat(path, `${file.path}: stage the attachment with --media-dir before publishing`);
    } else path = join(dir, file.path);
    const bytes = fileAt(path, limit);
    const sha = hash(bytes);
    requireThat(file.bytes === bytes.length && (!external || file.sha256 === sha), `${file.path}: size or SHA-256 mismatch`);
    inputs.set(file.path, bytes);
    if (audio) {
      audioIsValid(bytes, item.main);
      requireThat(Math.abs(durationOf(path) * 1000 - item.durationMs) <= 150, 'declared audio duration differs from the file');
    } else if (file.path === 'overlay.css') cssIsValid(bytes);
    else if (file.path === 'poster.jpg') pictureIsValid(bytes, file.path, 'mjpeg');
    else {
      pictureIsValid(bytes, file.path, 'h264');
      const length = durationOf(path);
      requireThat(Number.isFinite(length) && length > 0 && length <= 10, 'preview must be at most 10 seconds');
    }
  }
  for (const filename of readdirSync(dir)) requireThat(allowedLocal.has(filename), `unexpected file: ${filename}`);
  // Metadata already contains the digest of external files, so it identifies the reviewed content in both review modes.
  const fingerprint = hash(text([hash(metadata), ...item.files.map((file) => file.sha256 ?? hash(inputs.get(file.path)))]));
  return { id, slug, item, inputs, fingerprint, missing };
}

export function reviewed({ root = ROOT, mediaDir } = {}) {
  const approvals = JSON.parse(fileAt(join(root, 'approvals.json'), MB));
  requireThat(record(approvals), 'approvals.json must be an object');
  const ids = idsIn(root);
  requireThat(Object.keys(approvals).every((id) => ids.includes(id)), 'remove approvals for withdrawn items');
  return ids.map((id) => {
    const entry = inspect(id, { root, mediaDir });
    const approval = approvals[id];
    requireThat(exact(approval, ['fingerprint', 'evidence']) && approval.fingerprint === entry.fingerprint &&
      cleanText(approval.evidence, 12, 2000), `${id}: maintainer approval must record matching fingerprint and provenance evidence`);
    return entry;
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const at = args.indexOf('--media-dir');
  const mediaDir = at < 0 ? undefined : args.splice(at, 2)[1];
  const strict = args.includes('--approved');
  const ids = args.filter((arg) => arg !== '--approved');
  try {
    if (at >= 0 && !mediaDir) throw new Error('--media-dir needs a directory');
    const items = strict ? reviewed({ mediaDir }) : (ids.length ? ids : idsIn()).map((id) => inspect(id, { mediaDir, allowMissing: true }));
    for (const { id, fingerprint, missing } of items) console.log(`${id} ${fingerprint}${missing.length ? ' (attachment pending maintainer verification)' : ''}`);
    console.log(`${items.length} item(s) checked`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
