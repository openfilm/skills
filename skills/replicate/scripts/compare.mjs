#!/usr/bin/env node
// @ts-check
/**
 * How close a film is to the video it replicates, in frames, and whether any of the reference got into it.
 *
 *   node compare.mjs <reference video> <film video> [--fps 30] [--no-scale] [--film <film.html>] [--json <file>]
 *
 * Both videos get the same measurements: where the picture cuts, where it changes inside a shot (a word or a thing
 * appears), where a sound hits, and when each word is said, read from the WebVTT beside the video as
 * `openfilm get asr` writes it (for the film, else from the transcripts of its clips in film.html). Each moment of the
 * reference is paired with the film's nearest, the film's times scaled when the two lengths differ, and the gap is
 * reported in frames. Then what must never be in the film: a frame of the reference (a perceptual hash, then a pixel
 * check), a stretch of its sound (spectral landmarks), a clip whose file is the reference; and how many of its words
 * the film repeats. Exits 1 when a picture, a sound or a file of the reference is in the film.
 *
 * Needs ffmpeg and ffprobe on the PATH, as OpenFilm does. `measure()` is what breakdown.mjs writes into references/.
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Frames are read squeezed to SIDE×SIDE. */
const SIDE = 256;
/** Sound: 16 kHz mono, a 32 ms window every 10 ms. */
const RATE = 16000, WIN = 512, HOP = 160, BINS = WIN / 2 + 1;
/** Scene score, in percent of full scale, for a cut and for a change inside a shot. */
const CUT = 6, CHANGE = 0.5;
/** A sound hit: an onset at least this strong (1 = the 99th percentile of the onset curve). */
const HIT = 1;
/** A leaked frame: hashes this close (of 63 bits), then high-passed pixels this alike, on a frame with this much detail. */
const HASH_NEAR = 12, PIXEL_ALIKE = 0.8, DETAIL = 6;
/** A leaked sound: this many landmarks at one offset within LEAK_SPAN seconds. */
const LANDMARKS = 12, LEAK_SPAN = 3;
/** A run of shared words worth reporting, in characters (CJK) or words. */
const RUN_CJK = 12, RUN_WORDS = 8;

/**
 * @typedef {{ t: number, end: number, text: string }} Word
 * @typedef {{ t: number, mafd: number, hash: Uint32Array, cropHash?: Uint32Array, small: Uint8Array, cropSmall?: Uint8Array }} Frame
 * @typedef {{ x: number, y: number, w: number, h: number }} Crop
 */

/** A tool's output; `onData` takes stdout as it comes instead. @param {string} cmd @param {string[]} args @param {(b: Buffer) => void} [onData] */
function run(cmd, args, onData) {
  return new Promise((ok, fail) => {
    const p = spawn(cmd, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    /** @type {Buffer[]} */ const out = [];
    /** @type {Buffer[]} */ const err = [];
    p.stdout.on('data', (b) => (onData ? onData(b) : out.push(b)));
    p.stderr.on('data', (b) => err.push(b));
    p.on('error', (e) => fail(/** @type {any} */ (e).code === 'ENOENT' ? new Error(`${cmd} is not on the PATH (OpenFilm needs ffmpeg and ffprobe)`) : e));
    p.on('close', (code) => {
      const said = Buffer.concat(err).toString();
      if (code === 0) ok({ out: Buffer.concat(out), err: said });
      else fail(new Error(`${cmd} ${args.includes('-i') ? args[args.indexOf('-i') + 1] : ''}: ${said.trim().split('\n').slice(-2).join(' ')}`));
    });
  });
}

/** Length, picture size as shown (turned phone videos turned) and whether it has sound. @param {string} file */
export async function probe(file) {
  const { out } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height:stream_side_data=rotation:stream_tags=rotate', '-of', 'json', file]);
  const info = JSON.parse(out.toString());
  const video = info.streams?.find((/** @type {any} */ s) => s.codec_type === 'video');
  if (!video) throw new Error(`${file} has no picture`);
  const turn = Math.abs(Number(video.side_data_list?.find((/** @type {any} */ d) => d.rotation !== undefined)?.rotation ?? video.tags?.rotate ?? 0)) % 180 === 90;
  return {
    duration: Number(info.format?.duration) || 0,
    width: turn ? video.height : video.width,
    height: turn ? video.width : video.height,
    sound: info.streams.some((/** @type {any} */ s) => s.codec_type === 'audio'),
  };
}

/** Box-averages `crop` of a size×size channel-interleaved picture into out×out, one channel. */
function shrink(/** @type {Uint8Array} */ src, size, channels, channel, /** @type {Crop} */ crop, out) {
  const dst = new Uint8Array(out * out);
  const x0 = crop.x * size, y0 = crop.y * size, cw = crop.w * size / out, ch = crop.h * size / out;
  for (let oy = 0; oy < out; oy += 1) {
    const ya = Math.floor(y0 + oy * ch), yb = Math.max(ya + 1, Math.floor(y0 + (oy + 1) * ch));
    for (let ox = 0; ox < out; ox += 1) {
      const xa = Math.floor(x0 + ox * cw), xb = Math.max(xa + 1, Math.floor(x0 + (ox + 1) * cw));
      let sum = 0;
      for (let y = ya; y < yb; y += 1) for (let x = xa; x < xb; x += 1) sum += src[(y * size + x) * channels + channel];
      dst[oy * out + ox] = Math.round(sum / ((yb - ya) * (xb - xa)));
    }
  }
  return dst;
}

const COS = Array.from({ length: 8 }, (_, k) => Float64Array.from({ length: 32 }, (_, n) => Math.cos(Math.PI * (2 * n + 1) * k / 64)));

/** A 63-bit perceptual hash (the lowest 8×8 DCT terms against their median, DC left out) of a 32×32 picture. */
function phash(/** @type {Uint8Array} */ px) {
  const rows = new Float64Array(32 * 8);
  for (let y = 0; y < 32; y += 1) for (let k = 0; k < 8; k += 1) {
    let s = 0;
    for (let x = 0; x < 32; x += 1) s += px[y * 32 + x] * COS[k][x];
    rows[y * 8 + k] = s;
  }
  const terms = new Float64Array(64);
  for (let ky = 0; ky < 8; ky += 1) for (let kx = 0; kx < 8; kx += 1) {
    let s = 0;
    for (let y = 0; y < 32; y += 1) s += COS[ky][y] * rows[y * 8 + kx];
    terms[ky * 8 + kx] = s;
  }
  const median = [...terms.subarray(1)].sort((a, b) => a - b)[31];
  const hash = new Uint32Array(2);
  for (let i = 1; i < 64; i += 1) if (terms[i] > median) hash[i >> 5] |= 1 << (i & 31);
  return hash;
}

const bits = (/** @type {number} */ v) => { v -= (v >>> 1) & 0x55555555; v = (v & 0x33333333) + ((v >>> 2) & 0x33333333); return (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24; };
const distance = (/** @type {Uint32Array} */ a, /** @type {Uint32Array} */ b) => bits(a[0] ^ b[0]) + bits(a[1] ^ b[1]);

/** Every frame: its time, how much it moved from the last, its hash and a 48×48 grey copy; `crop` adds the same of that part. @param {string} file @param {Crop} [crop] */
async function pictures(file, crop) {
  const size = SIDE * SIDE * 3;
  /** @type {Omit<Frame, 't'>[]} */
  const frames = [];
  let last = /** @type {Uint8Array | null} */ (null);
  let held = Buffer.alloc(0);
  const whole = { x: 0, y: 0, w: 1, h: 1 };
  const take = (/** @type {Uint8Array} */ rgb) => {
    const grey = new Uint8Array(SIDE * SIDE);
    for (let i = 0; i < grey.length; i += 1) grey[i] = (rgb[i * 3] * 77 + rgb[i * 3 + 1] * 150 + rgb[i * 3 + 2] * 29) >> 8;
    const coarse = new Uint8Array(32 * 32 * 3);
    for (let c = 0; c < 3; c += 1) shrink(rgb, SIDE, 3, c, whole, 32).forEach((v, i) => { coarse[i * 3 + c] = v; });
    let mafd = 0;
    if (last) {
      for (let i = 0; i < coarse.length; i += 1) mafd += Math.abs(coarse[i] - last[i]);
      mafd = mafd / coarse.length / 255 * 100;
    }
    last = coarse;
    const frame = { mafd, hash: phash(shrink(grey, SIDE, 1, 0, whole, 32)), small: shrink(grey, SIDE, 1, 0, whole, 48) };
    if (crop) Object.assign(frame, { cropHash: phash(shrink(grey, SIDE, 1, 0, crop, 32)), cropSmall: shrink(grey, SIDE, 1, 0, crop, 48) });
    frames.push(frame);
  };
  const { err } = await run('ffmpeg', ['-nostats', '-hide_banner', '-i', file, '-an', '-sn', '-dn',
    '-vf', `scale=${SIDE}:${SIDE}:flags=area,format=rgb24,showinfo`, '-fps_mode', 'passthrough', '-f', 'rawvideo', 'pipe:1'], (chunk) => {
    held = held.length ? Buffer.concat([held, chunk]) : chunk;
    let at = 0;
    for (; at + size <= held.length; at += size) take(held.subarray(at, at + size));
    held = held.subarray(at);
  });
  const times = [...err.matchAll(/\bn:\s*\d+\s+pts:\s*-?\d+\s+pts_time:(-?[\d.]+)/g)].map((m) => Number(m[1]));
  return frames.map((f, i) => ({ ...f, t: times[i] ?? (i > 0 ? times[i - 1] : 0) }));
}

/**
 * Cuts and changes inside shots, from how much each frame moved: ffmpeg's scene score, min(moved, change in moved),
 * with a lone repeated frame (a frame rate made up to) not counted as a stop.
 * @param {Frame[]} frames
 */
function scenes(frames) {
  const score = new Float64Array(frames.length);
  let before = 0, still = 0;
  for (let i = 1; i < frames.length; i += 1) {
    const m = frames[i].mafd;
    if (m < 0.05) { still += 1; if (still >= 2) before = 0; continue; }
    still = 0;
    score[i] = Math.min(m, Math.abs(m - before));
    before = m;
  }
  /** @type {number[]} */
  const cuts = [], changes = [];
  for (let i = 1; i < frames.length; i += 1) {
    if (score[i] >= CUT) {
      /* a cut that takes a few frames is one cut, at its biggest jump */
      const last = cuts[cuts.length - 1];
      if (last !== undefined && i - last <= 3) { if (score[i] > score[last]) cuts[cuts.length - 1] = i; }
      else cuts.push(i);
      continue;
    }
    if (score[i] < CHANGE) continue;
    let peak = true;
    for (let j = Math.max(1, i - 2); j <= Math.min(frames.length - 1, i + 2); j += 1) if (j !== i && score[j] > score[i]) peak = false;
    if (peak) changes.push(i);
  }
  const nearCut = (/** @type {number} */ i) => cuts.some((c) => Math.abs(c - i) <= 3);
  return {
    cuts: cuts.map((i) => frames[i].t),
    changes: changes.filter((i) => !nearCut(i)).map((i) => ({ t: frames[i].t, score: round(score[i], 2) })),
  };
}

/** In place, the FFT of re + i·im (length a power of two). */
function fft(/** @type {Float64Array} */ re, /** @type {Float64Array} */ im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k += 1) {
        const p = i + k, q = p + len / 2;
        const tr = re[q] * cr - im[q] * ci, ti = re[q] * ci + im[q] * cr;
        re[q] = re[p] - tr; im[q] = im[p] - ti; re[p] += tr; im[p] += ti;
        [cr, ci] = [cr * wr - ci * wi, cr * wi + ci * wr];
      }
    }
  }
}

/** Log magnitudes, one row of BINS per 10 ms step. @param {string} file */
async function spectrum(file) {
  const { out } = await run('ffmpeg', ['-v', 'error', '-i', file, '-vn', '-sn', '-dn', '-ac', '1', '-ar', String(RATE), '-f', 'f32le', 'pipe:1']);
  const n = out.length >> 2;
  const steps = n >= WIN ? Math.floor((n - WIN) / HOP) + 1 : 0;
  const mags = new Float32Array(steps * BINS);
  const hann = Float64Array.from({ length: WIN }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / WIN));
  const re = new Float64Array(WIN), im = new Float64Array(WIN);
  for (let s = 0; s < steps; s += 1) {
    for (let i = 0; i < WIN; i += 1) { re[i] = out.readFloatLE((s * HOP + i) * 4) * hann[i]; im[i] = 0; }
    fft(re, im);
    for (let f = 0; f < BINS; f += 1) mags[s * BINS + f] = Math.log1p(100 * Math.hypot(re[f], im[f]) / (WIN / 2));
  }
  return { steps, mags };
}

/** The step's time: the middle of its window. */
const stepTime = (/** @type {number} */ s) => (s * HOP + WIN / 2) / RATE;

/** Where sounds start, each with its strength (1 = the 99th percentile of the onset curve). */
function onsets(/** @type {{ steps: number, mags: Float32Array }} */ { steps, mags }) {
  const flux = new Float64Array(steps);
  for (let s = 2; s < steps; s += 1) {
    let sum = 0;
    for (let f = 1; f < BINS - 1; f += 1) {
      const b = (s - 2) * BINS + f;
      const d = mags[s * BINS + f] - Math.max(mags[b - 1], mags[b], mags[b + 1]);
      if (d > 0) sum += d;
    }
    flux[s] = sum;
  }
  const top = [...flux].sort((a, b) => a - b)[Math.floor(steps * 0.99)] || 1;
  /** @type {{ t: number, strength: number }[]} */
  const found = [];
  let lastAt = -Infinity;
  for (let s = 3; s < steps - 3; s += 1) {
    let peak = true, mean = 0, count = 0;
    for (let j = s - 3; j <= s + 3; j += 1) if (flux[j] > flux[s]) peak = false;
    if (!peak) continue;
    for (let j = Math.max(0, s - 10); j <= Math.min(steps - 1, s + 3); j += 1) { mean += flux[j]; count += 1; }
    if (flux[s] < mean / count + 0.07 * top || s - lastAt < 5) continue;
    found.push({ t: round(stepTime(s), 3), strength: round(flux[s] / top, 2) });
    lastAt = s;
  }
  return found;
}

/** Spectral landmarks: pairs of peaks, as key → the steps where they start. */
function landmarks(/** @type {{ steps: number, mags: Float32Array }} */ { steps, mags }) {
  /** @type {{ s: number, f: number, v: number }[][]} */
  const byStep = [];
  for (let s = 0; s < steps; s += 1) {
    const row = mags.subarray(s * BINS, (s + 1) * BINS);
    const mean = row.reduce((a, b) => a + b, 0) / BINS;
    const local = [];
    for (let f = 6; f < 200; f += 1) {
      if (row[f] < mean + 0.5) continue;
      let peak = true;
      for (let g = f - 3; g <= f + 3; g += 1) if (g !== f && row[g] >= row[f]) peak = false;
      if (peak) local.push({ s, f, v: row[f] });
    }
    byStep.push(local.sort((a, b) => b.v - a.v).slice(0, 5));
  }
  const kept = [];
  for (let s = 0; s < steps; s += 1) for (const p of byStep[s]) {
    let best = true;
    for (let r = Math.max(0, s - 4); r <= Math.min(steps - 1, s + 4) && best; r += 1) {
      for (const q of byStep[r]) if (q !== p && Math.abs(q.f - p.f) <= 3 && q.v > p.v) { best = false; break; }
    }
    if (best) kept.push(p);
  }
  /** @type {Map<number, number[]>} */
  const keys = new Map();
  for (let i = 0; i < kept.length; i += 1) {
    let made = 0;
    for (let j = i + 1; j < kept.length && made < 5; j += 1) {
      const dt = kept[j].s - kept[i].s;
      if (dt > 48) break;
      if (dt < 2 || Math.abs(kept[j].f - kept[i].f) > 32) continue;
      const key = (kept[i].f << 14) | (kept[j].f << 6) | dt;
      const list = keys.get(key);
      if (list) list.push(kept[i].s); else keys.set(key, [kept[i].s]);
      made += 1;
    }
  }
  return keys;
}

/** `00:00:01.250` or `00:01.250` → seconds. */
const seconds = (/** @type {string} */ stamp) => {
  const parts = stamp.trim().split(':').map(Number);
  return parts.length < 2 || parts.some((n) => !Number.isFinite(n)) ? NaN : parts.reduce((acc, n) => acc * 60 + n, 0);
};

/** The words a WebVTT times: a cue's timestamp tags start its words; a cue without them is one. @param {string} body */
export function vttWords(body) {
  /** @type {Word[]} */
  const words = [];
  for (const block of body.replace(/^﻿/, '').replace(/\r/g, '').split(/\n{2,}/)) {
    const rows = block.split('\n');
    const timing = rows.findIndex((r) => r.includes('-->'));
    if (timing < 0 || /^(NOTE|STYLE|REGION)\b/.test(rows[0] ?? '')) continue;
    const [a, b] = rows[timing].split('-->');
    const start = seconds(a), end = seconds(b.trim().split(/\s+/)[0] ?? '');
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    /** @type {Word[]} */
    const cue = [];
    let at = start, fresh = true;
    for (const [, tag, chunk] of rows.slice(timing + 1).join(' ').matchAll(/<([^>]*)>|([^<]+)/g)) {
      if (tag !== undefined) {
        const s = seconds(tag);
        if (Number.isFinite(s)) { at = s; fresh = true; }
        continue;
      }
      const text = chunk.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
      if (!text.trim()) continue;
      if (fresh || !cue.length) cue.push({ t: at, end, text: text.trim() });
      else cue[cue.length - 1].text += text;
      fresh = false;
    }
    cue.forEach((w, i) => { w.end = i + 1 < cue.length ? cue[i + 1].t : Math.max(end, w.t); w.text = w.text.replace(/\s+/g, ' ').trim(); });
    words.push(...cue);
  }
  return words.sort((x, y) => x.t - y.t);
}

/** A media file's transcript: the WebVTT beside it with the same name. @param {string} file */
export const transcriptOf = (file) => file.slice(0, file.length - extname(file).length) + '.vtt';

/** film.html's clips: element, file (relative to film.html), in and out points, place, speed, heard. @param {string} html */
function clips(html) {
  const body = readFileSync(html, 'utf8');
  const out = [];
  for (const [, track, inner] of body.matchAll(/<section\b([^>]*)>([\s\S]*?)<\/section>/g)) {
    const off = /(?:^|\s)(hidden|muted)(?=[\s=>]|$)/.test(track);
    for (const [, tag, attrs] of inner.matchAll(/<(iframe|video|img|audio)\b([^>]*)>/g)) {
      const attr = (/** @type {string} */ name) => {
        const m = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`).exec(attrs);
        return m ? (m[1] ?? m[2] ?? m[3]) : undefined;
      };
      const src = attr('src');
      if (!src) continue;
      const [path, fragment = ''] = src.split('#');
      const t = /t=([\d.]*)(?:,([\d.]+))?/.exec(fragment);
      out.push({
        tag, path: decodeURI(path), from: Number(t?.[1] || 0), to: t?.[2] ? Number(t[2]) : Infinity,
        at: Number(attr('at') ?? 0), speed: Number(attr('speed') ?? 1),
        heard: !off && !/(?:^|\s)muted(?=[\s=>]|$)/.test(attrs),
      });
    }
  }
  return out;
}

/** The film's words: its clips' transcripts, placed where the clips play. @param {string} html */
function filmWords(html) {
  /** @type {Word[]} */
  const words = [];
  for (const c of clips(html)) {
    if (!c.heard || (c.tag !== 'audio' && c.tag !== 'video')) continue;
    const vtt = join(dirname(html), transcriptOf(c.path));
    if (!existsSync(vtt)) continue;
    for (const w of vttWords(readFileSync(vtt, 'utf8'))) {
      if (w.t < c.from || w.t >= c.to) continue;
      words.push({ text: w.text, t: c.at + (w.t - c.from) / c.speed, end: c.at + (Math.min(w.end, c.to) - c.from) / c.speed });
    }
  }
  return words.sort((a, b) => a.t - b.t);
}

/** film.html for a film video: --film, else the folder it is in or one above it, else the working folder. @param {string} video */
function findFilm(video) {
  for (let dir = dirname(resolve(video)); ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'film.html'))) return join(dir, 'film.html');
    if (dirname(dir) === dir) break;
  }
  return existsSync('film.html') ? resolve('film.html') : null;
}

const round = (/** @type {number} */ v, /** @type {number} */ places) => Math.round(v * 10 ** places) / 10 ** places;

/**
 * Everything measured of one video. `crop` also hashes that part of each frame, to find one video shown inside the
 * other (cropped to fill, or fitted whole with bars).
 * @param {string} file @param {{ crop?: Crop, words?: Word[], wordsFrom?: string }} [options]
 */
export async function measure(file, { crop, words, wordsFrom } = {}) {
  if (!existsSync(file)) throw new Error(`${file}: no such file`);
  const info = await probe(file);
  const frames = await pictures(file, crop);
  const { cuts, changes } = scenes(frames);
  const heard = info.sound ? await spectrum(file) : { steps: 0, mags: new Float32Array() };
  const vtt = transcriptOf(file);
  if (!words && existsSync(vtt)) { words = vttWords(readFileSync(vtt, 'utf8')); wordsFrom = vtt; }
  return {
    file, ...info, frames, cuts, changes, sounds: onsets(heard), landmarks: landmarks(heard),
    words: words ?? null, wordsFrom: wordsFrom ?? null,
  };
}

/** Each reference moment paired with the film's nearest within `within` seconds, closest pairs first. */
function pair(/** @type {number[]} */ ref, /** @type {number[]} */ film, /** @type {number} */ within) {
  const pairs = [];
  for (let i = 0; i < ref.length; i += 1) for (let j = 0; j < film.length; j += 1) {
    const d = film[j] - ref[i];
    if (Math.abs(d) <= within) pairs.push({ i, j, d });
  }
  pairs.sort((a, b) => Math.abs(a.d) - Math.abs(b.d));
  /** @type {Map<number, number>} */
  const matched = new Map();
  const used = new Set();
  for (const { i, j, d } of pairs) if (!matched.has(i) && !used.has(j)) { matched.set(i, d); used.add(j); }
  return { matched, missing: ref.filter((_, i) => !matched.has(i)), extra: film.filter((_, j) => !used.has(j)) };
}

/** The tokens words are compared by: each CJK character, each other word, lowercased, no punctuation. @param {Word[]} words */
function tokens(words) {
  const out = [];
  for (const w of words) for (const m of w.text.toLowerCase().matchAll(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]|[\p{L}\p{N}]+/gu)) out.push({ text: m[0], t: w.t, cjk: m[0].length === 1 && /[^\p{Script=Latin}\p{N}]/u.test(m[0]) });
  return out;
}

/** How much of the film's wording is the reference's: its shared 6-token runs, and the longest run. */
function sharedWords(/** @type {Word[]} */ ref, /** @type {Word[]} */ film) {
  const a = tokens(ref), b = tokens(film);
  const grams = (/** @type {{ text: string }[]} */ list) => list.slice(0, Math.max(0, list.length - 5)).map((_, i) => list.slice(i, i + 6).map((x) => x.text).join(' '));
  const refGrams = new Set(grams(a));
  const filmGrams = grams(b);
  const shared = filmGrams.filter((g) => refGrams.has(g)).length;
  let best = { length: 0, i: 0, j: 0 };
  let prev = new Uint32Array(b.length + 1);
  for (let i = 1; i <= a.length; i += 1) {
    const row = new Uint32Array(b.length + 1);
    for (let j = 1; j <= b.length; j += 1) {
      if (a[i - 1].text !== b[j - 1].text) continue;
      row[j] = prev[j - 1] + 1;
      if (row[j] > best.length) best = { length: row[j], i: i - row[j], j: j - row[j] };
    }
    prev = row;
  }
  const run = b.slice(best.j, best.j + best.length);
  const cjk = run.filter((x) => x.cjk).length > run.length / 2;
  return {
    share: filmGrams.length ? shared / filmGrams.length : 0,
    run: run.map((x) => x.text).join(cjk ? '' : ' '), runLength: best.length, cjk,
    filmAt: run[0]?.t ?? 0, refAt: a[best.i]?.t ?? 0,
    tooLong: best.length >= (cjk ? RUN_CJK : RUN_WORDS),
  };
}

/** High-passed copy of a 48×48 grey picture (itself less its 3×3 blur), and how much detail it has. */
function highPass(/** @type {Uint8Array} */ px) {
  const out = new Float32Array(48 * 48);
  let energy = 0;
  for (let y = 0; y < 48; y += 1) for (let x = 0; x < 48; x += 1) {
    let sum = 0, n = 0;
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
      const yy = y + dy, xx = x + dx;
      if (yy < 0 || yy >= 48 || xx < 0 || xx >= 48) continue;
      sum += px[yy * 48 + xx]; n += 1;
    }
    const v = px[y * 48 + x] - sum / n;
    out[y * 48 + x] = v;
    energy += v * v;
  }
  return { px: out, detail: energy / out.length };
}

const alike = (/** @type {Float32Array} */ a, /** @type {Float32Array} */ b) => {
  let ab = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i += 1) { ab += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i]; }
  return aa && bb ? ab / Math.sqrt(aa * bb) : 0;
};

/** Film frames that are frames of the reference, whole or cropped either way, as spans. */
function leakedPictures(/** @type {Frame[]} */ ref, /** @type {Frame[]} */ film) {
  const cache = new Map();
  const hp = (/** @type {Uint8Array} */ px) => { let v = cache.get(px); if (!v) cache.set(px, (v = highPass(px))); return v; };
  /** @type {{ t: number, refT: number, score: number }[]} */
  const hits = [];
  for (const f of film) {
    let best = { score: 0, refT: 0 };
    const ways = [[f.hash, f.small, 'hash', 'small'], [f.hash, f.small, 'cropHash', 'cropSmall'], [f.cropHash, f.cropSmall, 'hash', 'small']];
    for (const [hash, small, refHash, refSmall] of /** @type {any[]} */ (ways)) {
      if (!hash) continue;
      const mine = hp(small);
      if (mine.detail < DETAIL) continue;
      for (const r of ref) {
        if (!r[refHash] || distance(hash, r[refHash]) > HASH_NEAR) continue;
        const theirs = hp(r[refSmall]);
        if (theirs.detail < DETAIL) continue;
        const score = alike(mine.px, theirs.px);
        if (score > best.score) best = { score, refT: r.t };
      }
    }
    if (best.score >= PIXEL_ALIKE) hits.push({ t: f.t, refT: best.refT, score: best.score });
  }
  return spans(hits, 0.25);
}

/** Times within `gap` of each other, as spans: where they are in the reference, how many, their best score. */
function spans(/** @type {{ t: number, refT: number, score: number }[]} */ hits, /** @type {number} */ gap) {
  /** @type {{ from: number, to: number, refFrom: number, count: number, score: number }[]} */
  const out = [];
  for (const h of hits.sort((a, b) => a.t - b.t)) {
    const last = out[out.length - 1];
    if (last && h.t - last.to <= gap) { last.to = h.t; last.count += 1; last.score = Math.max(last.score, h.score); }
    else out.push({ from: h.t, to: h.t, refFrom: h.refT, count: 1, score: h.score });
  }
  return out;
}

/** Stretches of the film whose sound is the reference's: many landmarks at one offset. */
function leakedSound(/** @type {Map<number, number[]>} */ ref, /** @type {Map<number, number[]>} */ film) {
  /** @type {Map<number, number[]>} */
  const byOffset = new Map();
  for (const [key, steps] of film) {
    const theirs = ref.get(key);
    if (!theirs) continue;
    for (const s of steps) for (const r of theirs) {
      const off = r - s;
      const list = byOffset.get(off);
      if (list) list.push(s); else byOffset.set(off, [s]);
    }
  }
  const span = LEAK_SPAN * RATE / HOP;
  const hits = [];
  for (const [off, steps] of byOffset) {
    const near = [...new Set([...steps, ...(byOffset.get(off - 1) ?? []), ...(byOffset.get(off + 1) ?? [])])].sort((a, b) => a - b);
    if (near.length < LANDMARKS) continue;
    const inside = new Uint8Array(near.length);
    for (let i = 0, j = 0; j < near.length; j += 1) {
      while (near[j] - near[i] > span) i += 1;
      if (j - i + 1 >= LANDMARKS) inside.fill(1, i, j + 1);
    }
    near.forEach((s, k) => { if (inside[k]) hits.push({ t: stepTime(s), refT: stepTime(s + off), score: 1 }); });
  }
  return spans(hits, LEAK_SPAN).map((s) => ({ ...s, to: s.to + WIN / RATE }));
}

/** Clips in film.html that are the reference itself: under references/, or the same bytes. */
function leakedFiles(/** @type {string} */ html, /** @type {string} */ reference) {
  const dir = dirname(html);
  const size = statSync(reference).size;
  const digest = (/** @type {string} */ f) => createHash('sha1').update(readFileSync(f)).digest('hex');
  let refDigest = '';
  const found = [];
  for (const c of clips(html)) {
    const file = resolve(dir, c.path);
    const rel = relative(dir, file).replace(/\\/g, '/');
    if (rel.startsWith('references/') || file === resolve(reference)) { found.push(rel); continue; }
    if (!existsSync(file) || statSync(file).size !== size) continue;
    refDigest ||= digest(reference);
    if (digest(file) === refDigest) found.push(rel);
  }
  return [...new Set(found)];
}

const fmt = (/** @type {number} */ t) => t.toFixed(2);

/** The compare report: lines of text, and the numbers. */
export async function compare(/** @type {string} */ refFile, /** @type {string} */ filmFile, { fps = 30, scale = true, film: html = /** @type {string | null} */ (null) } = {}) {
  const [refInfo, filmInfo] = await Promise.all([probe(refFile), probe(filmFile)]);
  const refAspect = refInfo.width / refInfo.height, filmAspect = filmInfo.width / filmInfo.height;
  /* the reference cropped to fill the film's frame, and the film's part a whole reference with bars would take */
  const ratio = filmAspect / refAspect;
  const fill = Math.abs(ratio - 1) < 0.03 ? undefined : ratio < 1 ? { x: (1 - ratio) / 2, y: 0, w: ratio, h: 1 } : { x: 0, y: (1 - 1 / ratio) / 2, w: 1, h: 1 / ratio };
  const fit = !fill ? undefined : ratio < 1 ? { x: 0, y: (1 - ratio) / 2, w: 1, h: ratio } : { x: (1 - 1 / ratio) / 2, y: 0, w: 1 / ratio, h: 1 };
  html ??= findFilm(filmFile);
  let filmWordsFrom = null, filmWordList;
  if (!existsSync(transcriptOf(filmFile)) && html) { filmWordList = filmWords(html); filmWordsFrom = `the clips' transcripts in ${relative('.', html) || 'film.html'}`; }
  const ref = await measure(refFile, { crop: fill });
  const film = await measure(filmFile, { crop: fit, words: filmWordList, wordsFrom: filmWordsFrom ?? undefined });
  const k = scale && ref.duration && film.duration && Math.abs(film.duration / ref.duration - 1) > 0.01 ? ref.duration / film.duration : 1;
  const frames = (/** @type {number} */ s) => Math.round(s * fps);
  const lines = [];
  lines.push(`Reference  ${refFile}  ${fmt(ref.duration)} s  ${ref.width}×${ref.height}`);
  lines.push(`Film       ${filmFile}  ${fmt(film.duration)} s  ${film.width}×${film.height}${k !== 1 ? `  (its times ×${k.toFixed(3)} to line up; --no-scale keeps them)` : ''}`);
  lines.push(`Gaps in frames at ${fps} fps; times are the reference's seconds.`);
  /** @type {Record<string, any>} */
  const result = { reference: refFile, film: filmFile, fps, scale: k, moments: {}, leaks: {} };
  /** @param {string} label @param {number[]} r @param {number[]} f @param {number} within */
  const moments = (label, r, f, within) => {
    const { matched, missing, extra } = pair(r, f.map((t) => t * k), within);
    const gaps = [...matched.values()].map((d) => frames(d));
    const abs = gaps.map(Math.abs).sort((a, b) => a - b);
    const close = abs.filter((g) => g <= 2).length;
    const off = [...matched].filter(([, d]) => Math.abs(frames(d)) > 2).map(([i, d]) => `${fmt(r[i])} (${frames(d) > 0 ? '+' : ''}${frames(d)})`);
    result.moments[label.trim().toLowerCase()] = { reference: r.length, film: f.length, within2: close, median: abs[abs.length >> 1] ?? null, worst: abs.at(-1) ?? null, off, missing, extra };
    if (!r.length && !f.length) return lines.push(`${label} none in either`);
    lines.push(`${label} ${close} of ${r.length} within 2 frames${abs.length ? ` · median ${abs[abs.length >> 1]}, worst ${abs.at(-1)}` : ''} · film has ${f.length}`);
    if (off.length) lines.push(`             off by more than 2: ${off.slice(0, 12).join(', ')}${off.length > 12 ? ` and ${off.length - 12} more` : ''}`);
    if (missing.length) lines.push(`             not in the film: ${missing.slice(0, 12).map(fmt).join(', ')}${missing.length > 12 ? ` and ${missing.length - 12} more` : ''}`);
    if (extra.length) lines.push(`             only in the film: ${extra.slice(0, 12).map(fmt).join(', ')}${extra.length > 12 ? ` and ${extra.length - 12} more` : ''}`);
  };
  moments('Cuts       ', ref.cuts, film.cuts, 0.5);
  moments('Changes    ', ref.changes.map((c) => c.t), film.changes.map((c) => c.t), 0.3);
  if (ref.words && film.words) moments('Words      ', ref.words.map((w) => w.t), film.words.map((w) => w.t), 0.4);
  else lines.push(`Words       not measured: ${!ref.words ? `no ${transcriptOf(refFile)} (npx openfilm get asr --src ${refFile})` : `no words for the film (a ${transcriptOf(filmFile)}, or clips with transcripts in film.html)`}`);
  const hits = (/** @type {{ t: number, strength: number }[]} */ list) => list.filter((o) => o.strength >= HIT).map((o) => o.t);
  if (refInfo.sound || filmInfo.sound) moments('Sound hits ', hits(ref.sounds), hits(film.sounds), 0.25);
  const pictures = leakedPictures(ref.frames, film.frames);
  const sound = leakedSound(ref.landmarks, film.landmarks);
  const files = html ? leakedFiles(html, refFile) : [];
  const words = ref.words && film.words ? sharedWords(ref.words, film.words) : null;
  result.leaks = { pictures, sound, files, words };
  const leaked = pictures.length + sound.length + files.length > 0;
  lines.push('');
  if (leaked) {
    lines.push('THE REFERENCE IS IN THE FILM. It never goes in unless the person asked for that part:');
    for (const f of files) lines.push(`  file     film.html plays ${f}`);
    for (const p of pictures) lines.push(`  picture  film ${fmt(p.from)}–${fmt(p.to)} s shows the reference's frames from ${fmt(p.refFrom)} s (pixels ${p.score.toFixed(2)} alike)`);
    for (const s of sound) lines.push(`  sound    film ${fmt(s.from)}–${fmt(s.to)} s plays the reference's sound from ${fmt(s.refFrom)} s (${s.count} landmarks)`);
  } else {
    lines.push(`No picture, sound or file of the reference in the film (${film.frames.length} frames checked${html ? ', film.html read' : ''}).`);
  }
  if (words) {
    const said = words.runLength ? `longest shared run ${words.runLength} ${words.cjk ? 'characters' : 'words'} at ${fmt(words.filmAt)} s, 「${words.run}」` : 'no shared run';
    lines.push(`Words shared with the reference: ${Math.round(words.share * 100)}% of the film's 6-token runs; ${said}.${words.tooLong || words.share > 0.2 ? ' Only right when the person asked for the same words.' : ''}`);
  }
  result.lines = lines;
  return { lines, result, leaked };
}

const HELP = `node compare.mjs <reference video> <film video> [options]

  Measures both videos the same way and reports, in frames, how far each cut, change, word and sound hit of the
  reference is from the film's; then whether any frame, sound or file of the reference is in the film, and how many
  of its words the film repeats. Exits 1 when a picture, a sound or a file of the reference is in the film.

  The film video: render one for measuring, e.g. npx openfilm render --subtitles --out .film/cache/replicate/film.mp4
  Words: the WebVTT beside each video (npx openfilm get asr --src <video>); for the film, else its clips' transcripts.

  --fps <n>       frames are counted at this rate (30)
  --no-scale      keep the film's times as they are when its length differs from the reference's
  --film <path>   film.html, when the film video is not inside its project
  --json <file>   the numbers, as JSON`;

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2);
  const flag = (/** @type {string} */ name) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
  if (args.includes('--help') || args.includes('-h')) { console.log(HELP); process.exit(0); }
  const fps = Number(flag('--fps') ?? 30), json = flag('--json'), film = flag('--film');
  const scale = !args.includes('--no-scale');
  const [ref, video] = args.filter((a) => a !== '--no-scale');
  if (!ref || !video) { console.error(HELP); process.exit(2); }
  if (/\.html?$/i.test(video)) { console.error(`${video} is a page: compare a video of the film (npx openfilm render --subtitles --out .film/cache/replicate/film.mp4)`); process.exit(2); }
  try {
    const { lines, result, leaked } = await compare(ref, video, { fps, scale, film: film ? resolve(film) : null });
    console.log(lines.join('\n'));
    if (json) writeFileSync(json, JSON.stringify(result, null, 2));
    process.exit(leaked ? 1 : 0);
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(2);
  }
}
