// End to end, as the Owner and the Agent work: the `lathe` command and the `lathe mcp` server, run as child
// processes, build a domain, a use case and a requirement, then link a component and a test to it. The data files
// change line by line as expected, and the data loads with every key and check.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { openStore } from '../../src/index.ts';

const bin = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'bin', 'lathe.ts');
const roots: string[] = [];
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

// A product repo with its config and one product.
function productRepo(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'lathe-writers-'));
  roots.push(root);
  writeFileSync(path.join(root, 'lathe.config.json'), '{}\n');
  mkdirSync(path.join(root, 'data'));
  writeFileSync(path.join(root, 'data', 'product.jsonl'), '{"id":"TL","title":"Tool Library"}\n');
  return root;
}

const lathe = (root: string, ...args: string[]) => {
  const result = spawnSync(process.execPath, [bin, ...args, '--root', root], { encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
};

const data = (root: string) => Object.fromEntries(readdirSync(path.join(root, 'data')).sort().map((f) => [f, readFileSync(path.join(root, 'data', f), 'utf8')]));

const EXPECTED = {
  'component.jsonl': '{"id":"TL-LEND-C01","title":"lending-service.ts","domain_id":"TL-LEND","component_type":"service","file":"src/lending-service.ts"}\n',
  'domain.jsonl': '{"id":"TL-LEND","title":"Lending","product_id":"TL"}\n',
  'product.jsonl': '{"id":"TL","title":"Tool Library"}\n',
  'proves.jsonl': '{"source_id":"TL-LEND-T01","target_id":"TL-LEND-UC01-R01"}\n',
  'requirement.jsonl': '{"id":"TL-LEND-UC01-R01","title":"A tool on loan is refused","use_case_id":"TL-LEND-UC01","statement":"The library MUST refuse to lend a tool that is on loan."}\n',
  'satisfies.jsonl': '{"source_id":"TL-LEND-C01","target_id":"TL-LEND-UC01-R01"}\n',
  'test.jsonl': '{"id":"TL-LEND-T01","title":"A tool on loan is refused","domain_id":"TL-LEND","test_type":"requirement","state":"planned","given":"A tool on loan","when":"A member borrows it","then":"It is refused"}\n',
  'use_case.jsonl': '{"id":"TL-LEND-UC01","title":"Borrow a tool","domain_id":"TL-LEND","goal":"Take a tool home for the loan period."}\n',
};

async function loads(root: string) {
  const store = await openStore(root);
  try {
    return {
      records: ['TL', 'TL-LEND', 'TL-LEND-UC01', 'TL-LEND-UC01-R01', 'TL-LEND-C01', 'TL-LEND-T01'].map((id) => store.record(id)?.kind),
      obligations: await store.query("SELECT id FROM obligation ORDER BY id"),
      parents: await store.query("SELECT id, parent_id FROM record_parent WHERE id LIKE 'TL-LEND%' ORDER BY id"),
    };
  } finally {
    await store.close();
  }
}

const LOADED = {
  records: ['product', 'domain', 'use_case', 'requirement', 'component', 'test'],
  obligations: [{ id: 'TL-LEND-UC01-R01' }],
  parents: [
    { id: 'TL-LEND', parent_id: 'TL' },
    { id: 'TL-LEND-C01', parent_id: 'TL-LEND' },
    { id: 'TL-LEND-T01', parent_id: 'TL-LEND' },
    { id: 'TL-LEND-UC01', parent_id: 'TL-LEND' },
    { id: 'TL-LEND-UC01-R01', parent_id: 'TL-LEND-UC01' },
  ],
};

describe('writing a spec end to end', () => {
  it('with the lathe command', async () => {
    const root = productRepo();
    const run = (...args: string[]) => {
      const result = lathe(root, ...args);
      expect(result.stderr).toBe('');
      expect(result.status).toBe(0);
      return result.stdout.trim();
    };
    run('add', 'domain', '--id', 'TL-LEND', '--title', 'Lending', '--product_id', 'TL');
    expect(run('next-id', 'use_case', '--parent', 'TL-LEND')).toBe('TL-LEND-UC01');
    run('add', 'use_case', '--id', 'TL-LEND-UC01', '--title', 'Borrow a tool', '--domain_id', 'TL-LEND', '--goal', 'Take a tool home for the loan period.');
    expect(run('next-id', 'requirement', '--parent', 'TL-LEND-UC01')).toBe('TL-LEND-UC01-R01');
    run('add', 'requirement', '--id', 'TL-LEND-UC01-R01', '--title', 'A tool on loan is refused', '--use_case_id', 'TL-LEND-UC01', '--statement', 'The library MUST refuse to lend a tool that is on loan.');
    run('add', 'component', '--id', 'TL-LEND-C01', '--title', 'lending-service.ts', '--domain_id', 'TL-LEND', '--component_type', 'service', '--file', 'src/lending-service.ts');
    run('add', 'test', '--id', 'TL-LEND-T01', '--title', 'A tool on loan is refused', '--domain_id', 'TL-LEND', '--test_type', 'requirement', '--state', 'planned', '--given', 'A tool on loan', '--when', 'A member borrows it', '--then', 'It is refused');
    expect(run('link', 'TL-LEND-C01', 'satisfies', 'TL-LEND-UC01-R01')).toBe('Added link TL-LEND-C01 satisfies TL-LEND-UC01-R01\nWrote data/satisfies.jsonl');
    run('link', 'TL-LEND-T01', 'proves', 'TL-LEND-UC01-R01');

    // A refused write leaves every file as it was.
    const before = data(root);
    const refused = lathe(root, 'link', 'TL-LEND-UC01', 'proves', 'TL-LEND-UC01-R01');
    expect(refused.status).toBe(1);
    expect(refused.stderr).toMatch(/^Refused; nothing changed:\n/);
    expect(data(root)).toEqual(before);

    expect(data(root)).toEqual(EXPECTED);
    expect(await loads(root)).toEqual(LOADED);
    expect(run('show', 'TL-LEND-UC01-R01')).toContain('Designed by TL-LEND-C01: lending-service.ts [satisfies, in]');
  });

  it('with the MCP tools, as the plugin starts them', async () => {
    const root = productRepo();
    const server = spawn(process.execPath, [bin, 'mcp', '--root', root], { stdio: ['pipe', 'pipe', 'pipe'] });
    let buffer = '';
    const waiting = new Map<number, (message: { result?: { isError?: boolean; content: { text: string }[] }; error?: unknown }) => void>();
    server.stdout.setEncoding('utf8');
    server.stdout.on('data', (chunk: string) => {
      buffer += chunk;
      for (let at = buffer.indexOf('\n'); at >= 0; at = buffer.indexOf('\n')) {
        const message = JSON.parse(buffer.slice(0, at));
        buffer = buffer.slice(at + 1);
        waiting.get(message.id)?.(message);
      }
    });
    let next = 0;
    const request = (method: string, params: object) =>
      new Promise<{ result?: { isError?: boolean; content: { text: string }[] }; error?: unknown }>((resolve) => {
        const id = ++next;
        waiting.set(id, resolve);
        server.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
      });
    const call = async (name: string, args: object) => {
      const reply = await request('tools/call', { name, arguments: args });
      expect(reply.error).toBeUndefined();
      expect(reply.result!.isError, reply.result!.content[0].text).toBeUndefined();
      return reply.result!.content[0].text;
    };
    try {
      expect((await request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } })).result).toBeDefined();
      await call('add', { domain: { id: 'TL-LEND', title: 'Lending', product_id: 'TL' } });
      expect(await call('next_id', { kind: 'use_case', parent: 'TL-LEND' })).toBe('TL-LEND-UC01');
      await call('add', { use_case: { id: 'TL-LEND-UC01', title: 'Borrow a tool', domain_id: 'TL-LEND', goal: 'Take a tool home for the loan period.' } });
      await call('add', { requirement: { id: 'TL-LEND-UC01-R01', title: 'A tool on loan is refused', use_case_id: 'TL-LEND-UC01', statement: 'The library MUST refuse to lend a tool that is on loan.' } });
      await call('add', { component: { id: 'TL-LEND-C01', title: 'lending-service.ts', domain_id: 'TL-LEND', component_type: 'service', file: 'src/lending-service.ts' } });
      await call('add', { test: { id: 'TL-LEND-T01', title: 'A tool on loan is refused', domain_id: 'TL-LEND', test_type: 'requirement', state: 'planned', given: 'A tool on loan', when: 'A member borrows it', then: 'It is refused' } });
      await call('link', { source: 'TL-LEND-C01', relation: 'satisfies', target: 'TL-LEND-UC01-R01' });
      await call('link', { source: 'TL-LEND-T01', relation: 'proves', target: 'TL-LEND-UC01-R01' });
      const refused = await request('tools/call', { name: 'link', arguments: { source: 'TL-LEND-UC01', relation: 'proves', target: 'TL-LEND-UC01-R01' } });
      expect(refused.result!.isError).toBe(true);
    } finally {
      server.stdin.end();
      await new Promise((resolve) => server.on('close', resolve));
    }
    expect(data(root)).toEqual(EXPECTED);
    expect(await loads(root)).toEqual(LOADED);
  });
});
