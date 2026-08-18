#!/usr/bin/env node
/**
 * Mints the scrambled blob for the ( connect ) code gate.
 *
 *   node scripts/make-connect-token.mjs "open house"
 *   node scripts/make-connect-token.mjs "open house" "https://calendar.app.google/XXXX"
 *
 * Paste the printed CONNECT_TOKEN into src/components/ConnectGate.astro.
 *
 * Matching is forgiving: case, spaces and punctuation are all stripped, so
 * "Knock, knock!" == "knockknock". Note that means accented or non-latin
 * characters are stripped too — keep code words to plain a-z and 0-9.
 * The real calendar URL never appears in the built site — only this blob does,
 * and the blob is useless without the code word.
 */
import { webcrypto as crypto } from 'node:crypto';

const DEFAULT_URL = 'https://calendar.app.google/53GJJNoNpdsB6dYK6';
const ITER = 200_000;

const code = process.argv[2];
const url  = process.argv[3] || DEFAULT_URL;

if (!code) {
  console.error('usage: node scripts/make-connect-token.mjs "<code word>" [calendar url]');
  process.exit(1);
}
if (!url.startsWith('https://calendar.app.google/')) {
  console.error('refusing: url must start with https://calendar.app.google/');
  process.exit(1);
}

// Must match the client normalisation in ConnectGate.astro exactly.
const norm = (s) => s.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g, '');

const enc  = new TextEncoder();
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv   = crypto.getRandomValues(new Uint8Array(12));

const base = await crypto.subtle.importKey('raw', enc.encode(norm(code)), 'PBKDF2', false, ['deriveKey']);
const key  = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' },
  base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']
);
const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(url)));

const blob = new Uint8Array(salt.length + iv.length + ct.length);
blob.set(salt, 0); blob.set(iv, salt.length); blob.set(ct, salt.length + iv.length);
const b64 = Buffer.from(blob).toString('base64');

console.log('\ncode word : "%s"  (normalised: "%s")', code, norm(code));
console.log('calendar  : %s', url);
console.log('\nCONNECT_TOKEN =\n%s\n', b64);
