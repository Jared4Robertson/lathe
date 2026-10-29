// End to end, as the Owner and the Agent work: the `lathe` command and the `lathe mcp` server, run as child
// processes, write a small product in the domain model: a domain, an aggregate with its root entity and fields, a
// command raising an event, then a capability, a use case and its requirement, the product's interface, the use case's flow through it with a step that
// invokes the command and fulfills the requirement, and a use case test under the requirement. The data files change
// line by line as expected, a refused write changes nothing, and the data loads with every key and check.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { openStore, SCHEMA_VERSION } from '../../src/index.ts';

const bin = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'bin', 'lathe.ts');
const roots: string[] = [];
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

// A product repo with its config and one product.
function productRepo(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'lathe-writers-'));
  roots.push(root);
  writeFileSync(path.join(root, 'lathe.config.json'), `${JSON.stringify({ schema: SCHEMA_VERSION })}\n`);
  mkdirSync(path.join(root, 'data'));
  writeFileSync(path.join(root, 'data', 'product.jsonl'), '{"id":"TL","title":"Tool Library"}\n');
  return root;
}

const lathe = (root: string, ...args: string[]) => piped(root, '', ...args);
// The command with its stdin, as a shell pipes JSON into `--json -`.
const piped = (root: string, input: string, ...args: string[]) => {
  const result = spawnSync(process.execPath, [bin, ...args, '--root', root], { encoding: 'utf8', input });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
};

const data = (root: string) => Object.fromEntries(readdirSync(path.join(root, 'data')).sort().map((f) => [f, readFileSync(path.join(root, 'data', f), 'utf8')]));

// The records and rows both writers make, in the order they are written, as each writer takes them.
const DOMAIN = { id: 'TL-LEND', title: 'Lending', product_id: 'TL', subdomain_type: 'core' };
const AGGREGATE = { id: 'TL-LEND-A1', title: 'Loan', domain_id: 'TL-LEND', identity: 'Loan ID' };
const ENTITY = { id: 'TL-LEND-EN01', title: 'Loan', aggregate_id: 'TL-LEND-A1', role: 'root' };
const FIELDS: Record<string, string | number | boolean>[] = [
  { entity_id: 'TL-LEND-EN01', position: 1, name: 'Loan ID', meaning: 'The library\'s number for the loan.', type: 'whole number', required: true, column_name: 'id' },
  { entity_id: 'TL-LEND-EN01', position: 2, name: 'Due date', meaning: 'The last day of the loan.', type: 'date', required: true },
];
const COMMAND = { id: 'TL-LEND-CMD01', title: 'Borrow a tool', aggregate_id: 'TL-LEND-A1' };
const EVENT = { id: 'TL-LEND-EV01', title: 'Loan opened', aggregate_id: 'TL-LEND-A1', published: false };
const CAPABILITY = { id: 'TL-LEND-CAP01', title: 'Lending', domain_id: 'TL-LEND', position: 1 };
const USE_CASE = { id: 'TL-LEND-UC01', title: 'Borrow a tool', capability_id: 'TL-LEND-CAP01', goal: 'Take a tool home for the loan period.' };
const REQUIREMENT = { id: 'TL-LEND-UC01-R01', title: 'A tool on loan is refused', use_case_id: 'TL-LEND-UC01', statement: 'The library MUST refuse to lend a tool that is on loan.' };
const INTERFACE = { id: 'TL-IF01', title: 'HTTP API', product_id: 'TL', kind: 'API' };
const FLOW = { id: 'TL-LEND-UC01-FL01', title: 'Borrow a tool', use_case_id: 'TL-LEND-UC01', interface_id: 'TL-IF01' };
const STEP = { id: 'TL-LEND-UC01-FL01-S01', title: 'The member borrows a free tool', flow_id: 'TL-LEND-UC01-FL01', path: 'main', position: 1 };
const TEST = { id: 'TL-LEND-UC01-R01-T01', title: 'A tool on loan is refused', uc_requirement_id: 'TL-LEND-UC01-R01', level: 'service', state: 'not automated yet', given: 'A tool on loan', when: 'A member borrows it', then: 'It is refused' };
const LINKS: [string, string, string][] = [
  ['TL-LEND-CMD01', 'raises', 'TL-LEND-EV01'],
  ['TL-LEND-UC01-FL01-S01', 'invokes', 'TL-LEND-CMD01'],
  ['TL-LEND-UC01-FL01-S01', 'fulfills', 'TL-LEND-UC01-R01'],
];

const line = (row: object) => `${JSON.stringify(row)}\n`;
const EXPECTED = {
  'aggregate.jsonl': line(AGGREGATE),
  'capability.jsonl': line(CAPABILITY),
  'command.jsonl': line(COMMAND),
  'domain.jsonl': line(DOMAIN),
  'domain_event.jsonl': line(EVENT),
  'entity.jsonl': line(ENTITY),
  'entity_field.jsonl': FIELDS.map(line).join(''),
  'flow.jsonl': line(FLOW),
  'interface.jsonl': line(INTERFACE),
  'flow_step.jsonl': line(STEP),
  'fulfills.jsonl': line({ source_id: 'TL-LEND-UC01-FL01-S01', target_id: 'TL-LEND-UC01-R01' }),
  'invokes.jsonl': line({ source_id: 'TL-LEND-UC01-FL01-S01', target_id: 'TL-LEND-CMD01' }),
  'product.jsonl': line({ id: 'TL', title: 'Tool Library' }),
  'raises.jsonl': line({ source_id: 'TL-LEND-CMD01', target_id: 'TL-LEND-EV01' }),
  'uc_requirement.jsonl': line(REQUIREMENT),
  'use_case.jsonl': line(USE_CASE),
  'use_case_test.jsonl': line(TEST),
};

async function loads(root: string) {
  const store = await openStore(root);
  try {
    return {
      records: ['TL', 'TL-LEND', 'TL-LEND-A1', 'TL-LEND-EN01', 'TL-LEND-CMD01', 'TL-LEND-EV01', 'TL-LEND-UC01', 'TL-LEND-UC01-R01', 'TL-LEND-UC01-FL01', 'TL-LEND-UC01-FL01-S01', 'TL-LEND-UC01-R01-T01'].map(
        (id) => store.record(id)?.kind,
      ),
      obligations: await store.query('SELECT id FROM obligation ORDER BY id'),
      scope: await store.query("SELECT id, domain_id, aggregate_id FROM record_scope WHERE id IN ('TL-LEND-EV01', 'TL-LEND-UC01-R01-T01') ORDER BY id"),
    };
  } finally {
    await store.close();
  }
}

const LOADED = {
  records: ['product', 'domain', 'aggregate', 'entity', 'command', 'domain_event', 'use_case', 'uc_requirement', 'flow', 'flow_step', 'use_case_test'],
  obligations: [{ id: 'TL-LEND-UC01-R01' }],
  scope: [
    { id: 'TL-LEND-EV01', domain_id: 'TL-LEND', aggregate_id: 'TL-LEND-A1' },
    { id: 'TL-LEND-UC01-R01-T01', domain_id: 'TL-LEND', aggregate_id: null },
  ],
};

// A row as `lathe add` flags.
const flags = (row: Record<string, string | number | boolean>) => Object.entries(row).flatMap(([column, value]) => [`--${column}`, String(value)]);

describe('writing a spec end to end', () => {
  it('LA-AUT-UC01-FL03-T with the lathe command', async () => {
    const root = productRepo();
    const run = (...args: string[]) => {
      const result = lathe(root, ...args);
      expect(result.stderr).toBe('');
      expect(result.status).toBe(0);
      return result.stdout.trim();
    };
    run('add', 'domain', ...flags(DOMAIN));
    expect(run('next-id', 'aggregate', '--parent', 'TL-LEND')).toBe('TL-LEND-A1');
    run('add', 'aggregate', ...flags(AGGREGATE));
    expect(run('next-id', 'entity', '--parent', 'TL-LEND-A1')).toBe('TL-LEND-EN01');
    run('add', 'entity', ...flags(ENTITY));
    for (const field of FIELDS) run('add', 'entity_field', ...flags(field));
    run('add', 'command', ...flags(COMMAND));
    expect(run('next-id', 'domain_event', '--parent', 'TL-LEND-A1')).toBe('TL-LEND-EV01');
    run('add', 'domain_event', ...flags(EVENT));
    run('add', 'capability', ...flags(CAPABILITY));
    expect(run('next-id', 'use_case', '--parent', 'TL-LEND-CAP01')).toBe('TL-LEND-UC01');
    run('add', 'use_case', ...flags(USE_CASE));
    // A write's fields as JSON on stdin, in the add tool's shape: the result comes back as JSON.
    const fromStdin = piped(root, JSON.stringify({ uc_requirement: REQUIREMENT }), 'add', '--json', '-');
    expect(fromStdin.status).toBe(0);
    expect(JSON.parse(fromStdin.stdout).changes).toEqual([expect.objectContaining({ change: 'added', key: 'TL-LEND-UC01-R01', row: REQUIREMENT })]);
    expect(run('next-id', 'interface', '--parent', 'TL')).toBe('TL-IF01');
    run('add', 'interface', ...flags(INTERFACE));
    expect(run('next-id', 'flow', '--parent', 'TL-LEND-UC01')).toBe('TL-LEND-UC01-FL01');
    run('add', 'flow', ...flags(FLOW));
    expect(run('next-id', 'flow_step', '--parent', 'TL-LEND-UC01-FL01')).toBe('TL-LEND-UC01-FL01-S01');
    run('add', 'flow_step', ...flags(STEP));
    expect(run('next-id', 'use_case_test', '--parent', 'TL-LEND-UC01-R01')).toBe('TL-LEND-UC01-R01-T01');
    run('add', 'use_case_test', ...flags(TEST));
    // Several links from a file, as one write.
    const links = path.join(root, 'links.json');
    writeFileSync(links, JSON.stringify(LINKS.map(([source, relation, target]) => ({ source, relation, target }))));
    expect(JSON.parse(run('link', '--json', links)).changes).toHaveLength(LINKS.length);
    rmSync(links);

    // A refused write leaves every file as it was: a step invokes a command or query, not an event.
    const before = data(root);
    const refused = lathe(root, 'link', 'TL-LEND-UC01-FL01-S01', 'invokes', 'TL-LEND-EV01');
    expect(refused.status).toBe(1);
    expect(refused.stderr).toMatch(/^Refused; nothing changed:\n/);
    expect(data(root)).toEqual(before);

    expect(data(root)).toEqual(EXPECTED);
    expect(await loads(root)).toEqual(LOADED);
    expect(run('show', 'TL-LEND-UC01-R01')).toContain('Fulfilled by TL-LEND-UC01-FL01-S01: The member borrows a free tool [fulfills, in]');
  }, 120_000);

  it('LA-INT01-T01 with the MCP tools, as the plugin starts them', async () => {
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
      await call('add', { domain: DOMAIN });
      await call('add', { aggregate: AGGREGATE });
      await call('add', { entity: ENTITY });
      for (const field of FIELDS) await call('add', { entity_field: field });
      expect(await call('next_id', { kind: 'command', parent: 'TL-LEND-A1' })).toBe('TL-LEND-CMD01');
      await call('add', { command: COMMAND });
      await call('add', { domain_event: EVENT });
      await call('add', { capability: CAPABILITY });
      await call('add', { use_case: USE_CASE });
      await call('add', { uc_requirement: REQUIREMENT });
      await call('add', { interface: INTERFACE });
      await call('add', { flow: FLOW });
      await call('add', { flow_step: STEP });
      await call('add', { use_case_test: TEST });
      for (const [source, relation, target] of LINKS) await call('link', { source, relation, target });
      const refused = await request('tools/call', { name: 'link', arguments: { source: 'TL-LEND-UC01-FL01-S01', relation: 'invokes', target: 'TL-LEND-EV01' } });
      expect(refused.result!.isError).toBe(true);
    } finally {
      server.stdin.end();
      await new Promise((resolve) => server.on('close', resolve));
    }
    expect(data(root)).toEqual(EXPECTED);
    expect(await loads(root)).toEqual(LOADED);
  }, 120_000);
});
