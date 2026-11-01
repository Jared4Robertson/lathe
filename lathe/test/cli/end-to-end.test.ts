// End to end, as the Agent works: the `lathe mcp` server, run as a child process, writes a small product through one
// tool per aggregate command: a domain, an aggregate with its root entity and fields, a command raising an event,
// then a capability, a use case and its requirement, the product's interface, the use case's flow through it with a
// step that invokes the command and fulfills the requirement, and a use case test under the requirement. The data
// files change line by line as expected, a refused command changes nothing, and the data loads with every key and check.
import { spawn } from 'node:child_process';
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
  writeFileSync(path.join(root, 'data', 'product.jsonl'), '{"id":"TL","title":"Tool Library","description":"A neighborhood tool library."}\n');
  return root;
}

const data = (root: string) => Object.fromEntries(readdirSync(path.join(root, 'data')).sort().map((f) => [f, readFileSync(path.join(root, 'data', f), 'utf8')]));

// The records and rows the Agent writes, in the order they are written.
const DOMAIN = { id: 'TL-LEND', title: 'Lending', product_id: 'TL', subdomain_type: 'core', description: 'Lending tools to members and getting them back.' };
const AGGREGATE = { id: 'TL-LEND-A1', title: 'Loan', domain_id: 'TL-LEND', description: 'One tool lent to one member, with its due date.', identity: 'Loan ID' };
const ENTITY = { id: 'TL-LEND-EN01', title: 'Loan', aggregate_id: 'TL-LEND-A1', role: 'root', description: 'The loan itself.' };
const FIELDS: Record<string, string | number | boolean>[] = [
  { entity_id: 'TL-LEND-EN01', position: 1, name: 'Loan ID', meaning: 'The library\'s number for the loan.', type: 'whole number', required: true, column_name: 'id' },
  { entity_id: 'TL-LEND-EN01', position: 2, name: 'Due date', meaning: 'The last day of the loan.', type: 'date', required: true },
];
const COMMAND = { id: 'TL-LEND-CMD01', title: 'Borrow a tool', entity_id: 'TL-LEND-EN01', description: 'Lends a free tool to a member.' };
const EVENT = { id: 'TL-LEND-EV01', title: 'Loan opened', aggregate_id: 'TL-LEND-A1', published: false, description: 'A tool went out on loan.' };
const CAPABILITY = { id: 'TL-LEND-CAP01', title: 'Lending', domain_id: 'TL-LEND', position: 1, description: 'Lending tools and taking them back.' };
const USE_CASE = { id: 'TL-LEND-UC01', title: 'Borrow a tool', capability_id: 'TL-LEND-CAP01', goal: 'Take a tool home for the loan period.' };
const REQUIREMENT = { id: 'TL-LEND-UC01-R01', title: 'A tool on loan is refused', use_case_id: 'TL-LEND-UC01', statement: 'The library MUST refuse to lend a tool that is on loan.' };
const INTERFACE = { id: 'TL-IF01', title: 'HTTP API', product_id: 'TL', kind: 'API', description: 'The API the desk app calls.', public: false };
const FLOW = { id: 'TL-LEND-UC01-FL01', title: 'Borrow a tool', use_case_id: 'TL-LEND-UC01', interface_id: 'TL-IF01' };
const STEP = { id: 'TL-LEND-UC01-FL01-S01', title: 'The member borrows a free tool', flow_id: 'TL-LEND-UC01-FL01', path: 'main', position: 1 };
const TEST = { id: 'TL-LEND-UC01-R01-T01', title: 'A tool on loan is refused', uc_requirement_id: 'TL-LEND-UC01-R01', level: 'service', state: 'not automated yet', when: 'With a tool on loan, a member borrows it', then: 'It is refused' };

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
  'product.jsonl': line({ id: 'TL', title: 'Tool Library', description: 'A neighborhood tool library.' }),
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

describe('writing a spec end to end', () => {
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
      await call('domain_add_domain', DOMAIN);
      await call('aggregate_add_aggregate', AGGREGATE);
      const { aggregate_id: _, ...entity } = ENTITY;
      await call('aggregate_add_entity', { ...entity, aggregate_id: 'TL-LEND-A1', fields: FIELDS.map(({ entity_id: _e, position: _p, ...field }) => field) });
      expect(await call('command_next_id', { kind: 'command', parent: 'TL-LEND-EN01' })).toBe('TL-LEND-CMD01');
      await call('domain_event_add_domain_event', EVENT);
      await call('command_add_command', { ...COMMAND, raises: ['TL-LEND-EV01'] });
      await call('domain_add_capability', CAPABILITY);
      await call('use_case_add_use_case', USE_CASE);
      await call('use_case_add_uc_requirement', REQUIREMENT);
      await call('product_add_interface', INTERFACE);
      await call('use_case_add_flow', FLOW);
      await call('use_case_add_flow_step', { ...STEP, invokes: 'TL-LEND-CMD01', fulfills: ['TL-LEND-UC01-R01'] });
      await call('use_case_add_use_case_test', TEST);
      // A step invokes a command or query, not an event: refused, and no file changes.
      const before = data(root);
      const refused = await request('tools/call', { name: 'use_case_change_flow_step', arguments: { id: 'TL-LEND-UC01-FL01-S01', invokes: 'TL-LEND-EV01' } });
      expect(data(root)).toEqual(before);
      expect(refused.result!.isError).toBe(true);
    } finally {
      server.stdin.end();
      await new Promise((resolve) => server.on('close', resolve));
    }
    expect(data(root)).toEqual(EXPECTED);
    expect(await loads(root)).toEqual(LOADED);
  }, 120_000);
});
