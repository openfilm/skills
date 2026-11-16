import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';

/** The complete, pinned skill folder. No symlinks or platform-specific path separators. */
export function fileManifest(dir, readBytes = (path) => readFileSync(join(dir, path)), base = '') {
  return readdirSync(join(dir, base), { withFileTypes: true }).filter((e) => !e.name.startsWith('.')).flatMap((e) => {
    const path = posix.join(base, e.name);
    if (e.isDirectory()) return fileManifest(dir, readBytes, path);
    if (!e.isFile()) throw new Error(`${path} is not a regular file`);
    const bytes = readBytes(path);
    return [{ path, size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }];
  }).sort((a, b) => a.path.localeCompare(b.path, 'en'));
}
