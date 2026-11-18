import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LANGUAGES, ROOT, hash, probe, reviewed, reviewedPacks, text } from './check.mjs';

const CSP = "default-src 'none'; base-uri 'none'; form-action 'none'; style-src 'unsafe-inline';";
const MAX_ITEMS = 1000;
const MAX_CATALOG = 2 * 1024 * 1024;
const TYPES = {
  mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  webp: 'image/webp', m4a: 'audio/mp4', mp3: 'audio/mpeg', wav: 'audio/wav',
};

// A template's page: its markup and CSS on a page that runs nothing of its own and loads nothing from anywhere.
function page(markup, css, durationMs) {
  const script = `window.film={duration:${durationMs / 1000},frame(){}};`;
  const digest = createHash('sha256').update(script).digest('base64');
  return Buffer.from(`<!doctype html>
<html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${CSP} script-src 'sha256-${digest}'">
<title>OpenFilm community template page</title>
<style>html,body{margin:0;height:100%;overflow:hidden;background:transparent}${css}</style>
</head><body>${markup}<script>${script}</script></body></html>
`);
}

function overlay(css, durationMs) {
  const script = `window.film={duration:${durationMs / 1000},frame(){}};`;
  const digest = createHash('sha256').update(script).digest('base64');
  return Buffer.from(`<!doctype html>
<html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${CSP} script-src 'sha256-${digest}'">
<title>OpenFilm community overlay</title>
<style>${css}</style>
</head><body><div class="l"></div><script>${script}</script></body></html>
`);
}

// Drawn from a file, not a pipe: an M4A with its index at the end cannot be read from a pipe, and gave an empty picture.
// A sticker's idle movement: the same keyframes as Studio's tile (globals.css).
const IDLE = {
  bounce: '@keyframes m{0%,100%{transform:translateY(0)}50%{transform:translateY(-8%)}}img{animation:m 1.2s ease-in-out infinite}',
  wiggle: '@keyframes m{0%,100%{transform:rotate(0)}25%{transform:rotate(-7deg)}75%{transform:rotate(7deg)}}img{animation:m 1.4s ease-in-out infinite}',
  pulse: '@keyframes m{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}img{animation:m 1.2s ease-in-out infinite}',
  float: '@keyframes m{0%,100%{transform:translate(0,0) rotate(-2deg)}50%{transform:translate(0,-5%) rotate(2deg)}}img{animation:m 2.4s ease-in-out infinite}',
  spin: '@keyframes m{to{transform:rotate(360deg)}}img{animation:m 4s linear infinite}',
  pop: '@keyframes m{0%,70%,100%{transform:scale(1)}80%{transform:scale(1.15)}90%{transform:scale(0.95)}}img{animation:m 1.6s ease-out infinite}',
};

function sticker(file, durationMs, idle) {
  const script = `window.film={duration:${durationMs / 1000},frame(){}};`;
  const digest = createHash('sha256').update(script).digest('base64');
  return Buffer.from(`<!doctype html>
<html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; base-uri 'none'; form-action 'none'; img-src 'self'; style-src 'unsafe-inline'; script-src 'sha256-${digest}'">
<title>OpenFilm community sticker</title>
<style>html,body{margin:0;width:100%;height:100%;background:transparent;overflow:hidden}img{display:block;width:100%;height:100%;object-fit:contain}${idle ? IDLE[idle] : ''}</style>
</head><body><img src="${file}" alt=""><script>${script}</script></body></html>
`);
}

function wave(bytes, ext) {
  const dir = mkdtempSync(join(tmpdir(), 'openfilm-wave-'));
  try {
    const input = join(dir, `audio.${ext}`);
    writeFileSync(input, bytes);
    const png = execFileSync('ffmpeg', ['-nostdin', '-v', 'error', '-protocol_whitelist', 'file,pipe', '-i', input,
      '-filter_complex', 'showwavespic=s=960x80:colors=white', '-frames:v', '1', '-c:v', 'png', '-f', 'image2pipe', 'pipe:1'],
    { timeout: 20_000, maxBuffer: 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
    if (!png.length) throw new Error('could not draw a waveform');
    return png;
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

export function build({ root = ROOT, mediaDir, source } = {}) {
  const items = [];
  const blobs = new Map();
  const rows = reviewed({ root, mediaDir });
  if (rows.length > MAX_ITEMS) throw new Error(`Limit of ${MAX_ITEMS} items in one catalog`);
  const revoked = revokedAt(root);
  for (const { id, slug, item, inputs, fingerprint } of rows) {
    if (revoked.has(fingerprint)) throw new Error(`${id}: approved version was revoked`);
    const files = {};
    /** what a kind carries in the catalog beside its files: a text style's vars, a filter's grade, a sticker's size */
    const extra = {};
    function put(path, bytes, type) {
      const sha256 = hash(bytes);
      blobs.set(sha256, { bytes, type });
      files[path] = { sha256, bytes: bytes.length };
    }
    if (item.cat === 'media') {
      // Copied as it is into a folder of the person's own library; a video's poster beside it.
      const ext = item.main.split('.').pop();
      put(`community-media-${slug}.${ext}`, inputs.get(item.main), TYPES[ext]);
      if (item.media === 'video') put('poster.jpg', inputs.get('poster.jpg'), 'image/jpeg');
    } else if (item.cat === 'sound' || item.cat === 'music') {
      const bytes = inputs.get(item.main);
      const ext = item.main.split('.').pop();
      const name = `community-${item.cat}-${slug}`;
      put(`${name}.${ext}`, bytes, ext === 'm4a' ? 'audio/mp4' : 'audio/mpeg');
      put(`waves/${name}.png`, wave(bytes, ext), 'image/png');
    } else if (item.cat === 'template') {
      // A template: OpenFilm's group of clips, its pages markup and CSS on locked pages, its pictures as the slots.
      const tpl = JSON.parse(inputs.get('template.json').toString('utf8'));
      const clips = tpl.clips.map((c) => {
        const clip = c.page
          ? { src: `${c.page}.html`, time: c.time, ...(c.size && { size: c.size }),
            ...((c.place || c.props) && { attrs: { ...(c.place && { 'data-place': JSON.stringify(c.place) }), ...(c.props && { 'data-props': JSON.stringify(c.props) }) } }),
            ...((c.texts || c.fade) && { overrides: [...Object.entries(c.texts ?? {}).map(([at, words]) => ({ at, text: words })), ...(c.fade ? [{ fade: c.fade }] : [])] }) }
          : { src: `${c.picture}.jpg`, time: c.time, style: 'object-fit: cover', ...(c.fade && { overrides: [{ fade: c.fade }] }) };
        return { track: c.track, at: c.at, clip };
      });
      put('saved.json', text({ version: 2, kind: 'group', clips, durationMs: item.durationMs }), 'application/json');
      for (const file of item.files) {
        if (file.path.endsWith('.html')) {
          const name = file.path.slice(0, -5);
          const length = Math.max(...tpl.clips.filter((c) => c.page === name).map((c) => c.time[1]), 1);
          put(`files/${file.path}`, page(inputs.get(file.path).toString('utf8'), inputs.get(`${name}.css`).toString('utf8'), length * 1000), 'text/html; charset=utf-8');
        } else if (file.path.endsWith('.jpg') && file.path !== 'poster.jpg') put(`files/${file.path}`, inputs.get(file.path), 'image/jpeg');
      }
      put('poster.jpg', inputs.get('poster.jpg'), 'image/jpeg');
      put('preview.mp4', inputs.get('preview.mp4'), 'video/mp4');
      extra.slots = item.files.filter((f) => f.path.endsWith('.jpg') && f.path !== 'poster.jpg').length;
    } else if (item.cat === 'text') {
      // A text style is its variables, carried in the catalog itself: OpenFilm's text component draws it.
      extra.vars = JSON.parse(inputs.get('style.json').toString('utf8')).vars;
    } else if (item.cat === 'filter') {
      // A filter is its grade, in the catalog, and the picture it is shown on.
      extra.grade = JSON.parse(inputs.get('grade.json').toString('utf8'));
      put('sample.jpg', inputs.get('sample.jpg'), 'image/jpeg');
    } else if (item.cat === 'sticker') {
      // A sticker: its picture on a page of its own, as large as the picture.
      const ext = item.main.split('.').pop();
      const bytes = inputs.get(item.main);
      const { width: w, height: h } = probe(bytes).streams[0];
      extra.w = w;
      extra.h = h;
      if (item.idle) extra.idle = item.idle;
      put('saved.json', text({ version: 2, kind: 'clip', clip: { src: 'sticker.html', size: { w, h } }, durationMs: item.durationMs }), 'application/json');
      put('files/sticker.html', sticker(`sticker.${ext}`, item.durationMs, item.idle), 'text/html; charset=utf-8');
      put(`files/sticker.${ext}`, bytes, TYPES[ext]);
    } else {
      put('saved.json', text({ version: 2, kind: 'clip', clip: { src: 'overlay.html' }, durationMs: item.durationMs }), 'application/json');
      put('files/overlay.html', overlay(inputs.get('overlay.css').toString('utf8'), item.durationMs), 'text/html; charset=utf-8');
      put('poster.jpg', inputs.get('poster.jpg'), 'image/jpeg');
      put('preview.mp4', inputs.get('preview.mp4'), 'video/mp4');
    }
    const { name, about, tags, by, durationMs = 0, version } = item;
    const revision = hash(text([fingerprint, files]));
    items.push({ id, name, about, tags, by, durationMs, ...(item.cat === 'media' && { media: item.media }), ...extra, version, revision, fingerprint, files });
  }
  const packs = [];
  for (const { id, slug, pack, cover, fingerprint } of reviewedPacks({ root })) {
    if (revoked.has(fingerprint)) throw new Error(`${id}: approved version was revoked`);
    if (cover) blobs.set(hash(cover), { bytes: cover, type: 'image/jpeg' });
    const shown = {
      name: Object.fromEntries(LANGUAGES.map((lang) => [lang, pack.name[lang]])),
      about: pack.about, by: pack.by, license: pack.license, items: pack.items,
      ...(cover && { cover: { sha256: hash(cover), bytes: cover.length } }),
    };
    // Its canonical JSON, its cover by digest: the same pack always has the same revision.
    const revision = hash(text({ id: slug, version: pack.version, ...shown }));
    packs.push({ id: slug, version: pack.version, revision, ...shown });
  }
  // A catalog with no packs is exactly what it was before packs.
  const catalog = text(packs.length ? { version: 1, source, items, packs } : { version: 1, source, items });
  if (catalog.length > MAX_CATALOG) throw new Error('Catalog exceeds 2 MiB');
  return { catalog, blobs, release: hash(catalog) };
}

// Every blob a catalog points to: its items' files and its packs' covers.
export function blobsOf(catalog) {
  return [...catalog.items.flatMap((entry) => Object.values(entry.files)), ...(catalog.packs ?? []).flatMap((pack) => pack.cover ? [pack.cover] : [])];
}

// A published version never changes: an item or pack whose content differs from the active catalog needs a higher version.
export function versionsRaised(before, after) {
  for (const [list, key, prefix] of [['items', 'fingerprint', ''], ['packs', 'revision', 'packs/']]) {
    const prior = new Map((before[list] ?? []).map((entry) => [entry.id, entry]));
    for (const entry of after[list] ?? []) {
      const old = prior.get(entry.id);
      if (old && old[key] !== entry[key] && old.version >= entry.version) throw new Error(`${prefix}${entry.id}: raise its version when changing the reviewed content`);
    }
  }
}

export function revokedAt(root = ROOT) {
  const list = JSON.parse(readFileSync(join(root, 'revoked.json'), 'utf8'));
  if (!Array.isArray(list) || !list.every((value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value))) throw new Error('Invalid revocation list');
  return new Set(list);
}

export const commit = () => execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [, , output, mediaDir] = process.argv;
  if (!output) { console.error('Usage: node scripts/build.mjs <new-output-directory> [staged-media-directory]'); process.exit(2); }
  const { catalog, blobs, release } = build({ source: commit(), mediaDir });
  mkdirSync(output);
  mkdirSync(join(output, 'blobs'));
  writeFileSync(join(output, 'catalog.json'), catalog);
  for (const [key, { bytes }] of blobs) writeFileSync(join(output, 'blobs', key), bytes);
  console.log(`${release} · ${blobs.size} objects`);
}
