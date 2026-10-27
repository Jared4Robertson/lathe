#!/usr/bin/env node
// PreToolUse hook: refuses a Write, Edit, MultiEdit or NotebookEdit of a Lathe data file (data/<table>.jsonl), and
// points the Agent at Lathe's MCP tools instead. Nothing edits the spec by hand: every change goes through the
// command layer, which checks it against the schema before it writes.
//
// Reads the hook input (JSON) on stdin and always exits 0; a refusal is the permission decision "deny" on stdout.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { dataDirs, findRoot, real } from './lathe-root.mjs';

const quietExit = () => process.exit(0);

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  quietExit();
}

const rawPath = input?.tool_input?.file_path ?? input?.tool_input?.notebook_path;
if (typeof rawPath !== 'string' || rawPath === '' || !rawPath.endsWith('.jsonl')) quietExit();
const file = real(path.isAbsolute(rawPath) ? rawPath : path.resolve(input.cwd ?? process.cwd(), rawPath));

const root = findRoot(path.dirname(file));
if (!root) quietExit();
const inside = (dir) => {
  const rel = path.relative(dir, file);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
};
if (!dataDirs(real(root)).some(inside)) quietExit();

const reason =
  `${path.relative(root, file)} is Lathe data: change it only with Lathe's MCP tools (add, set, move, link, unlink, remove), ` +
  'which check every change against the schema before they write. Use show, list and next_id to read it.';
process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } })}\n`);
process.exit(0);
