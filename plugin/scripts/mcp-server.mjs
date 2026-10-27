#!/usr/bin/env node
// Starts Lathe's MCP server for the project Claude Code is working in: finds the repo with lathe.config.json at or
// above the project folder, and runs that repo's own `lathe mcp`, so the tools always match its installed Lathe and
// its schema. The server speaks over this process's stdin and stdout.
import { spawn } from 'node:child_process';
import { findLathe, findRoot, real } from './lathe-root.mjs';

const start = real(process.env.CLAUDE_PROJECT_DIR || process.cwd());
const root = findRoot(start);
if (!root) {
  process.stderr.write(`Lathe's tools need a lathe.config.json at or above ${start}. Run \`npx lathe init\` there first.\n`);
  process.exit(1);
}
const lathe = findLathe(root);
if (!lathe) {
  process.stderr.write(`Lathe is not installed in ${root}. Install it with \`npm install --save-dev <lathe package>\`.\n`);
  process.exit(1);
}

const server = spawn(lathe.command, [...lathe.args, 'mcp', '--root', root], { cwd: lathe.cwd, stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill(signal));
server.on('error', (error) => {
  process.stderr.write(`Could not start Lathe's MCP server: ${error.message}\n`);
  process.exit(1);
});
server.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
