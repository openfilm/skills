#!/usr/bin/env node
import { lstatSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { hash, MB } from './check.mjs';

try {
  const path = process.argv[2];
  if (process.argv.length !== 3 || !path || !/^(sound|music)\.(mp3|m4a)$/.test(basename(path))) {
    throw new Error('Usage: node scripts/prepare.mjs <sound.m4a|sound.mp3|music.m4a|music.mp3>');
  }
  const info = lstatSync(path);
  const cap = basename(path).startsWith('sound.') ? 2 : 8;
  if (!info.isFile() || info.size < 1 || info.size > cap * MB) throw new Error(`Choose a regular audio file of at most ${cap} MiB`);
  const bytes = readFileSync(path);
  console.log(JSON.stringify({ path: basename(path), bytes: bytes.length, sha256: hash(bytes) }, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
