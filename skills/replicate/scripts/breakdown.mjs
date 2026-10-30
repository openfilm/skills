#!/usr/bin/env node
// @ts-check
/**
 * A reference video shot by shot, for remaking it. Beside the video, in references/:
 *   <name>.breakdown.json   the table
 *   <name>.breakdown.html   the same to look at, each shot's first, middle and last frame side by side
 *   <name>.breakdown/       those pictures, shot-01.jpg …
 *
 *   node breakdown.mjs <reference video> [--fps 30]
 *
 * The table, format "openfilm-breakdown/1", every time in the reference's seconds:
 *   { format, source, duration, width, height, fps,
 *     shots: [{ start, end, frames, picture, words, changes: [t], sounds: [t], motion, colour, palette }],
 *     cuts: [t], changes: [{ t, score }], sounds: [{ t, strength }], words: [{ t, end, text }] | null, wordsFrom }
 * A shot's `sounds` are its hits (strength 1 or more); `motion` is how much its picture moves, the mean change from one
 * frame to the next in percent of full scale (under 1 is still); `colour` its mean brightness and saturation (0 to 1)
 * and warmth (red less blue, -1 to 1); `palette` the main colours of its middle frame with their shares. Words are
 * read from the WebVTT beside the video (npx openfilm get asr --src <video>); without one they are null.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative } from 'node:path';
import { meanColour, measure, palette } from './compare.mjs';

const args = process.argv.slice(2);
if (!args.length || args.includes('--help') || args.includes('-h')) {
  console.log('node breakdown.mjs <reference video> [--fps 30]\n\n  Writes <name>.breakdown.json, <name>.breakdown.html and <name>.breakdown/ beside the video: its shots, the frames,\n  motion and colours of each, its words (from the WebVTT beside it, made by npx openfilm get asr --src <video>), where\n  it changes and where its sounds hit. Frames are counted at --fps (30).');
  process.exit(args.length ? 0 : 2);
}
const fpsAt = args.indexOf('--fps');
const fps = fpsAt >= 0 ? Number(args.splice(fpsAt, 2)[1]) : 30;
const video = args[0];
const round = (/** @type {number} */ t, places = 3) => Math.round(t * 10 ** places) / 10 ** places;

/** One frame from each of `times`, side by side, into `out`. */
function strip(/** @type {number[]} */ times, /** @type {string} */ out, /** @type {number} */ w, /** @type {number} */ h) {
  const inputs = times.flatMap((t) => ['-ss', t.toFixed(3), '-i', video]);
  const scaled = times.map((_, i) => `[${i}:v]scale=${w}:${h},setsar=1[p${i}]`).join(';');
  const filter = `${scaled};${times.map((_, i) => `[p${i}]`).join('')}hstack=inputs=${times.length}`;
  return new Promise((ok, fail) => {
    const p = spawn('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', filter, '-frames:v', '1', '-q:v', '4', out], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (b) => { err += b; });
    p.on('error', fail);
    p.on('close', (code) => (code === 0 ? ok(out) : fail(new Error(`ffmpeg: ${err.trim()}`))));
  });
}

const esc = (/** @type {string} */ s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

try {
  const m = await measure(video);
  if (!m.frames.length) throw new Error(`${video}: no frames could be read`);
  const dir = dirname(video), name = basename(video, extname(video));
  const folder = join(dir, `${name}.breakdown`);
  mkdirSync(folder, { recursive: true });
  for (const f of readdirSync(folder)) if (/^shot-\d+\.jpg$/.test(f)) rmSync(join(folder, f));
  /* the picture ends with its last frame, which can come before the sound does */
  const step = m.frames.length > 1 ? (m.frames.at(-1).t - m.frames[0].t) / (m.frames.length - 1) : 1 / fps;
  const last = m.frames.at(-1).t;
  const end = Math.min(m.duration || Infinity, last + step);
  const edges = [0, ...m.cuts.filter((t) => t > 0 && t < end), end];
  const hits = m.sounds.filter((s) => s.strength >= 1);
  const cjk = /\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Hangul}/u.test(m.words?.[0]?.text ?? '');
  const long = 320, w = m.width >= m.height ? long : Math.round(long * m.width / m.height / 2) * 2, h = m.width >= m.height ? Math.round(long * m.height / m.width / 2) * 2 : long;
  const shots = [];
  for (let i = 0; i + 1 < edges.length; i += 1) {
    const start = edges[i], stop = edges[i + 1], inset = Math.min(0.1, (stop - start) / 4);
    const picture = join(folder, `shot-${String(i + 1).padStart(2, '0')}.jpg`);
    await strip([start + inset, (start + stop) / 2, Math.min(last, Math.max(start, stop - inset))], picture, w, h);
    const own = m.frames.filter((f) => f.t >= start && f.t < stop);
    const middle = own[own.length >> 1];
    shots.push({
      start: round(start), end: round(stop), frames: Math.round((stop - start) * fps),
      picture: relative(dir, picture).replace(/\\/g, '/'),
      words: m.words ? m.words.filter((x) => x.t >= start && x.t < stop).map((x) => x.text).join(cjk ? '' : ' ') : null,
      changes: m.changes.filter((c) => c.t > start && c.t < stop).map((c) => round(c.t)),
      sounds: hits.filter((s) => s.t >= start && s.t < stop).map((s) => s.t),
      motion: round(own.slice(1).reduce((s, f) => s + f.mafd, 0) / Math.max(1, own.length - 1), 2),
      colour: meanColour(own),
      palette: middle ? palette(middle.rgb) : [],
    });
  }
  const table = {
    format: 'openfilm-breakdown/1', source: basename(video), duration: round(end), width: m.width, height: m.height, fps,
    shots, cuts: m.cuts.filter((t) => t < end).map((t) => round(t)), changes: m.changes, sounds: m.sounds,
    words: m.words?.map((x) => ({ t: round(x.t), end: round(x.end), text: x.text })) ?? null,
    wordsFrom: m.wordsFrom ? basename(m.wordsFrom) : null,
  };
  const json = join(dir, `${name}.breakdown.json`), html = join(dir, `${name}.breakdown.html`);
  writeFileSync(json, JSON.stringify(table, null, 1));
  const swatches = (/** @type {{ colour: string, share: number }[]} */ p) => p.map((c) => `<span class="sw" style="background:${c.colour};flex:${c.share}" title="${c.colour} ${Math.round(c.share * 100)}%"></span>`).join('');
  const rows = shots.map((s, i) => `<tr><td>${i + 1}</td><td>${s.start.toFixed(2)}–${s.end.toFixed(2)} s<br><small>${s.frames} frames</small></td><td><img src="${esc(s.picture)}" alt="" loading="lazy"><div class="pal">${swatches(s.palette)}</div></td><td>${s.words === null ? '' : esc(s.words)}</td><td>${s.motion}<br><small>${s.colour ? `light ${s.colour.brightness} · sat ${s.colour.saturation} · warm ${s.colour.warmth}` : ''}</small></td><td>${s.changes.map((t) => t.toFixed(2)).join(' ')}</td><td>${s.sounds.map((t) => t.toFixed(2)).join(' ')}</td></tr>`).join('\n');
  writeFileSync(html, `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(table.source)} shot by shot</title>
<style>
body { margin: 24px; font: 14px/1.5 system-ui, sans-serif; color: #1d1d1f; background: #fafafa; }
table { border-collapse: collapse; width: 100%; } th, td { padding: 8px; border-bottom: 1px solid #e3e3e6; text-align: left; vertical-align: top; }
th { position: sticky; top: 0; background: #fafafa; } img { display: block; max-width: ${w * 3}px; width: 100%; border-radius: 4px; }
.pal { display: flex; height: 10px; max-width: ${w * 3}px; margin-top: 4px; border-radius: 2px; overflow: hidden; } .sw { display: block; }
td:nth-child(2) { white-space: nowrap; } td:nth-child(4) { min-width: 12em; } td:nth-child(6), td:nth-child(7) { max-width: 9em; } small, .note { color: #6e6e73; }
</style></head><body>
<h1>${esc(table.source)}</h1>
<p>${table.duration.toFixed(2)} s · ${table.width}×${table.height} · ${shots.length} shots · frames at ${fps} fps · ${hits.length} sound hits</p>
<p class="note">${m.words ? `Words from ${esc(table.wordsFrom ?? '')}.` : `No words yet: npx openfilm get asr --src ${esc(video)}, then run this again.`} Motion: how much the picture moves from frame to frame (under 1 is still). Changes: where the picture changes inside a shot (a word or a thing appears). Sounds: where a sound hits.</p>
<table><thead><tr><th>#</th><th>When</th><th>First · middle · last frame, main colours</th><th>Words</th><th>Motion, colour</th><th>Changes (s)</th><th>Sounds (s)</th></tr></thead>
<tbody>
${rows}
</tbody></table>
</body></html>
`);
  console.log(`${shots.length} shots, ${m.changes.length} changes, ${hits.length} sound hits, ${m.words ? `${m.words.length} words` : 'no words (npx openfilm get asr --src ' + video + ')'}\n${json}\n${html}`);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(2);
}
