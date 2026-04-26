#!/usr/bin/env node
// Bump the in-game version across every file that must stay in sync.
//
// Usage:
//   node scripts/bump-version.mjs <new-version> "<LABEL>"
//   node scripts/bump-version.mjs 1.19.27 "NEW FEATURE"
//
// Updates these version surfaces (the "hard-gate" list plus the visible fallback tag):
//   1. src/data/version.js                 — VERSION = { num, label }
//   2. version.json                        — { version, label }
//   3. index.html window.__APP_BUILD__     — fallback banner
//   4. index.html styles.css?v=...         — cache-bust query
//   5. index.html script.js?v=...          — cache-bust query
//   6. index.html #version-tag fallback    — visible pre-module banner
//
// Optionally stubs a new entry at the top of src/data/patchNotes.js when
// --note "highlight one" --note "highlight two" is passed.
//
// Idempotent: running with the same version is a no-op.
// Exits non-zero if any file is missing a matching old value.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');

function die(msg) {
  console.error(`bump-version: ${msg}`);
  process.exit(1);
}

function replaceOnce(filePath, pattern, replacement, label) {
  const abs = path.join(ROOT, filePath);
  const src = fs.readFileSync(abs, 'utf8');
  const matches = src.match(pattern);
  if (!matches) die(`${filePath}: no match for ${label}`);
  if (matches.length > 1) die(`${filePath}: multiple matches for ${label} (expected 1)`);
  const updated = src.replace(pattern, replacement);
  if (updated === src) {
    console.log(`  = ${filePath}: ${label} already up-to-date`);
    return false;
  }
  fs.writeFileSync(abs, updated);
  console.log(`  ✓ ${filePath}: ${label}`);
  return true;
}

const [, , rawVersion, rawLabel, ...rest] = process.argv;
if (!rawVersion || !rawLabel) {
  die('usage: node scripts/bump-version.mjs <version> "<LABEL>" [--note "..."]...');
}
if (!/^\d+\.\d+\.\d+$/.test(rawVersion)) {
  die(`version must match N.N.N (got "${rawVersion}")`);
}
const version = rawVersion;
const label = rawLabel.trim();

const notes = [];
for (let i = 0; i < rest.length; i += 1) {
  if (rest[i] === '--note' && rest[i + 1]) {
    notes.push(rest[i + 1]);
    i += 1;
  }
}

console.log(`bump-version: ${version} "${label}"${notes.length ? ` (+${notes.length} note${notes.length > 1 ? 's' : ''})` : ''}`);

replaceOnce(
  'src/data/version.js',
  /const VERSION = \{ num: '[^']+', label: '[^']*' \};/,
  `const VERSION = { num: '${version}', label: '${label.replace(/'/g, "\\'")}' };`,
  'VERSION export',
);

replaceOnce(
  'version.json',
  /\{\s*"version":\s*"[^"]+",\s*"label":\s*"[^"]*"\s*\}/,
  `{ "version": "${version}", "label": "${label.replace(/"/g, '\\"')}" }`,
  'version.json',
);

replaceOnce(
  'index.html',
  /window\.__APP_BUILD__\s*=\s*'[^']+';/,
  `window.__APP_BUILD__ = '${version}';`,
  '__APP_BUILD__ banner',
);

replaceOnce(
  'index.html',
  /<div class="eyebrow" id="version-tag">\/\/ prototype v[^<]+<\/div>/,
  `<div class="eyebrow" id="version-tag">// prototype v${version} - ${label.replace(/</g, '&lt;')}</div>`,
  'version-tag fallback banner',
);

replaceOnce(
  'index.html',
  /styles\.css\?v=\d+\.\d+\.\d+/,
  `styles.css?v=${version}`,
  'styles.css cache-bust',
);

replaceOnce(
  'index.html',
  /script\.js\?v=\d+\.\d+\.\d+/,
  `script.js?v=${version}`,
  'script.js cache-bust',
);

if (notes.length > 0) {
  const notesPath = path.join(ROOT, 'src/data/patchNotes.js');
  const src = fs.readFileSync(notesPath, 'utf8');
  const anchorRe = /const PATCH_NOTES_RECENT = \[\r?\n/;
  if (!anchorRe.test(src)) {
    die('src/data/patchNotes.js: could not locate PATCH_NOTES_RECENT anchor');
  }
  const eol = src.includes('\r\n') ? '\r\n' : '\n';
  const summaryLine = notes[0];
  const highlightLines = notes.length > 1 ? notes.slice(1) : notes;
  const entry = [
    `  {`,
    `      version: '${version}',`,
    `      label: '${label.replace(/'/g, "\\'")}',`,
    `      summary: ['${summaryLine.replace(/'/g, "\\'")}'],`,
    `      highlights: [`,
    ...highlightLines.map((n) => `        '${n.replace(/'/g, "\\'")}',`),
    `      ]`,
    `    },`,
    ``,
  ].join(eol);
  const updated = src.replace(anchorRe, (match) => match + entry);
  fs.writeFileSync(notesPath, updated);
  console.log(`  ✓ src/data/patchNotes.js: stubbed v${version} entry`);
}

console.log(`\nDon't forget: update plan.md current-version line if you keep one.`);
