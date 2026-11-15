#!/usr/bin/env node
import { spawnSync, execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, hash, HEX, idsIn, inspect, MB } from './check.mjs';
import { build, commit, revokedAt } from './build.mjs';

const [command, channel, value, ...extra] = process.argv.slice(2);
const prefixes = { preview: 'library/community-preview/v1', production: 'library/community/v1' };
const R2 = process.env.R2_ENDPOINT;
const key = process.env.R2_ACCESS_KEY_ID;
const secret = process.env.R2_SECRET_ACCESS_KEY;
const git = (...args) => execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8' }).trim();

function request(method, name, { bytes, type, match, create } = {}) {
  const base = prefixes[channel];
  if (!/^(catalog\.json|(blobs|releases)\/[a-f0-9]{64})$/.test(name)) throw new Error('Invalid object key');
  const dir = mkdtempSync(join(tmpdir(), 'openfilm-r2-'));
  try {
    const body = join(dir, 'body');
    const headers = join(dir, 'headers');
    const config = `user = "${key}:${secret}"\n`;
    const args = ['--config', '-', '--aws-sigv4', 'aws:amz:auto:s3', '--silent', '--max-time', '90',
      '--retry', '3', '--retry-delay', '1', '--retry-max-time', '15', '--retry-all-errors', '--max-filesize', String(8 * MB),
      '--dump-header', headers, '--output', body, '--write-out', '%{http_code}', '--request', method];
    if (bytes) {
      const file = join(dir, 'upload');
      writeFileSync(file, bytes, { mode: 0o600 });
      args.push('--upload-file', file, '--header', `Content-Type: ${type}`, '--header',
        `Cache-Control: ${name === 'catalog.json' ? 'no-store' : 'public, max-age=31536000, immutable'}`);
    }
    if (match) args.push('--header', `If-Match: ${match}`);
    if (create) args.push('--header', 'If-None-Match: *');
    args.push(`${R2}/openfilm-assets/${base}/${name}`);
    const result = spawnSync('curl', args, { input: config, encoding: 'utf8', maxBuffer: MB });
    if (result.status !== 0) throw new Error(`${method} ${name} failed (curl ${result.status})`);
    return { status: Number(result.stdout), bytes: readFileSync(body),
      etag: readFileSync(headers, 'utf8').match(/^etag:\s*(.*)$/im)?.[1]?.trim() };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

function immutable(path, bytes, type) {
  const sent = request('PUT', path, { bytes, type, create: true });
  if (![200, 201, 204, 412].includes(sent.status)) throw new Error(`PUT ${path}: HTTP ${sent.status}`);
  const fetched = request('GET', path);
  if (fetched.status !== 200 || !fetched.bytes.equals(bytes)) throw new Error(`R2 verification failed for ${path}`);
}

function active() {
  const current = request('GET', 'catalog.json');
  if (current.status === 404) return { catalog: { items: [] }, current };
  if (current.status !== 200 || !current.etag) throw new Error(`Cannot read the active catalog (HTTP ${current.status})`);
  return { catalog: JSON.parse(current.bytes), current };
}

function activate(catalog, current) {
  const result = request('PUT', 'catalog.json', { bytes: catalog, type: 'application/json',
    match: current.etag, create: current.status === 404 });
  if (![200, 201, 204, 412].includes(result.status)) throw new Error(`Switching the catalog failed (HTTP ${result.status})`);
  const live = request('GET', 'catalog.json');
  if (live.status === 200 && live.bytes.equals(catalog)) return;
  if (result.status === 412) throw new Error('The catalog changed during publication. Re-run against the new head.');
  throw new Error('Active catalog differs after publication');
}

function verifySnapshot(catalog) {
  const revoked = revokedAt();
  for (const entry of catalog.items) {
    if (revoked.has(entry.fingerprint)) throw new Error(`${entry.id} was revoked; choose another release`);
    for (const file of Object.values(entry.files)) {
      const object = request('GET', `blobs/${file.sha256}`);
      if (object.status !== 200 || object.bytes.length !== file.bytes || hash(object.bytes) !== file.sha256) throw new Error(`Missing or incorrect object ${file.sha256}`);
    }
  }
}

function buildFromSources(mediaDir) {
  const needed = new Map();
  for (const id of idsIn()) {
    const { item } = inspect(id, { allowMissing: true });
    for (const file of item.files) if (file.sha256) needed.set(file.sha256, file.bytes);
  }
  if (!needed.size) return build({ source: commit() });
  const staging = mkdtempSync(join(tmpdir(), 'openfilm-publish-sources-'));
  try {
    for (const [digest, size] of needed) {
      const local = mediaDir ? join(mediaDir, digest) : null;
      let bytes;
      if (local && existsSync(local)) {
        const info = lstatSync(local);
        if (!info.isFile() || info.size !== size) throw new Error(`Invalid staged file ${digest}`);
        bytes = readFileSync(local);
      } else {
        const existing = request('GET', `blobs/${digest}`);
        if (existing.status !== 200) throw new Error(`Stage the reviewed source ${digest} first`);
        bytes = existing.bytes;
      }
      if (bytes.length !== size || hash(bytes) !== digest) throw new Error(`Source did not match its SHA-256: ${digest}`);
      writeFileSync(join(staging, digest), bytes, { mode: 0o600, flag: 'wx' });
    }
    return build({ source: commit(), mediaDir: staging });
  } finally { rmSync(staging, { recursive: true, force: true }); }
}

function verifyMain() {
  if (git('status', '--porcelain')) throw new Error('Publish from a clean checkout');
  if (channel === 'production') {
    const remote = git('ls-remote', 'origin', 'refs/heads/main').split(/\s+/)[0];
    if (remote !== commit()) throw new Error('Production requires the current reviewed origin/main');
  }
}

try {
  if (!Object.hasOwn(prefixes, channel) || extra.length || !['publish', 'rollback', 'status'].includes(command) ||
    ((command === 'rollback') !== Boolean(value) && command !== 'publish')) {
    throw new Error('Usage: publish.mjs publish <preview|production> [media-dir] | rollback <preview|production> <release-sha> | status <preview|production>');
  }
  if (!/^https:\/\/[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(R2 ?? '') ||
      ![key, secret].every((credential) => typeof credential === 'string' && /^[a-zA-Z0-9]+$/.test(credential))) {
    throw new Error('Set R2_ENDPOINT, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY for openfilm-assets');
  }
  const { catalog: old, current } = active();
  if (command === 'status') {
    console.log(current.status === 404 ? 'No active release' : `${hash(current.bytes)} · ${old.items.length} item(s) · ${old.source}`);
  } else {
    verifyMain();
    if (command === 'publish') {
      const { catalog, blobs, release } = buildFromSources(value);
      const prior = new Map(old.items.map((entry) => [entry.id, entry]));
      for (const item of JSON.parse(catalog).items) {
        const before = prior.get(item.id);
        if (before && before.fingerprint !== item.fingerprint && before.version >= item.version) throw new Error(`${item.id}: raise its version when changing the reviewed content`);
      }
      for (const [digest, { bytes, type }] of blobs) immutable(`blobs/${digest}`, bytes, type);
      immutable(`releases/${release}`, catalog, 'application/json');
      activate(catalog, current);
      console.log(`Published ${channel}: ${release} (previous ${current.status === 404 ? 'none' : hash(current.bytes)})`);
    } else {
      if (!HEX.test(value)) throw new Error('Rollback needs the archived release SHA-256');
      const object = request('GET', `releases/${value}`);
      if (object.status !== 200 || hash(object.bytes) !== value) throw new Error('Archived catalog is missing or does not match its hash');
      verifySnapshot(JSON.parse(object.bytes));
      activate(object.bytes, current);
      console.log(`Rolled ${channel} back to ${value}`);
    }
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
