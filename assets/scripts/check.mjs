#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const CATEGORIES = ['media', 'sound', 'music', 'transition', 'effect', 'text', 'sticker', 'filter', 'template'];
// Kinds that are data, not a length: a text style's variables, a filter's grade. Their durationMs is 0 or left out.
const TIMELESS = ['text', 'filter'];
// A text style sets the variables of OpenFilm's text component; a sticker is a picture; a filter is a grade.
const TEXT_VAR = /^--[a-z][a-z0-9-]{0,39}$/;
const CURVE_KEYS = ['all', 'r', 'g', 'b'];
// How a sticker may move while it is shown: build.mjs draws the same keyframes on its page.
export const STICKER_IDLE = ['bounce', 'wiggle', 'pulse', 'float', 'spin', 'pop'];
export const LANGUAGES = ['en', 'zh-CN', 'ja', 'ko', 'es'];
export const HEX = /^[a-f0-9]{64}$/;
export const MB = 1024 * 1024;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ITEM_KEYS = ['cat', 'name', 'about', 'tags', 'by', 'license', 'source', 'version', 'files', 'main', 'durationMs'];
const PACK_KEYS = ['name', 'about', 'by', 'license', 'version', 'items'];
// Media: plain files for the person's own library. Its main file is media.<ext>; a video has a poster.jpg beside it.
export const MEDIA = {
  video: { exts: ['mp4', 'mov', 'webm'], max: 50 * MB, ms: 60_000, poster: true, what: 'a video', limit: 'up to 60 seconds' },
  image: { exts: ['jpg', 'jpeg', 'png', 'webp'], max: 10 * MB, ms: 0, poster: false, what: 'an image' },
  audio: { exts: ['m4a', 'mp3', 'wav'], max: 20 * MB, ms: 600_000, poster: false, what: 'audio', limit: 'up to 10 minutes' },
};
const VIDEO_CODECS = { h264: 'H.264', hevc: 'HEVC', vp9: 'VP9', av1: 'AV1' };
const IMAGE_CODECS = { jpg: 'mjpeg', jpeg: 'mjpeg', png: 'png', webp: 'webp' };
const AUDIO_CODECS = { m4a: ['AAC', (codec) => codec === 'aac'], mp3: ['MP3', (codec) => codec === 'mp3'], wav: ['PCM', (codec) => /^pcm_/.test(codec)] };
export const MAX_PACKS = 200;
export const MAX_PACK_ITEMS = 200;
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

// Read from the file, not a pipe: an M4A with its index first ends ffprobe before the pipe is drained (EPIPE).
function audioIsValid(path, main) {
  const { streams, format } = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-protocol_whitelist', 'file', '-show_streams', '-show_format', '-of', 'json', path], {
    timeout: 15_000, maxBuffer: MB, stdio: ['ignore', 'pipe', 'pipe'],
  }));
  const codec = main.endsWith('.m4a') ? 'aac' : 'mp3';
  const container = main.endsWith('.m4a') ? 'm4a' : 'mp3';
  requireThat(format.format_name?.split(',').includes(container) && streams.length === 1 && streams[0].codec_type === 'audio' &&
    streams[0].codec_name === codec, 'main must contain a single AAC or MP3 audio stream');
}

// A sticker: one PNG or WebP picture of at most 1024×1024, with its transparency.
function stickerIsValid(bytes, main) {
  const { streams } = probe(bytes);
  const stream = streams[0];
  requireThat(streams.length === 1 && stream.codec_type === 'video' && stream.codec_name === (main.endsWith('.png') ? 'png' : 'webp') &&
    stream.width > 0 && stream.height > 0 && stream.width <= 1024 && stream.height <= 1024, `${main}: expected one picture of at most 1024×1024`);
}

// A picture or a preview: read from its file when there is one (a video with its index first ends ffprobe before a pipe
// is drained), else from its bytes.
function pictureIsValid(bytes, file, codec, path) {
  const { streams, format } = path ? probeFile(path) : probe(bytes);
  const stream = streams[0];
  requireThat(streams.length === 1 && stream.codec_type === 'video' && stream.codec_name === codec && stream.width <= 1920 &&
    stream.height <= 1080 && stream.width > 0 && stream.height > 0 &&
    (codec !== 'h264' || format.format_name?.split(',').includes('mp4')), `${file}: expected a single ${codec} picture stream up to 1920×1080`);
}

function probeFile(path) {
  return JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-protocol_whitelist', 'file', '-show_streams', '-show_format', '-of', 'json', path], {
    timeout: 15_000, maxBuffer: MB, stdio: ['ignore', 'pipe', 'pipe'],
  }));
}

// A media file is what its name says: the container of its extension, the streams and codecs it allows, its length.
function mediaIsValid(path, item) {
  const { main, media, durationMs } = item;
  const ext = main.split('.').pop();
  const { streams = [], format = {} } = probeFile(path);
  const of = (type) => streams.filter((stream) => stream.codec_type === type);
  if (media === 'image') {
    const [picture] = streams;
    requireThat(streams.length === 1 && picture.codec_type === 'video' && picture.codec_name === IMAGE_CODECS[ext],
      `${main}: expected one ${ext === 'jpeg' ? 'jpg' : ext} picture, as its extension says`);
    requireThat(picture.width > 0 && picture.height > 0 && picture.width <= 8192 && picture.height <= 8192, `${main}: an image is at most 8192 px a side`);
    return;
  }
  requireThat(format.format_name?.split(',').includes(ext), `${main}: the file is not ${ext}, as its extension says`);
  if (media === 'video') {
    const [video] = of('video');
    requireThat(of('video').length === 1 && of('audio').length <= 1 && streams.length === of('video').length + of('audio').length,
      `${main}: expected one video stream and at most one audio stream, nothing else`);
    const codecs = ext === 'webm' ? ['vp9', 'av1'] : Object.keys(VIDEO_CODECS);
    requireThat(codecs.includes(video.codec_name), `${main}: the video must be ${codecs.map((codec) => VIDEO_CODECS[codec]).join(', ')}`);
    requireThat(video.width > 0 && video.height > 0 && Math.max(video.width, video.height) <= 3840 && Math.min(video.width, video.height) <= 2160,
      `${main}: a video is at most 3840×2160`);
  } else {
    const [name, codec] = AUDIO_CODECS[ext];
    requireThat(streams.length === 1 && streams[0].codec_type === 'audio' && codec(streams[0].codec_name), `${main}: expected a single ${name} audio stream`);
  }
  const { ms, what, limit } = MEDIA[media];
  const length = Number(format.duration) * 1000;
  requireThat(Number.isFinite(length) && length > 0 && length <= ms, `${main}: ${what} is ${limit}`);
  requireThat(Math.abs(length - durationMs) <= 150, `${main}: declared durationMs differs from the file`);
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

// A text style's style.json: {"vars": {"--name": "value"}}, values plain CSS with nothing loaded and nothing nested.
export function styleIsValid(bytes) {
  let style;
  try { style = JSON.parse(bytes.toString('utf8')); } catch { style = null; }
  const vars = style?.vars;
  requireThat(exact(style, ['vars']) && record(vars) && Object.keys(vars).length >= 1 && Object.keys(vars).length <= 24 &&
    Object.entries(vars).every(([key, value]) => TEXT_VAR.test(key) && typeof value === 'string' && value.length <= 200 &&
      /^[\x20-\x7e]*$/.test(value) && !/[<>{};\\@]/.test(value) && !/\b(?:url|image-set|image|src|expression|var)\s*\(/i.test(value)),
  'style.json must be {"vars": {...}}: 1–24 variables named --like-this, each a plain CSS value with nothing loaded');
  return style;
}

// A filter's grade.json, as OpenFilm's own looks: a 3×4 colour matrix (mix), saturation (sat), and 17-point curves.
export function gradeIsValid(bytes) {
  let grade;
  try { grade = JSON.parse(bytes.toString('utf8')); } catch { grade = null; }
  const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
  const keys = record(grade) ? Object.keys(grade) : [];
  requireThat(keys.length >= 1 && keys.every((key) => ['mix', 'sat', ...CURVE_KEYS].includes(key)) &&
    (grade.mix === undefined || (Array.isArray(grade.mix) && grade.mix.length === 12 && grade.mix.every((v) => num(v, -4, 4)))) &&
    (grade.sat === undefined || num(grade.sat, 0, 4)) &&
    CURVE_KEYS.every((key) => grade[key] === undefined || (Array.isArray(grade[key]) && grade[key].length === 17 && grade[key].every((v) => num(v, 0, 1)))),
  'grade.json must hold mix (12 numbers), sat (a number) and curves all, r, g, b (17 numbers from 0 to 1 each)');
  return grade;
}

// A template's page: markup only (no scripts, links, pictures or handlers), elements with classes, and its CSS beside it.
const PAGE_TAGS = new Set(['div', 'span', 'p', 'b', 'i', 'em', 'strong', 'small', 'br', 'h1', 'h2', 'h3', 'sup', 'sub', 'u', 's']);
export function pageIsValid(bytes) {
  const html = bytes.toString('utf8');
  const tags = [...html.matchAll(/<\/?([a-zA-Z0-9]+)([^>]*)>/g)];
  requireThat(html.trim() && /^[\x09\x0a\x0d\x20-\x7e\u00a0-\uffff]+$/.test(html) && !/<!|<\?|&#|javascript:/i.test(html) &&
    html.replace(/<\/?[a-zA-Z0-9]+[^>]*>/g, '').indexOf('<') < 0 &&
    tags.every(([, tag, attrs]) => PAGE_TAGS.has(tag.toLowerCase()) && /^(?:\s+class="[a-zA-Z0-9 _-]*")?\s*\/?$/.test(attrs)),
  'a template page is markup only: div, span, p, b, i, em, strong, small, br, h1–h3, sup, sub, u, s, each with at most a class');
}

// A template's template.json: its clips on tracks, each a page of its own or one of its pictures (the slots).
export function templateIsValid(bytes, names) {
  let tpl;
  try { tpl = JSON.parse(bytes.toString('utf8')); } catch { tpl = null; }
  const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
  const clipOk = (c) => record(c) && Object.keys(c).every((k) => ['track', 'at', 'time', 'page', 'picture', 'size', 'place', 'texts', 'fade', 'props'].includes(k)) &&
    Number.isInteger(c.track) && c.track >= 0 && c.track <= 7 && num(c.at, 0, 60) &&
    Array.isArray(c.time) && c.time.length === 2 && num(c.time[0], 0, 60) && num(c.time[1], c.time[0] + 0.05, 60) &&
    ((typeof c.page === 'string' && c.picture === undefined && names.pages.has(c.page)) || (typeof c.picture === 'string' && c.page === undefined && names.pictures.has(c.picture))) &&
    (c.size === undefined || (record(c.size) && exact(c.size, ['w', 'h']) && num(c.size.w, 16, 3840) && num(c.size.h, 16, 3840))) &&
    (c.place === undefined || (record(c.place) && Object.keys(c.place).every((k) => ['x', 'y', 'fit'].includes(k) && num(c.place[k], 0, 1)))) &&
    (c.texts === undefined || (record(c.texts) && Object.entries(c.texts).every(([at, text]) => /^\.[a-z][a-z0-9-]{0,30}$/.test(at) && cleanText(text, 0, 120)))) &&
    (c.fade === undefined || (Array.isArray(c.fade) && c.fade.length === 2 && c.fade.every((v) => num(v, 0, 10)))) &&
    (c.props === undefined || (Array.isArray(c.props) && c.props.length <= 8 && c.props.every((p) => exact(p, ['name', 'type', 'at']) && p.type === 'text' && cleanText(p.name, 1, 40) && /^\.[a-z][a-z0-9-]{0,30}$/.test(p.at))));
  requireThat(exact(tpl, ['clips']) && Array.isArray(tpl.clips) && tpl.clips.length >= 1 && tpl.clips.length <= 40 && tpl.clips.every(clipOk),
    'template.json must be {"clips": [...]}: up to 40 clips, each on a track 0–7 with at and time in seconds, and a page or a picture of the template');
  return tpl;
}

function foldersIn(root, top, what) {
  let entries;
  try { entries = readdirSync(join(root, top), { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  return entries.map((entry) => {
    requireThat(entry.isDirectory(), `${top}/${entry.name}: expected ${what} directory`);
    return `${top}/${entry.name}`;
  });
}

export function idsIn(root = ROOT) {
  return CATEGORIES.flatMap((cat) => foldersIn(root, cat, 'an item')).sort();
}

export const packIdsIn = (root = ROOT) => foldersIn(root, 'packs', 'a pack').sort();

export function inspect(id, { root = ROOT, mediaDir, allowMissing = false } = {}) {
  const [cat, slug, extra] = id.split('/');
  requireThat(CATEGORIES.includes(cat) && SLUG.test(slug ?? '') && id.length < 100 && extra === undefined, 'expected <category>/<slug>');
  const dir = join(root, cat, slug);
  requireThat(lstatSync(join(root, cat)).isDirectory() && lstatSync(dir).isDirectory(), 'item must be a real directory');
  const metadata = fileAt(join(dir, 'item.json'), 32 * 1024);
  const item = JSON.parse(metadata);
  const media = cat === 'media';
  const timeless = TIMELESS.includes(cat);
  // A media item says what it is; an image, a text style and a filter have no length: their durationMs is 0 or left out.
  const optional = ITEM_KEYS.filter((key) => key !== 'durationMs' || Object.hasOwn(item ?? {}, key));
  const keys = media ? [...optional, 'media'] : timeless ? optional : cat === 'sticker' && Object.hasOwn(item ?? {}, 'idle') ? [...ITEM_KEYS, 'idle'] : ITEM_KEYS;
  requireThat(exact(item, keys) && item.cat === cat, 'invalid item.json fields or category');
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
  const audio = cat === 'sound' || cat === 'music';
  let rule;
  if (media) {
    requireThat(Object.hasOwn(MEDIA, item.media), 'media must be "video", "image" or "audio"');
    rule = MEDIA[item.media];
    const names = rule.exts.map((ext) => `media.${ext}`);
    requireThat(names.includes(item.main), `main: ${rule.what} is ${names.slice(0, -1).join(', ')} or ${names.at(-1)}`);
    if (rule.ms) {
      requireThat(Number.isInteger(item.durationMs) && item.durationMs >= 1 && item.durationMs <= rule.ms,
        `durationMs: ${rule.what} is ${rule.limit}; give its length in milliseconds`);
    } else requireThat((item.durationMs ?? 0) === 0, 'durationMs: an image has no length; write 0 or leave it out');
    const paths = Array.isArray(item.files) ? item.files.map((file) => file?.path) : [];
    requireThat(!rule.poster || paths.includes('poster.jpg'), 'a video needs a poster.jpg: a JPEG of at most 1 MiB and 1920×1080');
    requireThat(rule.poster || !paths.includes('poster.jpg'), `poster.jpg is for a video only, not ${rule.what}`);
  } else if (timeless) {
    requireThat((item.durationMs ?? 0) === 0, `durationMs: a ${cat === 'text' ? 'text style' : 'filter'} has no length; write 0 or leave it out`);
    requireThat(item.main === (cat === 'text' ? 'style.json' : 'grade.json'), `main: a ${cat === 'text' ? 'text style is style.json' : 'filter is grade.json'}`);
  } else if (cat === 'template') {
    requireThat(Number.isInteger(item.durationMs) && item.durationMs >= 1000 && item.durationMs <= 60_000, 'durationMs: a template is 1–60 seconds');
    requireThat(item.main === 'template.json', 'main: a template is template.json');
  } else if (cat === 'sticker') {
    requireThat(Number.isInteger(item.durationMs) && item.durationMs >= 1 && item.durationMs <= 10_000, 'durationMs: a sticker is 1–10 000 ms');
    requireThat(item.main === 'sticker.png' || item.main === 'sticker.webp', 'main: a sticker is sticker.png or sticker.webp');
    requireThat(item.idle === undefined || STICKER_IDLE.includes(item.idle), `idle: a sticker moves as ${STICKER_IDLE.join(', ')}, or not at all`);
  } else {
    requireThat(Number.isInteger(item.durationMs) && item.durationMs >= 1 && item.durationMs <= 3_600_000, 'invalid durationMs');
    requireThat(audio ? typeof item.main === 'string' && /^(sound|music)\.(m4a|mp3)$/.test(item.main) && item.main.startsWith(cat + '.')
      : item.main === 'overlay.css' && item.durationMs <= 10_000, 'invalid main file or overlay duration');
  }
  /* a template: its template.json, poster and preview, and its pages (name.html with name.css) and pictures (name.jpg) */
  const tplFile = /^[a-z0-9][a-z0-9-]{0,30}\.(?:html|css|jpg)$/;
  const allowed = cat === 'template'
    ? ['template.json', 'poster.jpg', 'preview.mp4', ...(Array.isArray(item.files) ? item.files.map((file) => file?.path).filter((path) => typeof path === 'string' && tplFile.test(path) && path !== 'poster.jpg') : [])]
    : media ? (rule.poster ? [item.main, 'poster.jpg'] : [item.main]) : audio || cat === 'text' || cat === 'sticker' ? [item.main]
      : cat === 'filter' ? ['grade.json', 'sample.jpg'] : ['overlay.css', 'poster.jpg', 'preview.mp4'];
  requireThat(Array.isArray(item.files) && item.files.length === allowed.length && item.files.length <= 32 &&
    new Set(item.files.map((file) => file?.path)).size === allowed.length, 'missing, duplicate or unexpected files');
  const allowedLocal = new Set(['item.json']);
  const inputs = new Map();
  const missing = [];
  for (const file of item.files) {
    const external = file?.sha256 !== undefined;
    requireThat(exact(file, external ? ['path', 'bytes', 'sha256'] : ['path', 'bytes']) && allowed.includes(file.path), 'invalid file entry');
    requireThat(!external || ((audio || (media && file.path === item.main)) && typeof file.sha256 === 'string' && HEX.test(file.sha256)),
      'only audio and a media file can use an external SHA-256');
    const limit = file.path.endsWith('.css') || file.path.endsWith('.json') || file.path.endsWith('.html') ? 32 * 1024 : media ? (file.path === 'poster.jpg' ? MB : rule.max)
      : cat === 'template' ? (file.path === 'preview.mp4' ? 4 * MB : MB)
      : cat === 'filter' ? MB : cat === 'music' ? 8 * MB : 2 * MB;
    requireThat(Number.isInteger(file.bytes) && file.bytes > 0 && file.bytes <= limit,
      `${file.path}: invalid size${media ? `; it is at most ${limit / MB} MiB` : ''}`);
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
    if (media) {
      if (file.path === 'poster.jpg') pictureIsValid(bytes, file.path, 'mjpeg');
      else mediaIsValid(path, item);
    } else if (audio) {
      audioIsValid(path, item.main);
      requireThat(Math.abs(durationOf(path) * 1000 - item.durationMs) <= 150, 'declared audio duration differs from the file');
    } else if (cat === 'template') {
      if (file.path.endsWith('.html')) pageIsValid(bytes);
      else if (file.path.endsWith('.css')) cssIsValid(bytes);
      else if (file.path.endsWith('.jpg')) pictureIsValid(bytes, file.path, 'mjpeg');
      else if (file.path === 'preview.mp4') {
        pictureIsValid(bytes, file.path, 'h264', path);
        const length = durationOf(path);
        requireThat(Number.isFinite(length) && length > 0 && length <= 60, 'preview must be at most 60 seconds');
      }
    } else if (file.path === 'style.json') styleIsValid(bytes);
    else if (file.path === 'grade.json') gradeIsValid(bytes);
    else if (file.path === 'sample.jpg') pictureIsValid(bytes, file.path, 'mjpeg');
    else if (cat === 'sticker') stickerIsValid(bytes, item.main);
    else if (file.path === 'overlay.css') cssIsValid(bytes);
    else if (file.path === 'poster.jpg') pictureIsValid(bytes, file.path, 'mjpeg');
    else {
      pictureIsValid(bytes, file.path, 'h264', path);
      const length = durationOf(path);
      requireThat(Number.isFinite(length) && length > 0 && length <= 10, 'preview must be at most 10 seconds');
    }
  }
  for (const filename of readdirSync(dir)) requireThat(allowedLocal.has(filename), `unexpected file: ${filename}`);
  if (cat === 'template') {
    // every page has its CSS and is used; every picture is a slot; the clips name only what is here
    const pages = new Set(item.files.filter((f) => f.path.endsWith('.html')).map((f) => f.path.slice(0, -5)));
    const pictures = new Set(item.files.filter((f) => f.path.endsWith('.jpg') && f.path !== 'poster.jpg').map((f) => f.path.slice(0, -4)));
    requireThat([...pages].every((name) => inputs.has(`${name}.css`)) && item.files.filter((f) => f.path.endsWith('.css')).every((f) => pages.has(f.path.slice(0, -4))),
      'each template page is name.html with its name.css');
    templateIsValid(inputs.get('template.json'), { pages, pictures });
  }
  // Metadata already contains the digest of external files, so it identifies the reviewed content in both review modes.
  const fingerprint = hash(text([hash(metadata), ...item.files.map((file) => file.sha256 ?? hash(inputs.get(file.path)))]));
  return { id, slug, item, inputs, fingerprint, missing };
}

// A pack lists items of one contributor under one name: packs/<slug>/pack.json, and an optional cover.jpg.
export function inspectPack(id, { root = ROOT } = {}) {
  const need = (ok, message) => requireThat(ok, `${id}: ${message}`);
  const [top, slug, extra] = id.split('/');
  need(top === 'packs' && SLUG.test(slug ?? '') && slug.length <= 64 && extra === undefined, 'expected packs/<slug>, a slug of at most 64 characters');
  const dir = join(root, 'packs', slug);
  need(lstatSync(join(root, 'packs')).isDirectory() && lstatSync(dir).isDirectory(), 'pack must be a real directory');
  const metadata = fileAt(join(dir, 'pack.json'), 32 * 1024);
  const pack = JSON.parse(metadata);
  const covered = record(pack) && Object.hasOwn(pack, 'cover');
  need(exact(pack, covered ? [...PACK_KEYS, 'cover'] : PACK_KEYS), 'invalid pack.json fields');
  need(exact(pack.name, LANGUAGES) && LANGUAGES.every((lang) => cleanText(pack.name[lang], 1, 60)), 'a name in all five languages is required');
  need(cleanText(pack.about, 10, 300), 'about must be 10–300 characters');
  need(typeof pack.by === 'string' && /^[a-zA-Z0-9-]{1,39}$/.test(pack.by), 'by must be the contributor’s GitHub login');
  need(pack.license === 'CC0-1.0', 'CC0-1.0 is required');
  need(Number.isSafeInteger(pack.version) && pack.version >= 1, 'version must be a positive integer');
  need(Array.isArray(pack.items) && pack.items.length >= 1 && pack.items.length <= MAX_PACK_ITEMS, `a pack lists 1–${MAX_PACK_ITEMS} items`);
  need(new Set(pack.items).size === pack.items.length, 'a pack lists each item once');
  const ids = idsIn(root);
  for (const item of pack.items) {
    need(typeof item === 'string' && ids.includes(item), `${item} is not an item of the library`);
    need(JSON.parse(fileAt(join(root, item, 'item.json'), 32 * 1024)).by === pack.by, `${item} is by someone else; a pack holds its contributor’s own items`);
  }
  const allowed = new Set(['pack.json']);
  let cover;
  if (covered) {
    need(pack.cover === 'cover.jpg', 'cover must be "cover.jpg"');
    let info;
    try { info = lstatSync(join(dir, 'cover.jpg')); } catch {}
    need(info?.isFile() && info.size > 0 && info.size <= MB, 'cover.jpg must be a JPEG of at most 1 MiB');
    cover = readFileSync(join(dir, 'cover.jpg'));
    pictureIsValid(cover, 'cover.jpg', 'mjpeg');
    allowed.add('cover.jpg');
  }
  for (const filename of readdirSync(dir)) need(allowed.has(filename), `unexpected file: ${filename}`);
  const fingerprint = hash(text([hash(metadata), ...(cover ? [hash(cover)] : [])]));
  return { id, slug, pack, cover, fingerprint };
}

export function inspectPacks({ root = ROOT } = {}) {
  const ids = packIdsIn(root);
  requireThat(ids.length <= MAX_PACKS, `Limit of ${MAX_PACKS} packs`);
  const packOf = new Map();
  return ids.map((id) => {
    const entry = inspectPack(id, { root });
    for (const item of entry.pack.items) {
      requireThat(!packOf.has(item), `${item} is in ${packOf.get(item)} and ${id}; an item is in at most one pack`);
      packOf.set(item, id);
    }
    return entry;
  });
}

function approvalsAt(root) {
  const approvals = JSON.parse(fileAt(join(root, 'approvals.json'), MB));
  requireThat(record(approvals), 'approvals.json must be an object');
  const ids = [...idsIn(root), ...packIdsIn(root)];
  requireThat(Object.keys(approvals).every((id) => ids.includes(id)), 'remove approvals for withdrawn items');
  return approvals;
}

function approved(approvals, entry) {
  const approval = approvals[entry.id];
  requireThat(exact(approval, ['fingerprint', 'evidence']) && approval.fingerprint === entry.fingerprint &&
    cleanText(approval.evidence, 12, 2000), `${entry.id}: maintainer approval must record matching fingerprint and provenance evidence`);
  return entry;
}

export function reviewed({ root = ROOT, mediaDir } = {}) {
  const approvals = approvalsAt(root);
  return idsIn(root).map((id) => approved(approvals, inspect(id, { root, mediaDir })));
}

export function reviewedPacks({ root = ROOT } = {}) {
  const approvals = approvalsAt(root);
  return inspectPacks({ root }).map((entry) => approved(approvals, entry));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const at = args.indexOf('--media-dir');
  const mediaDir = at < 0 ? undefined : args.splice(at, 2)[1];
  const strict = args.includes('--approved');
  const ids = args.filter((arg) => arg !== '--approved');
  const packIds = ids.filter((id) => id.startsWith('packs/'));
  const itemIds = ids.filter((id) => !packIds.includes(id));
  try {
    if (at >= 0 && !mediaDir) throw new Error('--media-dir needs a directory');
    const items = strict ? reviewed({ mediaDir }) : (ids.length ? itemIds : idsIn()).map((id) => inspect(id, { mediaDir, allowMissing: true }));
    let packs = [];
    if (strict) packs = reviewedPacks();
    else if (!ids.length || packIds.length) {
      // A pack's rules span every pack, so naming one still checks them all.
      packs = inspectPacks();
      if (ids.length) packs = packIds.map((id) => packs.find((entry) => entry.id === id) ?? inspectPack(id));
    }
    for (const { id, fingerprint, missing } of items) console.log(`${id} ${fingerprint}${missing.length ? ' (attachment pending maintainer verification)' : ''}`);
    for (const { id, fingerprint } of packs) console.log(`${id} ${fingerprint}`);
    console.log(`${items.length} item(s)${packs.length ? ` and ${packs.length} pack(s)` : ''} checked`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
