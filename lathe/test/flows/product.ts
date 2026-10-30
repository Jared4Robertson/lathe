// What the flow tests share: a temporary product repo, the real `lathe` command run on it as a child process, and the
// data files of the records a flow starts from, written as prepared data, as every other fixture is. Each flow test seeds what its use case assumes exists, then
// walks the flow's steps through the command, as the Owner or an Agent would.
import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { vi } from 'vitest';
import { SCHEMA_VERSION, type Row, type Workspace } from '../../src/index.ts';

// Each flow runs the command many times, each a new process that loads the product.
vi.setConfig({ testTimeout: 180_000, hookTimeout: 180_000 });

export const LATHE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BIN = path.join(LATHE_DIR, 'bin', 'lathe.ts');

export interface Result { status: number | null; stdout: string; stderr: string }

export interface Product {
  root: string;
  /** Runs `lathe <args> --root <product>`. */
  lathe(...args: string[]): Result;
  /** Runs the command and expects it to succeed with nothing on stderr; returns its output. */
  run(...args: string[]): string;
  /** Runs the command and expects the store to refuse it; returns the refusal. */
  refused(...args: string[]): string;
  /** Runs one aggregate command, named as the CLI names it ('domain add-domain'), with its input as flags; returns its output. */
  command(name: string, input: Record<string, unknown>): string;
  /** Runs one aggregate command, as command does, and expects the refusal; returns it. */
  refuse(name: string, input: Record<string, unknown>): string;
  /** Runs `lathe check`; returns its status and output. */
  check(): Result;
  /** Runs `lathe check --json` and parses the workspace it prints. */
  workspace(): Workspace;
  /** Writes the rows into the product's data files: what the flow starts from. Its first command loads and checks them. */
  seed(rows: Seed[]): Promise<void>;
  /** Reads a file of the product repo. */
  read(file: string): string;
  /** Writes a file of the product repo (code a technical record or test names, or a config). */
  write(file: string, text: string): void;
}

const roots: string[] = [];

/** Removes every product the file's tests made; call it in afterAll. */
export function removeProducts(): void {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
}

/** Runs a node script of the lathe package (bin/lathe.ts or one of scripts/) with the arguments. */
export function node(script: string, args: string[], cwd?: string): Result {
  const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', cwd });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

/** A fresh product repo with its config and one product, TL. */
export function product(): Product {
  const root = mkdtempSync(path.join(tmpdir(), 'lathe-flow-'));
  roots.push(root);
  writeFileSync(path.join(root, 'lathe.config.json'), `${JSON.stringify({ schema: SCHEMA_VERSION })}\n`);
  mkdirSync(path.join(root, 'data'));
  writeFileSync(path.join(root, 'data', 'product.jsonl'), '{"id":"TL","title":"Tool Library","description":"A library that lends tools to its members."}\n');
  const lathe = (...args: string[]) => node(BIN, [...args, '--root', root]);
  return {
    root,
    lathe,
    run(...args) {
      const result = lathe(...args);
      if (result.status !== 0 || result.stderr) throw new Error(`lathe ${args.join(' ')} failed (${result.status}):\n${result.stderr}${result.stdout}`);
      return result.stdout.trim();
    },
    refused(...args) {
      const result = lathe(...args);
      if (result.status !== 1 || !result.stderr.startsWith('Refused; nothing changed:')) {
        throw new Error(`lathe ${args.join(' ')} was not refused (${result.status}):\n${result.stderr}${result.stdout}`);
      }
      return result.stderr;
    },
    command(name, input) {
      return this.run(...name.split(' '), ...flags(input));
    },
    refuse(name, input) {
      return this.refused(...name.split(' '), ...flags(input));
    },
    check: () => lathe('check'),
    workspace: () => (JSON.parse(lathe('check', '--json').stdout) as { products: { workspace: Workspace }[] }).products[0].workspace,
    async seed(rows) {
      for (const { table, row } of rows) appendFileSync(path.join(root, 'data', `${table}.jsonl`), `${JSON.stringify(row)}\n`);
    },
    read: (file) => readFileSync(path.join(root, file), 'utf8'),
    write(file, text) {
      const at = path.join(root, file);
      mkdirSync(path.dirname(at), { recursive: true });
      writeFileSync(at, text);
    },
  };
}

interface McpReply { result?: { isError?: boolean; content: { text: string }[]; tools?: { name: string; inputSchema: unknown }[] }; error?: unknown }

/** A `lathe mcp` server on the product, as the plugin starts it: requests, tool calls and the notifications it sends. */
export function mcp(root: string) {
  const server = spawn(process.execPath, [BIN, 'mcp', '--root', root], { stdio: ['pipe', 'pipe', 'pipe'] });
  const notifications: string[] = [];
  const waiting = new Map<number, (reply: McpReply) => void>();
  let buffer = '';
  server.stdout.setEncoding('utf8');
  server.stdout.on('data', (chunk: string) => {
    buffer += chunk;
    for (let at = buffer.indexOf('\n'); at >= 0; at = buffer.indexOf('\n')) {
      const message = JSON.parse(buffer.slice(0, at));
      buffer = buffer.slice(at + 1);
      if (message.id === undefined) notifications.push(message.method);
      else waiting.get(message.id)?.(message);
    }
  });
  let next = 0;
  const request = (method: string, params: object = {}) =>
    new Promise<McpReply>((resolve) => {
      const id = ++next;
      waiting.set(id, resolve);
      server.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    });
  return {
    request,
    notifications,
    initialize: () => request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'flow test', version: '1' } }),
    call: (name: string, args: object) => request('tools/call', { name, arguments: args }),
    close: () =>
      new Promise<void>((resolve) => {
        server.on('close', () => resolve());
        server.stdin.end();
      }),
  };
}

/** One row of a data file a flow starts from. */
export interface Seed {
  table: string;
  row: Row;
}

/** An input as an aggregate command's flags: --<field> <value>, a list's flag once per item, an object as JSON. */
export const flags = (input: Record<string, unknown>): string[] =>
  Object.entries(input).flatMap(([field, value]) =>
    Array.isArray(value)
      ? value.flatMap((item) => [`--${field}`, typeof item === 'object' ? JSON.stringify(item) : String(item)])
      : [`--${field}`, typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value)],
  );

/** A row a flow starts from. */
export const add = (table: string, row: Row): Seed => ({ table, row });
/** A link a flow starts from. */
export const link = (source: string, relation: string, target: string): Seed => ({ table: relation, row: { source_id: source, target_id: target } });

/**
 * The lending domain most flows start from: a domain with a loan aggregate, its root entity, a command raising an
 * event, and a capability with a use case and one requirement.
 */
export const LENDING: Seed[] = [
  add('domain', { id: 'TL-LEND', title: 'Lending', product_id: 'TL', subdomain_type: 'core', description: 'Lending tools to members and getting them back.' }),
  add('aggregate', { id: 'TL-LEND-A1', title: 'Loan', domain_id: 'TL-LEND', identity: 'Loan ID', description: 'One tool lent to one member, with its return.' }),
  add('entity', { id: 'TL-LEND-EN01', title: 'Loan', aggregate_id: 'TL-LEND-A1', role: 'root', description: 'The loan itself.' }),
  add('entity_field', { entity_id: 'TL-LEND-EN01', position: 1, name: 'Loan ID', meaning: 'The loan number.', type: 'whole number', required: true, column_name: 'id' }),
  add('command', { id: 'TL-LEND-CMD01', title: 'Open a loan', entity_id: 'TL-LEND-EN01', description: 'Lends a free tool to a member.' }),
  add('domain_event', { id: 'TL-LEND-EV01', title: 'Loan opened', aggregate_id: 'TL-LEND-A1', published: false, description: 'A tool went out on loan.' }),
  link('TL-LEND-CMD01', 'raises', 'TL-LEND-EV01'),
  add('capability', { id: 'TL-LEND-CAP01', title: 'Lending', domain_id: 'TL-LEND', position: 1, description: 'Lending tools and taking them back.' }),
  add('use_case', { id: 'TL-LEND-UC01', title: 'Borrow a tool', capability_id: 'TL-LEND-CAP01', goal: 'A member takes a free tool home.' }),
  add('uc_requirement', { id: 'TL-LEND-UC01-R01', title: 'A tool on loan is refused', use_case_id: 'TL-LEND-UC01', statement: 'The library MUST refuse to lend a tool that is on loan.' }),
];

/** The problems of one check in a workspace, as `record: message`. */
export const problemsOf = (ws: Workspace, check: string): string[] => ws.problems.filter((p) => p.check === check).map((p) => `${p.record}: ${p.message}`);

/** The gaps of a domain's coverage (or the product's Shared, for null), as `missing record`. */
export const gapsOf = (ws: Workspace, domain: string | null): string[] =>
  (ws.coverage.find((c) => c.domain === domain)?.gaps ?? []).map((g) => `${g.missing} ${g.id}`);
