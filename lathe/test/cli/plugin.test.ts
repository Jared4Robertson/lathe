// The Claude Code plugin's scripts: the launcher that starts the repo's own `lathe mcp`, and the hook that refuses
// hand edits to data files. Its manifest, MCP config and hook config are checked to point at them.
import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { normalizeRow, openStore, SCHEMA_VERSION, type Row } from '../../src/index.ts';
import { AGGREGATE_COMMANDS, aggregateTool } from '../../src/cli/aggregates.ts';
import { parseInput } from '../../src/platform/commands/definition.ts';
import { everyKind, removeData, writeData } from '../store/fixture.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const pluginDir = path.join(here, '..', '..', '..', 'plugin');
const bin = path.join(here, '..', '..', 'bin', 'lathe.ts');
const roots: string[] = [];
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  removeData();
});

// A product repo with its config, a product, and Lathe "installed" as node_modules/.bin/lathe.
function productRepo(): string {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'lathe-plugin-')));
  roots.push(root);
  writeFileSync(path.join(root, 'lathe.config.json'), `${JSON.stringify({ schema: SCHEMA_VERSION })}\n`);
  mkdirSync(path.join(root, 'data'));
  writeFileSync(path.join(root, 'data', 'product.jsonl'), '{"id":"TL","title":"Tool Library","description":"A neighborhood tool library."}\n');
  mkdirSync(path.join(root, 'node_modules', '.bin'), { recursive: true });
  const shim = path.join(root, 'node_modules', '.bin', 'lathe');
  writeFileSync(shim, `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(bin)} "$@"\n`);
  chmodSync(shim, 0o755);
  return root;
}

const SKILLS = ['discover-outcomes', 'model-a-domain', 'write-use-cases', 'design-interactions', 'write-the-technical-spec', 'plan-tests', 'check-and-fix', 'extend-the-meta-model'];

// Every aggregate of Lathe's model, by the name its tools start with (use_case_add_flow_step is the use-case aggregate's).
const AGGREGATES = [
  'product', 'business-outcome', 'extension-record', 'entry-point', 'tooling', 'domain', 'test-data-set', 'pattern', 'standard',
  'aggregate', 'domain-event', 'command', 'specification', 'value-object', 'read-model', 'table', 'use-case', 'view', 'endpoint',
  'integration', 'ui-component', 'check', 'product-setting', 'pattern-following',
];
// The aggregates whose commands have not landed yet: the skills' examples of their tools are checked against the schema's
// columns and relations only, not against the tools themselves. An aggregate leaves this list as soon as its commands land.
const PENDING = new Set(AGGREGATES.filter((a) => !['use-case', 'product', 'business-outcome', 'extension-record', 'entry-point', 'tooling'].includes(a)));
// The fields of a record's add or change that hold its parts, as lists of rows.
const PARTS = new Set(['fields', 'keys', 'settings', 'roles', 'setting_values', 'packages']);

/** The aggregate a tool belongs to, by the longest aggregate name it starts with. */
const aggregateOf = (tool: string) =>
  AGGREGATES.filter((a) => tool.startsWith(`${a.replaceAll('-', '_')}_`)).sort((a, b) => b.length - a.length)[0];

// The tool calls a skill shows, as \`use_case_add_flow { ... }\`, in its examples or inline.
function examples(text: string): { tool: string; args: Record<string, unknown> }[] {
  const found: { tool: string; args: Record<string, unknown> }[] = [];
  for (const match of text.matchAll(/(?:^|`)([a-z]+(?:_[a-z]+)+) +\{/gm)) {
    const start = match.index! + match[0].length - 1;
    let depth = 0;
    let inString = false;
    for (let i = start; i < text.length; i++) {
      const c = text[i];
      if (inString) {
        if (c === '\\') i++;
        else if (c === '"') inString = false;
      } else if (c === '"') inString = true;
      else if (c === '{') depth++;
      else if (c === '}' && --depth === 0) {
        found.push({ tool: match[1], args: JSON.parse(text.slice(start, i + 1)) });
        break;
      }
    }
  }
  return found;
}

// Every tool a skill names in backticks, such as `domain_add_capability`.
const TOOL_NAME = /`([a-z]+(?:_[a-z]+)*_(?:add|change|remove|move|get|list|next_id|follow|stop)(?:_[a-z]+)*)`/g;

const guard = (input: object) => spawnSync(process.execPath, [path.join(pluginDir, 'scripts', 'guard-data-files.mjs')], { input: JSON.stringify(input), encoding: 'utf8' });

describe('the plugin', () => {
  it('LA-CHK-UC08-R03-T01 declares the MCP server and the guard hook, and every script they name exists', () => {
    const mcp = JSON.parse(readFileSync(path.join(pluginDir, '.mcp.json'), 'utf8'));
    expect(mcp.mcpServers.lathe).toEqual({ command: 'node', args: ['${CLAUDE_PLUGIN_ROOT}/scripts/mcp-server.mjs'] });
    const hooks = JSON.parse(readFileSync(path.join(pluginDir, 'hooks', 'hooks.json'), 'utf8'));
    expect(Object.keys(hooks.hooks)).toEqual(['PreToolUse']);
    const scripts = [...JSON.stringify([mcp, hooks]).matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/([^"]+)/g)].map((m) => m[1]);
    expect(scripts).toEqual(['scripts/mcp-server.mjs', 'scripts/guard-data-files.mjs']);
    for (const script of scripts) expect(existsSync(path.join(pluginDir, script))).toBe(true);
  });

  it('LA-PAT-AGGREGATE-COMMANDS-R06-T01 no skill tells the Agent to write spec files by hand', () => {
    for (const skill of SKILLS) {
      const text = readFileSync(path.join(pluginDir, 'skills', skill, 'SKILL.md'), 'utf8');
      expect(text, skill).not.toMatch(/specs\/|```markdown|^---\nid:|YAML|header|FORMAT\.md|metaExtensions|kinds\.csv|relations\.csv|lathe format|\b(?!REFERENCE\.md\b)[\w-]+\.md\b/m);
      expect(text, skill).toMatch(/Lathe's MCP tools/);
    }
  });

  it("LA-PAT-AGGREGATE-COMMANDS-R06-T01 every example in the skills runs an aggregate's own tool, with the fields it takes", async () => {
    // An aggregate whose commands have landed is not pending any more.
    expect(AGGREGATE_COMMANDS.filter((a) => PENDING.has(a)), 'landed: remove from PENDING').toEqual([]);
    for (const skill of SKILLS) {
      const text = readFileSync(path.join(pluginDir, 'skills', skill, 'SKILL.md'), 'utf8');
      const calls = examples(text);
      // The product's own kinds and relations an example declares are part of the schema its other examples use.
      const declared = calls.filter((c) => c.tool === 'product_declare_product_kind').map((c) => c.args as Row & { fields?: Row[] });
      const data = everyKind();
      const store = await openStore(
        writeData({
          ...data,
          product_kind: [...data.product_kind, ...declared.map(({ fields, ...kind }) => kind)],
          product_kind_field: [...data.product_kind_field, ...declared.flatMap((k) => (k.fields ?? []).map((f, at) => ({ kind: k.name, position: at + 1, ...f })))],
          product_relation: [...data.product_relation, ...calls.filter((c) => c.tool === 'product_declare_product_relation').map((c) => c.args as Row)],
        }),
      );
      const schema = store.schema;
      await store.close();
      // Every tool the skill names belongs to an aggregate, and exists once its aggregate has landed.
      for (const [, tool] of text.matchAll(TOOL_NAME)) {
        const aggregate = aggregateOf(tool);
        expect(aggregate, `${skill}: ${tool} names no aggregate`).toBeDefined();
        if (!PENDING.has(aggregate!)) expect(aggregateTool(tool), `${skill}: there is no tool ${tool}`).toBeDefined();
      }
      for (const { tool, args } of calls) {
        const where = `${skill}: ${tool} ${JSON.stringify(args)}`;
        const aggregate = aggregateOf(tool);
        expect(aggregate, where).toBeDefined();
        if (!PENDING.has(aggregate!)) {
          const found = aggregateTool(tool);
          expect(found, where).toBeDefined();
          expect(() => parseInput(schema, found!.definition, args), where).not.toThrow();
          continue;
        }
        // A pending aggregate's tool: its fields are its kind's columns, the relations it starts, and its parts.
        const command = /^(add|change|remove|move)_(.+)$/.exec(tool.slice(aggregate!.length + 1));
        if (!command) continue;
        const kind = tool === 'extension_record_add_extension_record' || tool === 'extension_record_change_extension_record' ? String(args.kind) : command[2];
        const table = schema.tables[kind];
        expect(table?.stored, `${where}: no table ${kind}`).toBe(true);
        const fields = Object.keys(args).filter((f) => !(kind !== command[2] && f === 'kind'));
        const columns = new Set(table.columns.map((c) => c.name));
        for (const field of fields) expect(columns.has(field) || field in schema.relations || PARTS.has(field), `${where}: ${field}`).toBe(true);
        const row = Object.fromEntries(fields.filter((f) => columns.has(f)).map((f) => [f, args[f]])) as Row;
        if (command[1] === 'add') expect(normalizeRow(table, row), where).toEqual({ row: expect.any(Object) });
        else expect(Object.keys(row), where).toEqual(expect.arrayContaining(table.primaryKey));
      }
      expect(calls.length, skill).toBeGreaterThan(skill === 'check-and-fix' ? -1 : 0);
    }
  }, 60_000);
});

describe('the guard hook', () => {
  it('LA-CHK-UC08-R01-T01 refuses an edit of a data file and points at the tools', () => {
    const root = productRepo();
    const result = guard({ tool_name: 'Edit', tool_input: { file_path: path.join(root, 'data', 'product.jsonl') } });
    expect(result.status).toBe(0);
    const decision = JSON.parse(result.stdout).hookSpecificOutput;
    expect(decision).toMatchObject({ hookEventName: 'PreToolUse', permissionDecision: 'deny' });
    expect(decision.permissionDecisionReason).toContain("data/product.jsonl is Lathe data: change it only with Lathe's MCP tools");
    // A relative path, and a configured data folder.
    writeFileSync(path.join(root, 'lathe.config.json'), `${JSON.stringify({ schema: SCHEMA_VERSION, data: 'spec-data' })}\n`);
    expect(guard({ tool_name: 'Write', cwd: root, tool_input: { file_path: 'spec-data/view.jsonl' } }).stdout).toContain('"deny"');
  });

  it('LA-CHK-UC08-R02-T01 lets every other edit through, silently', () => {
    const root = productRepo();
    for (const file of [path.join(root, 'src', 'app.ts'), path.join(root, 'notes', 'rows.jsonl'), path.join(tmpdir(), 'elsewhere', 'data', 'x.jsonl')]) {
      const result = guard({ tool_name: 'Write', tool_input: { file_path: file } });
      expect(result.status).toBe(0);
      expect(result.stdout).toBe('');
    }
    expect(guard({}).stdout).toBe('');
  });
});

describe('the MCP launcher', () => {
  it("LA-INT01-T03 starts the repo's own lathe mcp for the project folder", async () => {
    const root = productRepo();
    const server = spawn(process.execPath, [path.join(pluginDir, 'scripts', 'mcp-server.mjs')], { env: { ...process.env, CLAUDE_PROJECT_DIR: root }, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    server.stdout.on('data', (chunk) => (out += chunk));
    server.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {} } })}\n`);
    server.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'show', arguments: { id: 'TL' } } })}\n`);
    server.stdin.end();
    const code = await new Promise((resolve) => server.on('close', resolve));
    expect(code).toBe(0);
    const messages = out.trim().split('\n').map((l) => JSON.parse(l));
    expect(messages[0].result.serverInfo.name).toBe('lathe');
    expect(messages[1].result.content[0].text).toBe('Product TL: Tool Library\n  kind: product\n  description: A neighborhood tool library.');
  });

  it('LA-PLT-UC18-R01-T01 LA-PLT-UC18-FL04-T warns once, in the first tool result, when the installed Lathe is not the major version the skills were written for', async () => {
    const major = JSON.parse(readFileSync(path.join(pluginDir, '.claude-plugin', 'plugin.json'), 'utf8')).lathe.major;
    expect(major).toBe(Number(JSON.parse(readFileSync(path.join(here, '..', '..', 'package.json'), 'utf8')).version.split('.')[0]));
    // The tool results for two show calls, with the installed Lathe at the given version.
    const results = async (version: string) => {
      const root = productRepo();
      const installed = path.join(root, 'node_modules', '@jaredrob', 'lathe');
      mkdirSync(path.join(installed, 'schema'), { recursive: true });
      writeFileSync(path.join(installed, 'package.json'), JSON.stringify({ name: '@jaredrob/lathe', version }));
      writeFileSync(path.join(installed, 'schema', 'version.json'), '{ "schema": 7 }\n');
      const server = spawn(process.execPath, [path.join(pluginDir, 'scripts', 'mcp-server.mjs')], { env: { ...process.env, CLAUDE_PROJECT_DIR: root }, stdio: ['pipe', 'pipe', 'pipe'] });
      let out = '';
      server.stdout.on('data', (chunk) => (out += chunk));
      server.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {} } })}\n`);
      for (const id of [2, 3]) server.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name: 'show', arguments: { id: 'TL' } } })}\n`);
      server.stdin.end();
      expect(await new Promise((resolve) => server.on('close', resolve))).toBe(0);
      return { root, calls: out.trim().split('\n').map((l) => JSON.parse(l)).slice(1).map((m) => m.result.content.map((c: { text: string }) => c.text)) };
    };
    const other = await results(`${major + 1}.3.0`);
    expect(other.calls).toEqual([
      [
        'Product TL: Tool Library\n  kind: product\n  description: A neighborhood tool library.',
        `Warning: the Lathe plugin's skills were written for Lathe ${major}.x, but ${other.root} has Lathe ${major + 1}.3.0 (schema 7). ` +
          "The tools match the installed Lathe, but the skills may name tables, columns or steps it does not have: update the plugin or the product's @jaredrob/lathe so their major versions match.",
      ],
      ['Product TL: Tool Library\n  kind: product\n  description: A neighborhood tool library.'],
    ]);
    // The same major version: no warning.
    expect((await results(`${major}.9.1`)).calls).toEqual([['Product TL: Tool Library\n  kind: product\n  description: A neighborhood tool library.'], ['Product TL: Tool Library\n  kind: product\n  description: A neighborhood tool library.']]);
  });

  it('LA-INT01-T03 LA-PLT-UC18-R02-T01 says why it cannot start outside a Lathe repo', () => {
    const empty = realpathSync(mkdtempSync(path.join(tmpdir(), 'lathe-plugin-none-')));
    roots.push(empty);
    const result = spawnSync(process.execPath, [path.join(pluginDir, 'scripts', 'mcp-server.mjs')], { env: { ...process.env, CLAUDE_PROJECT_DIR: empty }, encoding: 'utf8', input: '' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('need a lathe.config.json');
  });
});
