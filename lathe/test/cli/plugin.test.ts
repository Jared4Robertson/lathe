// The Claude Code plugin's scripts: the launcher that starts the repo's own `lathe mcp`, and the hook that refuses
// hand edits to data files. Its manifest, MCP config and hook config are checked to point at them.
import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { normalizeRow, openStore, SCHEMA_VERSION, type Row } from '../../src/index.ts';
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
  writeFileSync(path.join(root, 'data', 'product.jsonl'), '{"id":"TL","title":"Tool Library"}\n');
  mkdirSync(path.join(root, 'node_modules', '.bin'), { recursive: true });
  const shim = path.join(root, 'node_modules', '.bin', 'lathe');
  writeFileSync(shim, `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(bin)} "$@"\n`);
  chmodSync(shim, 0o755);
  return root;
}

const SKILLS = ['discover-outcomes', 'model-a-domain', 'write-use-cases', 'design-interactions', 'write-the-technical-spec', 'plan-tests', 'check-and-fix', 'extend-the-meta-model'];

// The tool calls a skill shows, as \`add { ... }\`, \`set { ... }\` or \`link { ... }\`, in its examples or inline.
function examples(text: string): { op: string; args: Record<string, unknown> }[] {
  const found: { op: string; args: Record<string, unknown> }[] = [];
  for (const match of text.matchAll(/(?:^|`)(add|set|link|unlink|remove|move) +\{/gm)) {
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
        found.push({ op: match[1], args: JSON.parse(text.slice(start, i + 1)) });
        break;
      }
    }
  }
  return found;
}

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

  it('LA-AUT-UC01-R08-T01 no skill tells the Agent to write spec files by hand', () => {
    for (const skill of SKILLS) {
      const text = readFileSync(path.join(pluginDir, 'skills', skill, 'SKILL.md'), 'utf8');
      expect(text, skill).not.toMatch(/specs\/|```markdown|^---\nid:|YAML|header|FORMAT\.md|metaExtensions|kinds\.csv|relations\.csv|lathe format|\b(?!REFERENCE\.md\b)[\w-]+\.md\b/m);
      expect(text, skill).toMatch(/Lathe's MCP tools/);
    }
  });

  it("LA-AUT-UC01-R08-T02 every example in the skills names real tables, columns and relations, with values of the columns' types", async () => {
    for (const skill of SKILLS) {
      const writes = examples(readFileSync(path.join(pluginDir, 'skills', skill, 'SKILL.md'), 'utf8'));
      // The product's own kinds and relations an example declares are part of the schema its other examples use.
      const declared = (table: string) => writes.filter((w) => w.op === 'add' && Object.keys(w.args)[0] === table).map((w) => Object.values(w.args)[0] as Row);
      const data = everyKind();
      const store = await openStore(
        writeData({
          ...data,
          product_kind: [...data.product_kind, ...declared('product_kind')],
          product_kind_field: [...data.product_kind_field, ...declared('product_kind_field')],
          product_relation: [...data.product_relation, ...declared('product_relation')],
        }),
      );
      const schema = store.schema;
      await store.close();
      for (const { op, args } of writes) {
        const where = `${skill}: ${op} ${JSON.stringify(args)}`;
        if (op === 'link' || op === 'unlink') {
          expect(Object.keys(schema.relations), where).toContain(args.relation);
          continue;
        }
        const [table, row] = Object.entries(args)[0] as [string, Row];
        expect(schema.tables[table]?.stored, where).toBe(true);
        if (op === 'add') expect(normalizeRow(schema.tables[table], row), where).toEqual({ row: expect.any(Object) });
        if (op === 'set') {
          const columns = schema.tables[table].columns.map((c) => c.name);
          for (const column of Object.keys(row)) expect(columns, where).toContain(column);
          for (const key of schema.tables[table].primaryKey) expect(Object.keys(row), where).toContain(key);
        }
      }
      expect(writes.length, skill).toBeGreaterThan(skill === 'check-and-fix' ? -1 : 0);
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
    expect(messages[1].result.content[0].text).toBe('Product TL: Tool Library\n  kind: product');
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
        'Product TL: Tool Library\n  kind: product',
        `Warning: the Lathe plugin's skills were written for Lathe ${major}.x, but ${other.root} has Lathe ${major + 1}.3.0 (schema 7). ` +
          "The tools match the installed Lathe, but the skills may name tables, columns or steps it does not have: update the plugin or the product's @jaredrob/lathe so their major versions match.",
      ],
      ['Product TL: Tool Library\n  kind: product'],
    ]);
    // The same major version: no warning.
    expect((await results(`${major}.9.1`)).calls).toEqual([['Product TL: Tool Library\n  kind: product'], ['Product TL: Tool Library\n  kind: product']]);
  });

  it('LA-INT01-T03 says why it cannot start outside a Lathe repo', () => {
    const empty = realpathSync(mkdtempSync(path.join(tmpdir(), 'lathe-plugin-none-')));
    roots.push(empty);
    const result = spawnSync(process.execPath, [path.join(pluginDir, 'scripts', 'mcp-server.mjs')], { env: { ...process.env, CLAUDE_PROJECT_DIR: empty }, encoding: 'utf8', input: '' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('need a lathe.config.json');
  });
});
