// The CLI's data commands, run in process: each write goes through the command layer, prints the rows it changed,
// and on a refusal prints every reason and changes nothing; flags and help come from the schema.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { openStore } from '../../src/index.ts';
import { runDataCommand } from '../../src/cli/writers.ts';
import { everyKind, removeData, writeData } from '../store/fixture.ts';

afterAll(removeData);

// Each command opens the store, and several run per test: give them room on a busy machine.
vi.setConfig({ testTimeout: 30_000 });

async function lathe(root: string, ...args: string[]) {
  let out = '';
  let err = '';
  const status = await runDataCommand([...args, '--root', root], { out: (t) => (out += `${t}\n`), err: (t) => (err += `${t}\n`) });
  return { status, out, err };
}

const files = (root: string) => Object.fromEntries(readdirSync(path.join(root, 'data')).map((f) => [f, readFileSync(path.join(root, 'data', f), 'utf8')]));
const line = (root: string, table: string, id: string) =>
  readFileSync(path.join(root, 'data', `${table}.jsonl`), 'utf8')
    .split('\n')
    .find((l) => l.includes(`"id":"${id}"`));

describe('lathe add', () => {
  it('LA-AUT-UC01-R05-T01 adds a record from its column flags and prints the row and the file', async () => {
    const root = writeData(everyKind());
    const result = await lathe(root, 'add', 'capability', '--id', 'TL-LEND-CAP02', '--title', 'Returns', '--domain_id', 'TL-LEND', '--position', '2');
    expect(result).toEqual({
      status: 0,
      out: 'Added capability TL-LEND-CAP02: {"id":"TL-LEND-CAP02","title":"Returns","domain_id":"TL-LEND","position":2}\nWrote data/capability.jsonl\n',
      err: '',
    });
    expect(line(root, 'capability', 'TL-LEND-CAP02')).toBe('{"id":"TL-LEND-CAP02","title":"Returns","domain_id":"TL-LEND","position":2}');
  });

  it('adds a kind with no owner, and one of a kind with two possible parents', async () => {
    const root = writeData(everyKind());
    expect((await lathe(root, 'add', 'view', '--id', 'TL-V02', '--title', 'Return desk')).out).toBe('Added view TL-V02: {"id":"TL-V02","title":"Return desk"}\nWrote data/view.jsonl\n');
    expect((await lathe(root, 'add', 'specification', '--id', 'TL-LEND-SP02', '--title', 'Tool needs repair', '--statement', 'A tool needs repair when its condition says so.')).status).toBe(0);
    const endpoint = await lathe(root, 'add', 'endpoint', '--id', 'TL-LEND-EP02', '--title', 'List free tools', '--query_id', 'TL-LEND-QRY01', '--method', 'GET', '--route', '/tools');
    expect(endpoint.out).toContain('Added endpoint TL-LEND-EP02: {"id":"TL-LEND-EP02","title":"List free tools","query_id":"TL-LEND-QRY01","method":"GET","route":"/tools"}');
    expect((await lathe(root, 'add', 'table', '--id', 'TL-LEND-EN02-TB', '--title', 'Returns', '--entity_id', 'TL-LEND-EN02', '--name', 'returns', '--storage', 'table')).err).toContain('[entity-table]');
  });

  it('says which parent to give when a kind has two, before the table rule', async () => {
    const root = writeData(everyKind());
    const both = await lathe(root, 'add', 'endpoint', '--id', 'TL-LEND-EP02', '--title', 'X', '--command_id', 'TL-LEND-CMD01', '--query_id', 'TL-LEND-QRY01', '--method', 'GET', '--route', '/x');
    expect(both.status).toBe(1);
    expect(both.err).toBe('Refused; nothing changed:\n  an endpoint sits under exactly one of command (command_id) or query (query_id); give only one, not command_id and query_id [parent]\n');
    expect((await lathe(root, 'add', 'question', '--id', 'TL-Q01', '--title', 'X', '--owner', 'Owner')).err).toContain(
      'a question sits under exactly one of product (product_id) or domain (domain_id); give one [parent]',
    );
  });

  it('takes a list column as the flag given once per item, and part rows by their columns', async () => {
    const root = writeData(everyKind());
    expect((await lathe(root, 'add', 'check', '--name', 'my-check', '--position', '2', '--severity', 'warning', '--summary', 'S.', '--explanation', 'E.', '--query', 'SELECT 1', '--kinds', 'domain', '--kinds', 'view')).status).toBe(0);
    expect(readFileSync(path.join(root, 'data', 'check.jsonl'), 'utf8')).toContain('"kinds":["domain","view"]');
    const field = await lathe(root, 'add', 'entity_field', '--entity_id', 'TL-LEND-EN01', '--position', '4', '--name', 'Due date', '--meaning', 'The last day of the loan.', '--type', 'date', '--required', 'true');
    expect(field.out).toBe(
      'Added entity_field entity_id TL-LEND-EN01, position 4: {"entity_id":"TL-LEND-EN01","position":4,"name":"Due date","meaning":"The last day of the loan.","type":"date","required":true}\nWrote data/entity_field.jsonl\n',
    );
    const key = await lathe(root, 'add', 'table_key', '--table_id', 'TL-LEND-EN01-TB', '--position', '3', '--type', 'index', '--columns', 'tool_id', '--columns', 'id');
    expect(key.out).toContain('"columns":["tool_id","id"]');
    expect((await lathe(root, 'add', 'use_case_actor', '--use_case_id', 'TL-LEND-UC01', '--position', '2', '--role_name', 'Librarian')).status).toBe(0);
    expect((await lathe(root, 'add', 'read_model_field', '--read_model_id', 'TL-LEND-RM01', '--position', '2', '--name', 'Member', '--meaning', 'Whose loans.', '--type_aggregate_id', 'TL-LEND-A1', '--required', 'true')).status).toBe(0);
  });

  it('refuses a command change of the command\'s own aggregate, with the store\'s reason', async () => {
    const root = writeData(everyKind());
    const own = await lathe(root, 'add', 'command_change', '--command_id', 'TL-LEND-CMD01', '--aggregate_id', 'TL-LEND-A1', '--reason', 'Because.');
    expect(own.status).toBe(1);
    expect(own.err).toContain('[command-change-in-domain]');
  });

  it('LA-AUT-UC01-R07-T01 refuses a write the command layer refuses, printing the reason, and changes nothing', async () => {
    const root = writeData(everyKind());
    const before = files(root);
    const result = await lathe(root, 'add', 'aggregate', '--id', 'TL-LEND-A3', '--title', 'Member', '--domain_id', 'TL-NOPE');
    expect(result.status).toBe(1);
    expect(result.out).toBe('');
    expect(result.err).toContain('aggregate TL-LEND-A3: domain_id "TL-NOPE" names no domain [foreign-key]');
    expect((await lathe(root, 'add', 'aggregate', '--id', 'TL-OTHER-A1', '--title', 'Member', '--domain_id', 'TL-LEND')).err).toContain('[id-prefix]');
    expect((await lathe(root, 'add', 'view', '--id', 'TL-V02')).err).toContain('view.title is required [required]');
    expect(files(root)).toEqual(before);
  });

  it('says a broken table rule in words', async () => {
    const root = writeData(everyKind());
    const field = await lathe(root, 'add', 'entity_field', '--entity_id', 'TL-LEND-EN02', '--position', '1', '--name', 'Returned at', '--meaning', 'When.', '--required', 'true');
    expect(field.err).toBe(
      'Refused; nothing changed:\n  entity_field entity_id TL-LEND-EN02, position 1 breaks a rule of its table: exactly one of type, type_value_object_id and type_aggregate_id is given [check]\n',
    );
    const test = await lathe(root, 'add', 'domain_service_test', '--id', 'TL-LEND-DS01-T02', '--title', 'X', '--domain_service_id', 'TL-LEND-DS01', '--level', 'unit', '--state', 'automated');
    expect(test.err).toContain('breaks a rule of its table: file is given when state is automated [check]');
    const manual = await lathe(root, 'add', 'domain_service_test', '--id', 'TL-LEND-DS01-T02', '--title', 'X', '--domain_service_id', 'TL-LEND-DS01', '--level', 'manual', '--state', 'manual');
    expect(manual.err).toContain('breaks a rule of its table: manual_reason is given when, and only when, state is manual [check]');
    expect((await lathe(root, 'link', 'TL-LEND-EN01', 'has_one', 'TL-LEND-EN01')).err).toContain('source_id and target_id differ [check]');
    expect((await lathe(root, 'add', 'entity', '--id', 'TL-LEND-EN03', '--title', 'X', '--aggregate_id', 'TL-LEND-A2', '--role', 'root', '--in_root_table', 'true')).err).toContain(
      'in_root_table is given only when role is child [check]',
    );
  });

  it('LA-AUT-UC01-R06-T02 refuses a flag that is no column, or a value of the wrong type, as bad usage', async () => {
    const root = writeData(everyKind());
    const unknown = await lathe(root, 'add', 'view', '--id', 'TL-V02', '--title', 'Desk', '--colour', 'red');
    expect(unknown.status).toBe(2);
    expect(unknown.err).toContain('view has no column colour; its columns are id, title, route, description, notes');
    const number = await lathe(root, 'add', 'capability', '--id', 'TL-LEND-CAP02', '--title', 'R', '--domain_id', 'TL-LEND', '--position', 'two');
    expect(number.status).toBe(2);
    expect(number.err).toContain('--position "two": capability.position is a whole number.');
    expect((await lathe(root, 'add', 'domain_event', '--id', 'TL-LEND-EV02', '--title', 'X', '--aggregate_id', 'TL-LEND-A1', '--published', 'yes')).err).toContain(
      '--published "yes": domain_event.published is true or false.',
    );
  });

  it('prints the result as JSON with --json', async () => {
    const root = writeData(everyKind());
    const result = await lathe(root, 'add', 'view', '--id', 'TL-V02', '--title', 'Desk', '--json');
    expect(JSON.parse(result.out)).toEqual({
      changes: [{ change: 'added', table: 'view', link: false, key: 'TL-V02', row: { id: 'TL-V02', title: 'Desk' } }],
      files: ['data/view.jsonl'],
    });
    const refused = await lathe(root, 'add', 'view', '--id', 'TL-V02', '--title', 'Desk', '--json');
    expect(refused.status).toBe(1);
    expect(JSON.parse(refused.out)).toEqual({ refused: true, problems: [expect.objectContaining({ rule: 'primary-key', message: 'view TL-V02 already exists' })] });
  });

  it('LA-AUT-UC01-R06-T01 gives each table its columns as help, from the schema', async () => {
    const root = writeData(everyKind());
    const tables = await lathe(root, 'add', '--help');
    expect(tables.status).toBe(0);
    expect(tables.out).toMatch(/Kinds:\n[\s\S]*  uc_requirement +\S/);
    expect(tables.out).toMatch(/Parts:\n[\s\S]*  command_change +\S/);
    expect(tables.out).toMatch(/  hears +policy -> domain_event/);
    const requirement = await lathe(root, 'add', 'uc_requirement', '--help');
    expect(requirement.out).toContain('ID: <use case>-R<nn>, such as TL-LEND-UC01-R01. Parent: use_case (use_case_id).');
    expect(requirement.out).toMatch(/--use_case_id +text, required, parent\. /);
    expect(requirement.out).toMatch(/--statement +text, required\. /);
    expect((await lathe(root, 'add', 'entity', '--help')).out).toMatch(/--role +one of root, child, required\./);
    expect((await lathe(root, 'add', 'endpoint', '--help')).out).toContain('Parent: exactly one of command (command_id) or query (query_id).');
    expect((await lathe(root, 'add', 'view', '--help')).out).toContain('ID: <P>-V<nn>, such as TL-V01. No owner: no parent column; its product is the one its ID starts with.');
    expect((await lathe(root, 'add', 'specification', '--help')).out).toContain('No owner: no parent column; its domain is the one its ID starts with.');
    expect((await lathe(root, 'add', 'flow_test', '--help')).out).toMatch(/--level +one of unit, database, api, contract, e2e-api, e2e-ui, manual, required\./);
  });
});

describe('lathe set', () => {
  it('LA-AUT-UC01-R05-T02 changes a record by its ID, and clears a column given as ""', async () => {
    const root = writeData(everyKind());
    const result = await lathe(root, 'set', 'TL-V01', '--route', '/tools', '--description', 'The tools.');
    expect(result.out).toBe('Changed view TL-V01: {"id":"TL-V01","title":"Catalog","route":"/tools","description":"The tools."}\nWrote data/view.jsonl\n');
    expect((await lathe(root, 'set', 'TL-V01', '--description', '')).status).toBe(0);
    expect(line(root, 'view', 'TL-V01')).toBe('{"id":"TL-V01","title":"Catalog","route":"/tools"}');
  });

  it('changes part rows named by their key columns', async () => {
    const root = writeData(everyKind());
    expect((await lathe(root, 'set', 'entity_field', '--entity_id', 'TL-LEND-EN01', '--position', '1', '--example', '32')).status).toBe(0);
    expect(readFileSync(path.join(root, 'data', 'entity_field.jsonl'), 'utf8')).toContain('"example":"32"');
    const change = await lathe(root, 'set', 'command_change', '--command_id', 'TL-LEND-CMD01', '--aggregate_id', 'TL-LEND-A2', '--reason', 'One transaction keeps the tool and its loan together.');
    expect(change.out).toContain('Changed command_change command_id TL-LEND-CMD01, aggregate_id TL-LEND-A2');
  });

  it('refuses a parent column, an unknown ID and a missing key', async () => {
    const root = writeData(everyKind());
    const parent = await lathe(root, 'set', 'TL-LEND-UC01-R01', '--use_case_id', 'TL-LEND-UC01');
    expect(parent.status).toBe(1);
    expect(parent.err).toContain('use_case_id places the record under its parent; use move [command]');
    expect((await lathe(root, 'set', 'TL-LEND-EP01', '--query_id', 'TL-LEND-QRY01')).err).toContain('query_id places the record under its parent; use move [command]');
    expect((await lathe(root, 'set', 'TL-NOPE', '--title', 'X')).err).toContain('no record has the ID TL-NOPE, and there is no table TL-NOPE [missing]');
    expect((await lathe(root, 'set', 'entity_field', '--entity_id', 'TL-LEND-EN01', '--example', '32')).err).toContain('a row of entity_field is named by its key: give position');
    expect((await lathe(root, 'set', 'TL-V01')).err).toContain('give at least one column of view to change');
  });
});

describe('lathe move', () => {
  it('LA-AUT-UC01-R05-T03 moves a record and reports every row that changed with it', async () => {
    const root = writeData({
      ...everyKind(),
      capability: [...everyKind().capability, { id: 'TL-LEND-CAP02', title: 'Returns', domain_id: 'TL-LEND', position: 2 }],
    });
    const result = await lathe(root, 'move', 'TL-LEND-UC01', '--parent', 'TL-LEND-CAP02');
    expect(result.status).toBe(0);
    expect(result.out).toContain('Changed use_case TL-LEND-UC01: {"id":"TL-LEND-UC01","title":"Borrow a tool","goal":"Take a tool home.","capability_id":"TL-LEND-CAP02"}');
    expect(result.out).toContain('Wrote data/use_case.jsonl');
  });

  it('moves a record between its two kinds of parent, clearing the other column', async () => {
    const root = writeData(everyKind());
    const result = await lathe(root, 'move', 'TL-LEND-EP01', '--parent', 'TL-LEND-QRY01');
    expect(result.out).toContain('Changed endpoint TL-LEND-EP01: {"id":"TL-LEND-EP01","title":"Borrow a tool","method":"POST","route":"/loans","query_id":"TL-LEND-QRY01"}');
  });

  it('refuses a parent of the wrong kind, a record with no owner, and needs --parent', async () => {
    const root = writeData(everyKind());
    const wrong = await lathe(root, 'move', 'TL-LEND-UC01', '--parent', 'TL-LEND-A1');
    expect(wrong.status).toBe(1);
    expect(wrong.err).toContain('[parent]');
    expect((await lathe(root, 'move', 'TL-V01', '--parent', 'TL')).err).toContain('a view has no parent, so it cannot move [command]');
    expect((await lathe(root, 'move', 'TL-LEND-UC01')).status).toBe(2);
  });
});

describe('lathe link and unlink', () => {
  it('LA-AUT-UC01-R05-T04 links and unlinks two records', async () => {
    const root = writeData(everyKind());
    const linked = await lathe(root, 'link', 'TL-LEND-QRY01', 'calls', 'TL-LEND-DS01');
    expect(linked.out).toBe('Added link TL-LEND-QRY01 calls TL-LEND-DS01\nWrote data/calls.jsonl\n');
    const unlinked = await lathe(root, 'unlink', 'TL-LEND-QRY01', 'calls', 'TL-LEND-DS01');
    expect(unlinked.out).toBe('Removed link TL-LEND-QRY01 calls TL-LEND-DS01\nWrote data/calls.jsonl\n');
  });

  it('refuses a pair the relation does not allow, a second link where one is allowed, and a missing link', async () => {
    const root = writeData(everyKind());
    const pair = await lathe(root, 'link', 'TL-V01', 'calls', 'TL-LEND-DS01');
    expect(pair.status).toBe(1);
    expect(pair.err).toContain('[foreign-key]');
    expect((await lathe(root, 'link', 'TL-LEND-CMD01', 'raises', 'TL-LEND-EV01')).err).toContain('TL-LEND-CMD01 already raises TL-LEND-EV01 [primary-key]');
    // A step invokes one operation.
    expect((await lathe(root, 'link', 'TL-LEND-UC01-FL-S01', 'invokes', 'TL-LEND-QRY01')).err).toContain('[unique]');
    expect((await lathe(root, 'unlink', 'TL-LEND-QRY01', 'calls', 'TL-LEND-DS01')).err).toContain('[missing]');
    expect((await lathe(root, 'link', 'TL-LEND-QRY01', 'calls')).status).toBe(2);
  });
});

describe('lathe remove', () => {
  it('LA-AUT-UC01-R05-T05 removes a record with its parts and its own links, once nothing references it', async () => {
    const root = writeData(everyKind());
    const result = await lathe(root, 'remove', 'TL-LEND-UC01-R01');
    expect(result.status).toBe(1);
    expect(result.err).toContain('is referenced, so it stays');
    await lathe(root, 'unlink', 'TL-LEND-UC01-FL-S01', 'fulfills', 'TL-LEND-UC01-R01');
    await lathe(root, 'remove', 'TL-LEND-UC01-R01-T01');
    const removed = await lathe(root, 'remove', 'TL-LEND-UC01-R01');
    expect(removed.out).toBe(
      'Removed uc_requirement TL-LEND-UC01-R01: {"id":"TL-LEND-UC01-R01","title":"Tool is free","use_case_id":"TL-LEND-UC01","statement":"The library MUST refuse a tool on loan.","group_name":"Validation"}\nWrote data/uc_requirement.jsonl\n',
    );
    const field = await lathe(root, 'remove', 'entity_field', '--entity_id', 'TL-LEND-EN01', '--position', '1');
    expect(field.out).toContain('Removed entity_field entity_id TL-LEND-EN01, position 1');
    expect(field.out).toContain('Wrote data/entity_field.jsonl');
  });

  it('refuses columns besides the key', async () => {
    const root = writeData(everyKind());
    expect((await lathe(root, 'remove', 'entity_field', '--entity_id', 'TL-LEND-EN01', '--position', '1', '--name', 'Loan ID')).err).toContain('remove takes only the key of entity_field, not name');
  });
});

describe('lathe show, list and next-id', () => {
  it('LA-AUT-UC01-R05-T06 shows a record with its parts, children and links', async () => {
    const root = writeData(everyKind());
    const shown = await lathe(root, 'show', 'TL-LEND-CMD01');
    expect(shown.status).toBe(0);
    expect(shown.out).toBe(
      [
        'Command TL-LEND-CMD01: Open a loan',
        '  kind: command',
        '  parent: TL-LEND-A1',
        '  aggregate_id: TL-LEND-A1',
        'command_change:',
        '  {"command_id":"TL-LEND-CMD01","aggregate_id":"TL-LEND-A2","reason":"The tool must never show as lent without its loan."}',
        'Children:',
        '  TL-LEND-CMD01-CLI (cli_command): tl borrow',
        '  TL-LEND-CMD01-H (command_handler): openLoan',
        '  TL-LEND-EP01 (endpoint): Borrow a tool',
        '  TL-LEND-PO01 (policy): Remind on loan',
        'Links:',
        '  Calls TL-LEND-DS01: Late fee [calls]',
        '  Checks TL-LEND-SP01: Tool is free [checks]',
        '  Invoked by TL-LEND-UC01-FL-S01: Pick a tool [invokes, in]',
        '  Raises TL-LEND-EV01: Loan opened [raises]',
        '',
      ].join('\n'),
    );
    expect((await lathe(root, 'show', 'TL-NOPE')).err).toContain('no record has the ID TL-NOPE [missing]');
  });

  it('shows where a record with no owner sits', async () => {
    const root = writeData(everyKind());
    expect((await lathe(root, 'show', 'TL-V01')).out).toMatch(/^View TL-V01: Catalog\n  kind: view\n  no owner; in product TL\n/);
    expect((await lathe(root, 'show', 'TL-LEND-SP01')).out).toMatch(/^Specification TL-LEND-SP01: Tool is free\n  kind: specification\n  no owner; in domain TL-LEND\n/);
  });

  it('LA-AUT-UC01-R05-T07 lists a table, or the rows under a parent', async () => {
    const root = writeData(everyKind());
    expect((await lathe(root, 'list', 'aggregate')).out).toBe('TL-LEND-A1  Loan\nTL-LEND-A2  Tool\n');
    expect((await lathe(root, 'list', 'entity', '--parent', 'TL-LEND-A1')).out).toBe('TL-LEND-EN01  Loan\nTL-LEND-EN02  Return\n');
    expect((await lathe(root, 'list', 'endpoint', '--parent', 'TL-LEND-CMD01')).out).toBe('TL-LEND-EP01  Borrow a tool\n');
    expect((await lathe(root, 'list', 'table', '--parent', 'TL-LEND-RM01')).out).toBe('TL-LEND-RM01-TB  Loans by member\n');
    expect((await lathe(root, 'list', 'view', '--parent', 'TL', '--json')).out).toBe(`${JSON.stringify([{ id: 'TL-V01', title: 'Catalog', route: '/catalog' }], null, 2)}\n`);
    expect((await lathe(root, 'list', 'specification', '--parent', 'TL-LEND')).out).toBe('TL-LEND-SP01  Tool is free\n');
    expect((await lathe(root, 'list', 'use_case_actor', '--parent', 'TL-LEND-UC01')).out).toBe('{"use_case_id":"TL-LEND-UC01","position":1,"role_name":"Member"}\n');
    expect((await lathe(root, 'list', 'hears', '--parent', 'TL-LEND-EV01')).out).toBe('{"source_id":"TL-LEND-PO01","target_id":"TL-LEND-EV01"}\n');
    expect((await lathe(root, 'list', 'nope')).err).toContain('there is no table nope');
  });

  const next = async (root: string, ...args: string[]) => (await lathe(root, 'next-id', ...args)).out.trim();

  it("LA-AUT-UC01-R05-T07 gives the next free ID by the kind's pattern, scoped to the domain or the parent", async () => {
    const root = writeData(everyKind());
    // Domain-scoped: the domain follows from the parent.
    expect(await next(root, 'aggregate', '--parent', 'TL-LEND')).toBe('TL-LEND-A3');
    expect(await next(root, 'entity', '--parent', 'TL-LEND-A2')).toBe('TL-LEND-EN03');
    expect(await next(root, 'command', '--parent', 'TL-LEND-A1')).toBe('TL-LEND-CMD02');
    expect(await next(root, 'query', '--parent', 'TL-LEND-RM01')).toBe('TL-LEND-QRY02');
    expect(await next(root, 'policy', '--parent', 'TL-LEND-CMD01')).toBe('TL-LEND-PO02');
    expect(await next(root, 'use_case', '--parent', 'TL-LEND-CAP01')).toBe('TL-LEND-UC02');
    expect(await next(root, 'endpoint', '--parent', 'TL-LEND-QRY01')).toBe('TL-LEND-EP02');
    // Parent-scoped, numbered.
    expect(await next(root, 'uc_requirement', '--parent', 'TL-LEND-UC01')).toBe('TL-LEND-UC01-R02');
    expect(await next(root, 'constraint', '--parent', 'TL-VO01')).toBe('TL-VO01-C02');
    expect(await next(root, 'flow_step', '--parent', 'TL-LEND-UC01-FL')).toBe('TL-LEND-UC01-FL-S02');
    expect(await next(root, 'use_case_test', '--parent', 'TL-LEND-UC01-R01')).toBe('TL-LEND-UC01-R01-T02');
  });

  it('LA-AUT-UC01-R05-T07 gives the one ID of a kind with one record per parent while it is free', async () => {
    const root = writeData(everyKind());
    expect(await next(root, 'repository', '--parent', 'TL-LEND-A2')).toBe('TL-LEND-A2-REPO');
    expect(await next(root, 'table', '--parent', 'TL-LEND-EN02')).toBe('TL-LEND-EN02-TB');
    const taken = await lathe(root, 'next-id', 'flow', '--parent', 'TL-LEND-UC01');
    expect(taken.status).toBe(1);
    expect(taken.err).toContain('TL-LEND-UC01 already has its flow: TL-LEND-UC01-FL');
  });

  it('LA-AUT-UC01-R05-T07 gives the next ID of a kind with no owner or two possible parents, and refuses what has no next ID', async () => {
    const root = writeData(everyKind());
    // No owner: the product, or for a specification the domain.
    expect(await next(root, 'view', '--parent', 'TL')).toBe('TL-V02');
    expect(await next(root, 'value_object', '--parent', 'TL-LEND')).toBe('TL-VO02');
    expect(await next(root, 'specification', '--parent', 'TL-LEND')).toBe('TL-LEND-SP02');
    expect((await lathe(root, 'next-id', 'specification', '--parent', 'TL')).err).toContain('a specification has no owner; give the domain its ID starts with, not product TL');
    expect((await lathe(root, 'next-id', 'view', '--parent', 'TL-LEND-UC01')).err).toContain('a view has no owner; give the product or domain its ID starts with');
    // Two possible parents.
    expect(await next(root, 'question', '--parent', 'TL')).toBe('TL-Q01');
    expect(await next(root, 'question', '--parent', 'TL-LEND')).toBe('TL-LEND-Q02');
    // A name the writer chooses, and a parent of the wrong kind.
    expect((await lathe(root, 'next-id', 'pattern', '--parent', 'TL')).err).toContain("a pattern's ID ends in a name you choose");
    expect((await lathe(root, 'next-id', 'uc_requirement', '--parent', 'TL-LEND')).err).toContain('a uc_requirement sits under use_case, not under domain TL-LEND');
    expect((await lathe(root, 'next-id', 'uc_requirement')).status).toBe(2);
  });
});

describe('the data after writes', () => {
  it('loads with every key and check', async () => {
    const root = writeData(everyKind());
    await lathe(root, 'add', 'view', '--id', 'TL-V02', '--title', 'Desk');
    await lathe(root, 'add', 'flow_step', '--id', 'TL-LEND-UC01-FL-S02', '--title', 'Return it', '--flow_id', 'TL-LEND-UC01-FL', '--path', 'main', '--position', '2');
    await lathe(root, 'link', 'TL-LEND-UC01-FL-S02', 'happens_in', 'TL-V02');
    const store = await openStore(root);
    expect(store.record('TL-V02')?.kind).toBe('view');
    expect(store.rows('happens_in')).toContainEqual({ source_id: 'TL-LEND-UC01-FL-S02', target_id: 'TL-V02' });
    await store.close();
  });
});
