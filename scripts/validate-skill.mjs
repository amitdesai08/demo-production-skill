#!/usr/bin/env node
// Checks this skill against the published Agent Skills requirements.
//
//   node scripts/validate-skill.mjs
//
// Run it before committing, and in CI. The rules here are the documented ones, not
// preferences: frontmatter field limits, the 500-line body budget, one-level-deep
// references, a table of contents on long files, and forward-slash paths. A skill that
// breaks them still "works" right up until an agent silently fails to discover it, which
// is the failure mode this exists to catch.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKILL_DIR = join(ROOT, 'demo-production');
const BODY_LINE_BUDGET = 500;
// The docs ask for a table of contents past this length, so a partial read still shows scope.
const TOC_REQUIRED_OVER = 100;

const problems = [];
const notes = [];
const fail = (msg) => problems.push(msg);

if (!existsSync(join(SKILL_DIR, 'SKILL.md'))) {
  console.error(`no SKILL.md in ${SKILL_DIR}`);
  process.exit(1);
}

const raw = readFileSync(join(SKILL_DIR, 'SKILL.md'), 'utf8');
const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
if (!fm) fail('SKILL.md has no YAML frontmatter');

const front = fm ? fm[1] : '';
const body = fm ? raw.slice(fm[0].length) : raw;
const name = (/^name:\s*(.+)$/m.exec(front)?.[1] ?? '').trim();
const desc = (/^description:\s*([\s\S]*?)(?=\n[a-z][a-z-]*:|$)/m.exec(front)?.[1] ?? '')
  .trim().replace(/^['"]|['"]$/g, '');

// --- frontmatter -----------------------------------------------------------
if (!name) fail('frontmatter: name is missing');
if (name.length > 64) fail(`frontmatter: name is ${name.length} chars, max 64`);
if (name && !/^[a-z0-9-]+$/.test(name)) fail(`frontmatter: name "${name}" must be lowercase letters, numbers and hyphens only`);
if (/anthropic|claude/i.test(name)) fail(`frontmatter: name "${name}" contains a reserved word`);
if (/<[a-z]/i.test(name) || /<[a-z]/i.test(desc)) fail('frontmatter: XML tags are not allowed in name or description');

if (!desc) fail('frontmatter: description is missing');
if (desc.length > 1024) fail(`frontmatter: description is ${desc.length} chars, max 1024`);
// The description is injected into a system prompt; first/second person there measurably
// hurts discovery, which is why the docs call it out explicitly.
if (/\b(I can|I will|you can use this|we help)\b/i.test(desc)) fail('frontmatter: description must be written in the third person');
if (!/\buse (this )?when\b/i.test(desc)) fail('frontmatter: description must say WHEN to use the skill, not only what it does');

// The directory name is how every runtime addresses the skill; if it disagrees with the
// frontmatter, a plain copy or symlink installs something that cannot be referenced.
if (name && basename(SKILL_DIR) !== name) {
  fail(`directory "${basename(SKILL_DIR)}" does not match frontmatter name "${name}"`);
}

// --- body ------------------------------------------------------------------
const bodyLines = body.split('\n').length;
if (bodyLines > BODY_LINE_BUDGET) fail(`SKILL.md body is ${bodyLines} lines, over the ${BODY_LINE_BUDGET}-line budget`);

// --- references ------------------------------------------------------------
const refDir = join(SKILL_DIR, 'references');
const refs = existsSync(refDir) ? readdirSync(refDir).filter((f) => f.endsWith('.md')) : [];
const linked = new Set([...body.matchAll(/\]\((?!https?:)([^)]+\.md)\)/g)].map((m) => m[1]));

for (const link of linked) {
  if (!existsSync(join(SKILL_DIR, link))) fail(`SKILL.md links to ${link}, which does not exist`);
}
for (const f of refs) {
  if (![...linked].some((l) => l.endsWith(f))) {
    fail(`references/${f} is never linked from SKILL.md, so an agent will not find it`);
  }
}

for (const f of refs) {
  const text = readFileSync(join(refDir, f), 'utf8');
  const lines = text.split('\n').length;
  if (lines > TOC_REQUIRED_OVER && !/^##\s*contents/im.test(text)) {
    fail(`references/${f} is ${lines} lines and has no "## Contents" section`);
  }
  for (const m of text.matchAll(/\]\((?!https?:)([^)]+\.md)\)/g)) {
    const target = basename(m[1]);
    // Cross-links are fine as long as the target is ALSO reachable directly from SKILL.md;
    // what the docs warn against is content only reachable through a chain.
    if (target !== 'SKILL.md' && ![...linked].some((l) => l.endsWith(target))) {
      fail(`references/${f} links to ${target}, which SKILL.md does not link to directly`);
    }
  }
}

// --- paths -----------------------------------------------------------------
// Backslash paths break on macOS and Linux. PowerShell examples are exempt: they are shell
// commands for a specific OS, not paths the agent will open.
for (const rel of ['SKILL.md', ...refs.map((r) => `references/${r}`)]) {
  const text = readFileSync(join(SKILL_DIR, rel), 'utf8');
  const withoutPwshBlocks = text.replace(/```powershell[\s\S]*?```/g, '');
  for (const m of withoutPwshBlocks.matchAll(/`[^`\n]*?[\w)]\\[\w.][^`\n]*?`/g)) {
    fail(`${rel}: Windows-style path in \`${m[0].slice(1, -1)}\` — use forward slashes`);
  }
}

notes.push(`skill "${name}" — ${bodyLines}-line body, ${refs.length} reference files, ${desc.length}-char description`);

// --- documentation that lists the reference files ---------------------------
// Both SKILL.md and the README draw a file tree, and both have already gone stale twice:
// they said ten references when there were twelve. A hand-maintained list of files is a
// promise about the filesystem, so check it against the filesystem.
const known = new Set(refs);
function checkListing(label, absPath, text) {
  const listed = new Set(
    [...text.matchAll(/[├└]──\s+([a-z0-9-]+\.md)/g)].map((m) => m[1]).filter((f) => known.has(f)),
  );
  const missing = refs.filter((f) => !listed.has(f));
  if (missing.length) fail(`${label} does not list: ${missing.join(', ')}`);

  // A stated count is the same promise in numeric form, and drifts the same way.
  const claimed = /(\d+)\s+(?:topic|reference)\s+files/i.exec(text);
  if (claimed && Number(claimed[1]) !== refs.length) {
    fail(`${label} claims ${claimed[1]} reference files, but there are ${refs.length}`);
  }
}

checkListing('SKILL.md package listing', join(SKILL_DIR, 'SKILL.md'), body);
const readmePath = join(ROOT, 'README.md');
if (existsSync(readmePath)) {
  checkListing('README.md file tree', readmePath, readFileSync(readmePath, 'utf8'));
}

for (const n of notes) console.log(n);
if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log('all checks passed');
