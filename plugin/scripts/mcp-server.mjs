#!/usr/bin/env node
// Starts Lathe's MCP server for the project Claude Code is working in: finds the repo with lathe.config.json at or
// above the project folder, and runs that repo's own `lathe mcp` (or, under the desktop app's chat, the Lathe its
// window runs, LATHE_CLI), so the tools always match the Lathe that reads its data and its schema. The server speaks
// over this process's stdin and stdout. When the installed Lathe's major version is not the major of the version the
// plugin's skills were written for (plugin.json's lathe.version, set by each release), the first tool result says so, once.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { findLathe, findRoot, installedLathe, real, skillsVersion, versionWarning, warnOnce } from './lathe-root.mjs';

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

const pluginDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const warning = versionWarning(installedLathe(root), skillsVersion(pluginDir), root);
const server = spawn(lathe.command, [...lathe.args, 'mcp', '--root', root], { cwd: lathe.cwd, stdio: warning ? ['pipe', 'pipe', 'inherit'] : 'inherit' });
if (warning) {
  // Between Claude Code and the server: note each tools/call request, and add the warning to the first one's result.
  const calls = new Set();
  const state = { warning, warned: false };
  createInterface({ input: process.stdin, crlfDelay: Infinity })
    .on('line', (line) => {
      try {
        const message = JSON.parse(line);
        if (message.method === 'tools/call' && message.id !== undefined) calls.add(message.id);
      } catch {
        // Not JSON: the server answers it.
      }
      server.stdin.write(`${line}\n`);
    })
    .on('close', () => server.stdin.end());
  createInterface({ input: server.stdout, crlfDelay: Infinity }).on('line', (line) => process.stdout.write(`${warnOnce(line, calls, state)}\n`));
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill(signal));
server.on('error', (error) => {
  process.stderr.write(`Could not start Lathe's MCP server: ${error.message}\n`);
  process.exit(1);
});
// close, not exit: the server's last lines are passed on before this process ends.
server.on('close', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
