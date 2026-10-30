// The Lathe a window's chat brings (LA-PLT-UC19-R08): every session loads the Lathe plugin of the Lathe the window
// runs, as servers.ts picks it (the product's own installed Lathe, else the app's bundled copy, or Lathe from source in
// development), and its MCP server runs that same Lathe (LATHE_CLI), so the tools always match the window. The Lathe
// package ships the plugin in dist/plugin; a product's own Lathe from before that uses the app's plugin, which still
// runs the product's own Lathe. Before the chat says how many tools a session has (LA-PLT-UC19-R10), it asks the
// plugin's own MCP server, started as Claude Code starts it, with the session's environment, View only included; the
// tools it marks read only (readOnlyHint) are those Accept reads lets run without asking.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { LATHE_TOOL_PREFIX, type LatheTools } from './chat.ts';
import type { CountedTools } from './chatSession.ts';
import type { LatheChoice } from './servers.ts';

/** The Lathe a chat brings: the plugin it loads, the Lathe bin its MCP server runs (null: the plugin finds one), and its version. */
export interface ChatLathe {
  pluginDir: string;
  cli: string | null;
  version: string | null;
}

/** The environment variable that names the Lathe bin the plugin's MCP server runs (plugin/scripts/lathe-root.mjs). */
const CLI_ENV = 'LATHE_CLI';

/** The plugin a Lathe package ships, when it has one. */
function shippedPlugin(pkg: string, exists: (file: string) => boolean): string | null {
  const dir = path.join(pkg, 'dist', 'plugin');
  return exists(path.join(dir, '.claude-plugin', 'plugin.json')) ? dir : null;
}

/** The app's own plugin: the one its bundled Lathe ships inside the packed app, or this repo's plugin/ folder. */
export function appPluginDir(repoRoot: string, packaged: { resourcesPath: string } | null): string {
  return packaged ? path.join(packaged.resourcesPath, 'node_modules', '@jaredrob', 'lathe', 'dist', 'plugin') : path.join(repoRoot, 'plugin');
}

/** The Lathe a chat brings for the Lathe a window runs (servers.ts latheFor): its package's plugin and bin, from its serve() module. */
export function chatLatheFor(choice: LatheChoice, appPlugin: string, exists: (file: string) => boolean = existsSync): ChatLathe {
  const pkg = path.resolve(path.dirname(choice.modulePath), '..', '..', '..');
  const cli = path.join(pkg, 'dist', 'bin', 'lathe.js');
  const own = choice.source === 'product' ? shippedPlugin(pkg, exists) : null;
  return { pluginDir: own ?? appPlugin, cli: exists(cli) ? cli : null, version: choice.version };
}

/** The Lathe a chat brings in development, where the window runs Lathe from source: the repo's plugin and CLI. */
export function sourceLathe(repoRoot: string): ChatLathe {
  let version: string | null = null;
  try {
    const pkg = JSON.parse(readFileSync(path.join(repoRoot, 'lathe', 'package.json'), 'utf8')) as { version?: unknown };
    if (typeof pkg.version === 'string') version = pkg.version;
  } catch {
    // No version to show.
  }
  return { pluginDir: path.join(repoRoot, 'plugin'), cli: path.join(repoRoot, 'lathe', 'bin', 'lathe.ts'), version };
}

/** The chat's environment with the Lathe its MCP server runs. */
export function withLatheCli(env: NodeJS.ProcessEnv, lathe: ChatLathe): NodeJS.ProcessEnv {
  return lathe.cli ? { ...env, [CLI_ENV]: lathe.cli } : env;
}

/** How long counting the tools may take: the server reads the product's schema first. */
const COUNT_TIMEOUT_MS = 60_000;
/** How much of the server's error output a problem keeps. */
const STDERR_TAIL = 600;

/**
 * Counts the Lathe tools a session gets: starts the plugin's MCP server as Claude Code does (`node` on the PATH, the
 * project folder in CLAUDE_PROJECT_DIR, the session's environment), asks for its tools, and ends it.
 */
export function countLatheTools(input: { pluginDir: string; cwd: string; env: NodeJS.ProcessEnv; version: string | null }): Promise<CountedTools> {
  const { pluginDir, cwd, env, version } = input;
  return new Promise((resolve) => {
    let settled = false;
    let stderr = '';
    const server = spawn('node', [path.join(pluginDir, 'scripts', 'mcp-server.mjs')], { cwd, env: { ...env, CLAUDE_PROJECT_DIR: cwd }, stdio: ['pipe', 'pipe', 'pipe'] });
    const done = (lathe: LatheTools, reads: string[] = []) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      server.stdin.end();
      if (server.exitCode === null && server.signalCode === null) server.kill('SIGTERM');
      resolve({ lathe, reads });
    };
    const failed = (problem: string) => done({ status: 'failed', version, problem });
    const timer = setTimeout(() => failed("Lathe's tools did not answer in time."), COUNT_TIMEOUT_MS);
    server.on('error', (error) => failed(`Lathe's tools did not start: ${error.message}`));
    server.stderr.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString('utf8')).slice(-STDERR_TAIL);
    });
    server.stdin.on('error', () => {});
    server.on('close', () => failed(stderr.trim() || "Lathe's tools stopped before they answered."));
    createInterface({ input: server.stdout, crlfDelay: Infinity }).on('line', (line) => {
      try {
        const message = JSON.parse(line) as { id?: unknown; result?: { tools?: { name?: unknown; annotations?: { readOnlyHint?: unknown } }[] } };
        const tools = message.result?.tools;
        if (message.id !== 2 || !Array.isArray(tools)) return;
        const reads = tools.filter((t) => t.annotations?.readOnlyHint === true && typeof t.name === 'string').map((t) => `${LATHE_TOOL_PREFIX}${String(t.name)}`);
        done({ status: 'loaded', version, count: tools.length }, reads);
      } catch {
        // Not a message: the server answers the next line.
      }
    });
    const send = (message: object) => server.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', ...message })}\n`);
    send({ id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'lathe-desktop', version: '1' } } });
    send({ method: 'notifications/initialized' });
    send({ id: 2, method: 'tools/list' });
  });
}
