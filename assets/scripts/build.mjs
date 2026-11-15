import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, hash, reviewed, text } from './check.mjs';

const CSP = "default-src 'none'; base-uri 'none'; form-action 'none'; style-src 'unsafe-inline';";
const MAX_ITEMS = 1000;
const MAX_CATALOG = 2 * 1024 * 1024;

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

function wave(bytes) {
  return execFileSync('ffmpeg', ['-nostdin', '-v', 'error', '-protocol_whitelist', 'pipe', '-i', 'pipe:0',
    '-filter_complex', 'showwavespic=s=960x80:colors=white', '-frames:v', '1', '-c:v', 'png', '-f', 'image2pipe', 'pipe:1'],
  { input: bytes, timeout: 20_000, maxBuffer: 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
}

export function build({ mediaDir, source } = {}) {
  const items = [];
  const blobs = new Map();
  const rows = reviewed({ mediaDir });
  if (rows.length > MAX_ITEMS) throw new Error(`Limit of ${MAX_ITEMS} items in one catalog`);
  const revoked = revokedAt();
  for (const { id, slug, item, inputs, fingerprint } of rows) {
    if (revoked.has(fingerprint)) throw new Error(`${id}: approved version was revoked`);
    const files = {};
    function put(path, bytes, type) {
      const sha256 = hash(bytes);
      blobs.set(sha256, { bytes, type });
      files[path] = { sha256, bytes: bytes.length };
    }
    if (item.cat === 'sound' || item.cat === 'music') {
      const bytes = inputs.get(item.main);
      const ext = item.main.split('.').pop();
      const name = `community-${item.cat}-${slug}`;
      put(`${name}.${ext}`, bytes, ext === 'm4a' ? 'audio/mp4' : 'audio/mpeg');
      put(`waves/${name}.png`, wave(bytes), 'image/png');
    } else {
      put('saved.json', text({ version: 2, kind: 'clip', clip: { src: 'overlay.html' }, durationMs: item.durationMs }), 'application/json');
      put('files/overlay.html', overlay(inputs.get('overlay.css').toString('utf8'), item.durationMs), 'text/html; charset=utf-8');
      put('poster.jpg', inputs.get('poster.jpg'), 'image/jpeg');
      put('preview.mp4', inputs.get('preview.mp4'), 'video/mp4');
    }
    const { name, about, tags, by, durationMs, version } = item;
    const revision = hash(text([fingerprint, files]));
    items.push({ id, name, about, tags, by, durationMs, version, revision, fingerprint, files });
  }
  const catalog = text({ version: 1, source, items });
  if (catalog.length > MAX_CATALOG) throw new Error('Catalog exceeds 2 MiB');
  return { catalog, blobs, release: hash(catalog) };
}

export function revokedAt() {
  const list = JSON.parse(readFileSync(join(ROOT, 'revoked.json'), 'utf8'));
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
