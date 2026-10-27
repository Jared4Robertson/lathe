// The CLI's data commands, run in process: each write goes through the command layer, prints the rows it changed,
// and on a refusal prints every reason and changes nothing; flags and help come from the schema.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { openStore } from '../../src/index.ts';
import { runDataCommand } from '../../src/cli/writers.ts';
import { everyKind, removeData, writeData } from '../store/fixture.ts';

afterAll(removeData);

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
  it('adds a record from its column flags and prints the row and the file', async () => {
    const root = writeData(everyKind());
    const result = await lathe(root, 'add', 'capability', '--id', 'TL-LEND-CAP02', '--title', 'Returns', '--domain_id', 'TL-LEND', '--position', '2');
    expect(result).toEqual({
      status: 0,
      out: 'Added capability TL-LEND-CAP02: {"id":"TL-LEND-CAP02","title":"Returns","domain_id":"TL-LEND","position":2}\nWrote data/capability.jsonl\n',
      err: '',
    });
    expect(line(root, 'capability', 'TL-LEND-CAP02')).toBe('{"id":"TL-LEND-CAP02","title":"Returns","domain_id":"TL-LEND","position":2}');
  });

  it('takes a list column as the flag given once per item, and a part row by its columns', async () => {
    const root = writeData(everyKind());
    expect((await lathe(root, 'add', 'check', '--name', 'my-check', '--position', '2', '--severity', 'warning', '--summary', 'S.', '--explanation', 'E.', '--query', 'SELECT 1', '--kinds', 'domain', '--kinds', 'view')).status).toBe(0);
    expect(readFileSync(path.join(root, 'data', 'check.jsonl'), 'utf8')).toContain('"kinds":["domain","view"]');
    const field = await lathe(root, 'add', 'entity_field', '--entity_id', 'TL-LEND-EN01', '--position', '2', '--name', 'Due at', '--meaning', 'When it is due.', '--type', 'Date');
    expect(field.out).toBe('Added entity_field entity_id TL-LEND-EN01, position 2: {"entity_id":"TL-LEND-EN01","position":2,"name":"Due at","meaning":"When it is due.","type":"Date"}\nWrote data/entity_field.jsonl\n');
  });

  it('refuses a write the command layer refuses, printing the reason, and changes nothing', async () => {
    const root = writeData(everyKind());
    const before = files(root);
    const result = await lathe(root, 'add', 'view', '--id', 'TL-LEND-V02', '--title', 'Desk', '--domain_id', 'TL-NOPE');
    expect(result.status).toBe(1);
    expect(result.out).toBe('');
    expect(result.err).toBe('Refused; nothing changed:\n  view TL-LEND-V02: domain_id "TL-NOPE" names no domain [foreign-key]\n');
    expect((await lathe(root, 'add', 'view', '--id', 'TL-LEND-V02', '--domain_id', 'TL-LEND')).err).toContain('view.title is required [required]');
    expect(files(root)).toEqual(before);
  });

  it('refuses a flag that is no column, or a value of the wrong type, as bad usage', async () => {
    const root = writeData(everyKind());
    const unknown = await lathe(root, 'add', 'view', '--id', 'TL-LEND-V02', '--title', 'Desk', '--domain_id', 'TL-LEND', '--colour', 'red');
    expect(unknown.status).toBe(2);
    expect(unknown.err).toContain('view has no column colour; its columns are id, title, domain_id, route, description, notes');
    const number = await lathe(root, 'add', 'capability', '--id', 'TL-LEND-CAP02', '--title', 'R', '--domain_id', 'TL-LEND', '--position', 'two');
    expect(number.status).toBe(2);
    expect(number.err).toContain('--position "two": capability.position is a whole number.');
  });

  it('prints the result as JSON with --json', async () => {
    const root = writeData(everyKind());
    const result = await lathe(root, 'add', 'view', '--id', 'TL-LEND-V02', '--title', 'Desk', '--domain_id', 'TL-LEND', '--json');
    expect(JSON.parse(result.out)).toEqual({
      changes: [{ change: 'added', table: 'view', link: false, key: 'TL-LEND-V02', row: { id: 'TL-LEND-V02', title: 'Desk', domain_id: 'TL-LEND' } }],
      files: ['data/view.jsonl'],
    });
    const refused = await lathe(root, 'add', 'view', '--id', 'TL-LEND-V02', '--title', 'Desk', '--domain_id', 'TL-LEND', '--json');
    expect(refused.status).toBe(1);
    expect(JSON.parse(refused.out)).toEqual({ refused: true, problems: [expect.objectContaining({ rule: 'primary-key', message: 'view TL-LEND-V02 already exists' })] });
  });

  it('gives each table its columns as help, from the schema', async () => {
    const root = writeData(everyKind());
    const tables = await lathe(root, 'add', '--help');
    expect(tables.status).toBe(0);
    expect(tables.out).toMatch(/Kinds:\n[\s\S]*  requirement +One rule a use case must follow\./);
    expect(tables.out).toContain('Parts:');
    expect(tables.out).toContain('  invariant');
    const requirement = await lathe(root, 'add', 'requirement', '--help');
    expect(requirement.out).toContain('ID: <use case>-R<nn>, such as TL-LEND-UC01-R01. Parent: use_case (use_case_id).');
    expect(requirement.out).toMatch(/--use_case_id +text, required, parent\. /);
    expect(requirement.out).toMatch(/--statement +text, required\. /);
    expect((await lathe(root, 'add', 'entity', '--help')).out).toMatch(/--role +one of root, child, required\./);
  });
});

describe('lathe set', () => {
  it('changes a record by its ID, and clears a column given as ""', async () => {
    const root = writeData(everyKind());
    const result = await lathe(root, 'set', 'TL-LEND-V01', '--route', '/tools', '--description', 'The tools.');
    expect(result.out).toBe('Changed view TL-LEND-V01: {"id":"TL-LEND-V01","title":"Catalog","domain_id":"TL-LEND","route":"/tools","description":"The tools."}\nWrote data/view.jsonl\n');
    expect((await lathe(root, 'set', 'TL-LEND-V01', '--description', '')).status).toBe(0);
    expect(line(root, 'view', 'TL-LEND-V01')).toBe('{"id":"TL-LEND-V01","title":"Catalog","domain_id":"TL-LEND","route":"/tools"}');
  });

  it('changes a part row named by its key columns', async () => {
    const root = writeData(everyKind());
    const result = await lathe(root, 'set', 'entity_field', '--entity_id', 'TL-LEND-EN01', '--position', '1', '--example', '32');
    expect(result.status).toBe(0);
    expect(readFileSync(path.join(root, 'data', 'entity_field.jsonl'), 'utf8')).toContain('"example":"32"');
  });

  it('refuses a parent column, an unknown ID and a missing key', async () => {
    const root = writeData(everyKind());
    const parent = await lathe(root, 'set', 'TL-LEND-UC01-R01', '--use_case_id', 'TL-LEND-UC01');
    expect(parent.status).toBe(1);
    expect(parent.err).toContain('use_case_id places the record under its parent; use move [command]');
    expect((await lathe(root, 'set', 'TL-NOPE', '--title', 'X')).err).toContain('no record has the ID TL-NOPE, and there is no table TL-NOPE [missing]');
    expect((await lathe(root, 'set', 'entity_field', '--entity_id', 'TL-LEND-EN01', '--example', '32')).err).toContain('a row of entity_field is named by its key: give position');
    expect((await lathe(root, 'set', 'TL-LEND-V01')).err).toContain('give at least one column of view to change');
  });
});

describe('lathe move', () => {
  it('moves a record and reports every row that changed with it', async () => {
    const root = writeData({
      ...everyKind(),
      capability: [...everyKind().capability, { id: 'TL-LEND-CAP02', title: 'Returns', domain_id: 'TL-LEND', position: 2 }],
    });
    const result = await lathe(root, 'move', 'TL-LEND-UC01', '--parent', 'TL-LEND-CAP02');
    expect(result.status).toBe(0);
    expect(result.out).toContain('Changed use_case TL-LEND-UC01: {"id":"TL-LEND-UC01","title":"Borrow a tool","domain_id":"TL-LEND","capability_id":"TL-LEND-CAP02"');
    expect(result.out).toContain('Wrote data/use_case.jsonl');
  });

  it('refuses a parent of the wrong kind, and needs --parent', async () => {
    const root = writeData(everyKind());
    const wrong = await lathe(root, 'move', 'TL-LEND-UC01', '--parent', 'TL-LEND-A1');
    expect(wrong.status).toBe(1);
    expect(wrong.err).toContain('a use_case sits under capability or domain, not under aggregate TL-LEND-A1 [parent]');
    expect((await lathe(root, 'move', 'TL-LEND-UC01')).status).toBe(2);
  });
});

describe('lathe link and unlink', () => {
  it('links and unlinks two records', async () => {
    const root = writeData(everyKind());
    const linked = await lathe(root, 'link', 'TL-LEND-C02', 'satisfies', 'TL-LEND-DR02');
    expect(linked.out).toBe('Added link TL-LEND-C02 satisfies TL-LEND-DR02\nWrote data/satisfies.jsonl\n');
    const unlinked = await lathe(root, 'unlink', 'TL-LEND-C02', 'satisfies', 'TL-LEND-DR02');
    expect(unlinked.out).toBe('Removed link TL-LEND-C02 satisfies TL-LEND-DR02\nWrote data/satisfies.jsonl\n');
  });

  it('refuses a pair the relation does not allow, a link twice and a missing link', async () => {
    const root = writeData(everyKind());
    const pair = await lathe(root, 'link', 'TL-LEND-V01', 'satisfies', 'TL-LEND-DR02');
    expect(pair.status).toBe(1);
    expect(pair.err).toContain('[foreign-key]');
    expect((await lathe(root, 'link', 'TL-LEND-C01', 'satisfies', 'TL-LEND-UC01-R01')).err).toContain('[primary-key]');
    expect((await lathe(root, 'unlink', 'TL-LEND-C02', 'satisfies', 'TL-LEND-DR02')).err).toContain('[missing]');
    expect((await lathe(root, 'link', 'TL-LEND-C01', 'satisfies')).status).toBe(2);
  });
});

describe('lathe remove', () => {
  it('removes a record with its parts and its own links', async () => {
    const root = writeData(everyKind());
    const result = await lathe(root, 'remove', 'TL-LEND-UC01-R01');
    expect(result.status).toBe(1);
    expect(result.err).toContain('is referenced, so it stays');
    await lathe(root, 'unlink', 'TL-LEND-F01', 'fulfills', 'TL-LEND-UC01-R01');
    await lathe(root, 'unlink', 'TL-LEND-C01', 'satisfies', 'TL-LEND-UC01-R01');
    await lathe(root, 'unlink', 'TL-LEND-T01', 'proves', 'TL-LEND-UC01-R01');
    const removed = await lathe(root, 'remove', 'TL-LEND-UC01-R01');
    expect(removed.out).toBe(
      'Removed requirement TL-LEND-UC01-R01: {"id":"TL-LEND-UC01-R01","title":"Tool is free","use_case_id":"TL-LEND-UC01","statement":"The library MUST refuse a tool on loan.","group_name":"Validation"}\nWrote data/requirement.jsonl\n',
    );
    const entity = await lathe(root, 'remove', 'entity_field', '--entity_id', 'TL-LEND-EN01', '--position', '1');
    expect(entity.out).toContain('Removed entity_field entity_id TL-LEND-EN01, position 1');
    expect(entity.out).toContain('Wrote data/entity_field.jsonl');
  });

  it('refuses columns besides the key', async () => {
    const root = writeData(everyKind());
    expect((await lathe(root, 'remove', 'entity_field', '--entity_id', 'TL-LEND-EN01', '--position', '1', '--name', 'Loan ID')).err).toContain('remove takes only the key of entity_field, not name');
  });
});

describe('lathe show, list and next-id', () => {
  it('shows a record with its parts, children and links', async () => {
    const root = writeData(everyKind());
    const shown = await lathe(root, 'show', 'TL-LEND-UC01');
    expect(shown.status).toBe(0);
    expect(shown.out).toBe(
      [
        'Use case TL-LEND-UC01: Borrow a tool',
        '  kind: use_case',
        '  parent: TL-LEND-CAP01',
        '  domain_id: TL-LEND',
        '  capability_id: TL-LEND-CAP01',
        '  goal: Take a tool home.',
        'setting_value:',
        '  {"follower_id":"TL-LEND-UC01","pattern_id":"TL-PAT-ACT","setting":"record","value":"Tool"}',
        'use_case_actor:',
        '  {"use_case_id":"TL-LEND-UC01","position":1,"role_name":"Member"}',
        'use_case_step:',
        '  {"use_case_id":"TL-LEND-UC01","position":1,"description":"The member picks a tool."}',
        'Children:',
        '  TL-LEND-UC01-R01 (requirement): Tool is free',
        'Links:',
        '  Questions about this TL-LEND-Q01: How long is a loan? [about, in]',
        '  Applies TL-LEND-DR01: One active loan per tool [applies]',
        '  Carried out by flow TL-LEND-F01: Borrow and return [carries_out, in]',
        '  Follows TL-PAT-ACT: Librarian action [follows]',
        '',
      ].join('\n'),
    );
    expect((await lathe(root, 'show', 'TL-NOPE')).err).toContain('no record has the ID TL-NOPE [missing]');
  });

  it('lists a table, or the rows under a parent', async () => {
    const root = writeData(everyKind());
    expect((await lathe(root, 'list', 'component')).out).toBe('TL-LEND-C01  lending-service.ts\nTL-LEND-C02  store.ts\n');
    expect((await lathe(root, 'list', 'component', '--parent', 'TL-LEND-LAY01')).out).toBe('TL-LEND-C01  lending-service.ts\n');
    expect((await lathe(root, 'list', 'use_case_step', '--parent', 'TL-LEND-UC01')).out).toBe('{"use_case_id":"TL-LEND-UC01","position":1,"description":"The member picks a tool."}\n');
    expect((await lathe(root, 'list', 'view', '--parent', 'TL-LEND', '--json')).out).toBe(`${JSON.stringify([{ id: 'TL-LEND-V01', title: 'Catalog', domain_id: 'TL-LEND', route: '/catalog' }], null, 2)}\n`);
    expect((await lathe(root, 'list', 'nope')).err).toContain('there is no table nope');
  });

  it('gives the next free ID by the kind\'s pattern', async () => {
    const root = writeData(everyKind());
    const next = async (...args: string[]) => (await lathe(root, 'next-id', ...args)).out.trim();
    expect(await next('requirement', '--parent', 'TL-LEND-UC01')).toBe('TL-LEND-UC01-R02');
    expect(await next('use_case', '--parent', 'TL-LEND-CAP01')).toBe('TL-LEND-UC02');
    expect(await next('aggregate', '--parent', 'TL-LEND')).toBe('TL-LEND-A3');
    expect(await next('component', '--parent', 'TL-LEND-LAY01')).toBe('TL-LEND-C03');
    expect(await next('interaction_requirement', '--parent', 'TL-LEND-E01')).toBe('TL-LEND-E01-R02');
    expect(await next('interaction_requirement', '--parent', 'TL-LEND')).toBe('TL-LEND-IR01');
    expect(await next('question', '--parent', 'TL')).toBe('TL-Q01');
    expect(await next('question', '--parent', 'TL-LEND-A1')).toBe('TL-LEND-Q02');
    expect(await next('flow_step', '--parent', 'TL-LEND-F01')).toBe('TL-LEND-F01-S02');
    const named = await lathe(root, 'next-id', 'pattern', '--parent', 'TL');
    expect(named.status).toBe(1);
    expect(named.err).toContain("a pattern's ID ends in a name you choose");
    expect((await lathe(root, 'next-id', 'requirement', '--parent', 'TL-LEND')).err).toContain('a requirement sits under use_case, not under domain TL-LEND');
    expect((await lathe(root, 'next-id', 'requirement')).status).toBe(2);
  });
});

describe('the data after writes', () => {
  it('loads with every key and check', async () => {
    const root = writeData(everyKind());
    await lathe(root, 'add', 'view', '--id', 'TL-LEND-V02', '--title', 'Desk', '--domain_id', 'TL-LEND');
    await lathe(root, 'link', 'TL-LEND-V02', 'uses', 'TL-LEND-E01');
    const store = await openStore(root);
    expect(store.record('TL-LEND-V02')?.kind).toBe('view');
    expect(store.rows('uses')).toContainEqual({ source_id: 'TL-LEND-V02', target_id: 'TL-LEND-E01' });
    await store.close();
  });
});
