#!/usr/bin/env node
// PreToolUse hook: refuses a Write, Edit, MultiEdit or NotebookEdit of a Lathe data file (data/<table>.jsonl), and
// points the Agent at Lathe's MCP tools instead. Nothing edits the spec by hand: every change is one of an aggregate's
// own commands, which checks the aggregate's rules before it writes.
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
  `${path.relative(root, file)} is Lathe data: change it only with Lathe's MCP tools, each aggregate's own commands ` +
  '(such as use_case_add_flow_step), which check its rules before they write. Read it with each aggregate\'s get and list tools.';
process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } })}\n`);
process.exit(0);
