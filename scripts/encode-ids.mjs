// Encodes operator Telegram IDs for tgcloud/lib/constants.js.
//
// This repository is public, so the two operator account IDs are stored
// encoded (base36 of `id + offset`, where the offset is derived from a key
// string via FNV-1a). Run this script locally with the real IDs; never commit
// the plaintext values or the arguments you pass here.
//
// Usage (run from the repo root):
//   node scripts/encode-ids.mjs <superadmin_id> <privileged_id>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [superadminId, privilegedId] = process.argv.slice(2);
for (const value of [superadminId, privilegedId]) {
  if (!/^\d+$/.test(String(value ?? ''))) {
    console.error(
      'Usage: node scripts/encode-ids.mjs <superadmin_id> <privileged_id>'
    );
    process.exitCode = 1;
    process.exit(process.exitCode);
  }
}

function fnv1a(key) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function encode(id, key) {
  const shift = fnv1a(key) % 1_000_000_000;
  return (Number(id) + shift).toString(36);
}

const encoded = {
  superadmin: encode(superadminId, 'anon-scope:superadmin'),
  'identity-privileged': encode(privilegedId, 'anon-scope:identity-privileged'),
};

const target = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../tgcloud/lib/constants.js'
);
const source = fs.readFileSync(target, 'utf8');
const replacement = source
  .replace(
    /decodeId\('([a-z0-9]+)', 'anon-scope:superadmin'\)/,
    `decodeId('${encoded.superadmin}', 'anon-scope:superadmin')`
  )
  .replace(
    /decodeId\('([a-z0-9]+)', 'anon-scope:identity-privileged'\)/,
    `decodeId('${encoded['identity-privileged']}', 'anon-scope:identity-privileged')`
  );

if (replacement === source) {
  console.error('constants.js did not match the expected decodeId() lines');
  process.exit(1);
}

fs.writeFileSync(target, replacement);
console.log('constants.js updated with newly encoded ids');
