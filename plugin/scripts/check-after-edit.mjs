#!/usr/bin/env node
// PostToolUse hook: after Write, Edit or MultiEdit changes a spec record or the meta-model,
// run `lathe check` and hand any errors back to the agent. Silent when there is nothing to say.
//
// Reads the hook input (JSON) on stdin. Exits 0 in every case: errors are reported with
// {"decision": "block", "reason": ...} on stdout, which Claude Code shows to the agent next to
// the tool result. The edit itself has already happened; "block" only makes the agent read it.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';

const CONFIG_FILE = 'lathe.config.json';
const TIMEOUT_MS = 50_000; // the hook's own timeout in hooks.json is 60 s
const MAX_ERRORS_SHOWN = 25;

function quietExit() {
  process.exit(0);
}

function real(p) {
  try {
    return realpathSync(p);
  } catch {
    return path.resolve(p);
  }
}

function isInside(file, dir) {
  const rel = path.relative(dir, file);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/** The nearest folder at or above `start` holding lathe.config.json, or null. */
function findRoot(start) {
  let dir = start;
  for (;;) {
    if (existsSync(path.join(dir, CONFIG_FILE))) return dir;
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

/** Is this file part of what `lathe check` reads: a spec record, the config, or the meta-model? */
function isWatched(file, root, config) {
  if (file === path.join(root, CONFIG_FILE)) return true;
  const specsDir = real(path.resolve(root, config.specs ?? 'specs'));
  if (isInside(file, specsDir)) return file.endsWith('.md') && path.basename(file) !== 'README.md';
  const metaDirs = [];
  if (config.metaExtensions) metaDirs.push(real(path.resolve(root, config.metaExtensions)));
  // In the Lathe repo itself, Lathe's own meta-model is part of the workspace too.
  if (existsSync(path.join(root, 'lathe', 'bin', 'lathe.ts'))) metaDirs.push(path.join(root, 'lathe', 'meta'));
  return file.endsWith('.csv') && metaDirs.some((dir) => isInside(file, dir));
}

/** How to run `lathe check` for this root, or null when Lathe is not installed there. */
function findCommand(root) {
  // The Lathe repo: run the CLI from source, as `npm --prefix lathe run check` does, without npm's start-up cost.
  const lathePkg = path.join(root, 'lathe');
  if (existsSync(path.join(lathePkg, 'bin', 'lathe.ts')) && existsSync(path.join(lathePkg, 'node_modules'))) {
    return { command: process.execPath, args: ['bin/lathe.ts', 'check', '--root', root, '--json'], cwd: lathePkg };
  }
  // A product repo with Lathe installed: the package's bin, here or in a parent workspace. Never npx, which may download.
  let dir = root;
  for (;;) {
    const bin = path.join(dir, 'node_modules', '.bin', process.platform === 'win32' ? 'lathe.cmd' : 'lathe');
    if (existsSync(bin)) return { command: bin, args: ['check', '--root', root, '--json'], cwd: root };
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

function report(reason) {
  process.stdout.write(`${JSON.stringify({ decision: 'block', reason })}\n`);
  process.exit(0);
}

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  quietExit();
}

const rawPath = input?.tool_input?.file_path ?? input?.tool_response?.filePath;
if (typeof rawPath !== 'string' || rawPath === '') quietExit();
const file = real(path.isAbsolute(rawPath) ? rawPath : path.resolve(input.cwd ?? process.cwd(), rawPath));

const found = findRoot(path.dirname(file));
if (!found) quietExit();
const root = real(found);

let config = {};
try {
  config = JSON.parse(readFileSync(path.join(root, CONFIG_FILE), 'utf8'));
} catch {
  // Lathe itself reports an unreadable config below, if the check runs.
}
if (!isWatched(file, root, config)) quietExit();

const run = findCommand(root);
if (!run) quietExit();

const result = spawnSync(run.command, run.args, {
  cwd: run.cwd,
  encoding: 'utf8',
  timeout: TIMEOUT_MS,
  maxBuffer: 256 * 1024 * 1024,
});
if (result.error) quietExit(); // could not start, or timed out: never get in the agent's way

let workspace;
try {
  workspace = JSON.parse(result.stdout);
} catch {
  // Lathe started but could not load the workspace (for example an invalid lathe.config.json).
  const detail = `${result.stderr ?? ''}`.trim().split('\n').slice(-15).join('\n');
  if (result.status === 0 || !detail) quietExit();
  report(`lathe check could not load the workspace after editing ${path.relative(root, file)}:\n${detail}`);
}

const errors = (workspace.problems ?? []).filter((p) => p.severity === 'error');
if (errors.length === 0) quietExit();

const lines = errors
  .slice(0, MAX_ERRORS_SHOWN)
  .map((p) => `- [${p.check}]${p.record ? ` ${p.record}:` : ''} ${p.message}`);
if (errors.length > MAX_ERRORS_SHOWN) lines.push(`- ... and ${errors.length - MAX_ERRORS_SHOWN} more`);
report(
  `lathe check found ${errors.length} error${errors.length === 1 ? '' : 's'} in the specs after editing ` +
    `${path.relative(root, file)}. Fix them before going on (warnings are not shown here):\n${lines.join('\n')}`,
);
