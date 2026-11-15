#!/usr/bin/env node
// The digest of an item's folder, as OpenFilm computes it, for `digests` in revoked.json.
//
//   node scripts/digest.mjs <folder>
//
// The folder is walked recursively, the entries at each level sorted by name. Each regular file feeds one sha256 with
// `<relative/path>\0<size>\0` and then its bytes. The same bytes give the same digest wherever they are installed.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** @param {string} folder @returns {string} 64 hex characters */
export function folderDigest(folder) {
  const hash = createHash('sha256');
  /** @param {string} dir @param {string} rel */
  const walk = (dir, rel) => {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name), at = rel ? `${rel}/${name}` : name, info = statSync(path);
      if (info.isDirectory()) { walk(path, at); continue; }
      if (!info.isFile()) continue;
      hash.update(`${at}\0${info.size}\0`).update(readFileSync(path));
    }
  };
  walk(folder, '');
  return hash.digest('hex');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const folder = process.argv[2];
  if (!folder) { console.error('digest: name a folder: node scripts/digest.mjs <folder>'); process.exit(1); }
  console.log(folderDigest(resolve(folder)));
}
