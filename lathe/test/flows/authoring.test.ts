// Authoring's flows, each walked through the real `lathe` command (or the scripts the flow names) on a temporary
// product: deciding domains, changing the schema, declaring a product's own kinds, organizing use cases, writing flows,
// models, rules, tests, technical records and standards, reading the reference and merging two branches' data. Each
// step runs the one aggregate command or query it names (`lathe <aggregate> <command>`). The Reader's flow in the app is
// in app/stability/authoring.spec.ts; the flows through the MCP tools are in agent-tools.test.ts.
import { spawnSync } from 'node:child_process';
import { appendFileSync, cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { add, gapsOf, LATHE_DIR, LENDING, link, node, problemsOf, product, removeProducts, type Product } from './product.ts';

const temps: string[] = [];
afterAll(() => {
  removeProducts();
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** The product's reference, as the reference script prints it. */
const reference = (tl: Product) => {
  const result = node(path.join(LATHE_DIR, 'scripts', 'reference.ts'), ['--root', tl.root, '--print']);
  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
  return result.stdout;
};

/** The section of a Markdown text under a heading, up to the next heading of its level or above. */
const section = (markdown: string, heading: string) => {
  const start = markdown.indexOf(`\n${heading}\n`);
  expect(start, heading).toBeGreaterThanOrEqual(0);
  const level = heading.match(/^#+/)![0];
  const rest = markdown.slice(start + heading.length + 2);
  const end = rest.search(new RegExp(`\\n#{1,${level.length}} `));
  return end < 0 ? rest : rest.slice(0, end);
};

/** A product's own technical kind several flows declare. */
const HOUSE_KIND = { name: 'launcher', product_id: 'TL', label: 'Launcher', description: 'A file the product starts from.', parent_kind: 'domain', stage: 'technical-specification', obligation: false };
/** The lending domain, as the flows that start from nothing add it. */
const LENDING_DOMAIN = { id: 'TL-LEND', title: 'Lending', product_id: 'TL', subdomain_type: 'core', description: 'Lending tools to members and getting them back.' };
/** A record of the workspace, by ID. */
const recordOf = (tl: Product, id: string) => tl.workspace().records.find((r) => r.id === id);
/** The links of the workspace that start at the record, as `relation target`. */
const linksOf = (tl: Product, id: string) => tl.workspace().links.filter((l) => l.source === id).map((l) => `${l.relation} ${l.target}`);

describe('Authoring flows', () => {
  it('LA-AUT-UC02-FL03-T split a product into domains by capability', () => {
    const tl = product();
    // S01: the modeling skill's first step is to find the product's business capabilities.
    const skill = readFileSync(path.join(LATHE_DIR, '..', 'plugin', 'skills', 'model-a-domain', 'SKILL.md'), 'utf8');
    expect(skill).toMatch(/Before you write any record, find the product's business capabilities and make each one a domain/);
    // S02: what the reference says a domain is.
    expect(section(reference(tl), '### Domain (`domain`)')).toContain('for one business capability');
    // S03: one domain per capability, with its subdomain type; one is named for a layer.
    tl.command('domain add-domain', LENDING_DOMAIN);
    tl.command('domain add-domain', { id: 'TL-CAT', title: 'Web app', product_id: 'TL', subdomain_type: 'supporting', description: 'The tools the library holds and how members find them.' });
    // S04: the check warns of the domain named for a technology; they rename it for its capability.
    expect(problemsOf(tl.workspace(), 'domain-named-for-technology')).toEqual([expect.stringMatching(/^TL-CAT: .*"web app"/)]);
    tl.command('domain change-domain', { id: 'TL-CAT', title: 'Catalog' });
    expect(problemsOf(tl.workspace(), 'domain-named-for-technology')).toEqual([]);
  });

  it('LA-AUT-UC03-FL03-T change Lathe\'s schema with a migration', async () => {
    // A copy of the lathe package, so the migration changes only the copy.
    const dir = mkdtempSync(path.join(tmpdir(), 'lathe-flow-schema-'));
    temps.push(dir);
    const copy = path.join(dir, 'lathe');
    for (const part of ['bin', 'src', 'schema', 'scripts', 'data', 'package.json', 'REFERENCE.md']) cpSync(path.join(LATHE_DIR, part), path.join(copy, part), { recursive: true });
    symlinkSync(path.join(LATHE_DIR, 'node_modules'), path.join(copy, 'node_modules'));
    const tl = product();
    // A term written with a column the schema does not have yet: the data is refused when it loads.
    await tl.seed([
      add('domain', LENDING_DOMAIN),
      add('term', { id: 'TL-LEND-TM01', title: 'Loan', domain_id: 'TL-LEND', meaning: 'One tool lent to one member.', example: 'The loan is due on Friday.' }),
    ]);
    const copied = (...args: string[]) => node(path.join(copy, 'bin', 'lathe.ts'), [...args, '--root', tl.root]);
    expect(copied('check').stdout).toContain('[data-refused]');
    // S01: the Owner writes the change as the next numbered migration.
    writeFileSync(path.join(copy, 'schema', '013-term-example.sql'), "ALTER TABLE term ADD COLUMN example VARCHAR;\nCOMMENT ON COLUMN term.example IS 'A sentence that uses the term.';\n");
    // S02: they regenerate the row types and the reference; until then both are stale.
    const tables = () => readFileSync(path.join(copy, 'src', 'platform', 'data', 'tables.ts'), 'utf8');
    const before = tables();
    expect(node(path.join(copy, 'scripts', 'schema-types.ts'), [], copy).status).toBe(0);
    expect(tables()).not.toBe(before);
    expect(tables()).toMatch(/example\?: string/);
    const stale = readFileSync(path.join(copy, 'REFERENCE.md'), 'utf8');
    expect(node(path.join(copy, 'scripts', 'reference.ts'), [], copy).status).toBe(0);
    const fresh = readFileSync(path.join(copy, 'REFERENCE.md'), 'utf8');
    expect(stale).not.toContain('A sentence that uses the term.');
    expect(fresh).toContain('A sentence that uses the term.');
    // S03: the next load applies the migrations in order and checks the product's data against them.
    expect(copied('check').status).toBe(0);
    expect(node(path.join(LATHE_DIR, 'bin', 'lathe.ts'), ['check', '--root', tl.root]).stdout).toContain('[data-refused]');
  });

  it('LA-AUT-UC04-FL03-T declare a product\'s own kinds and relations', async () => {
    const tl = product();
    await tl.seed(LENDING);
    const launcher = { kind: 'launcher', id: 'TL-LEND-EP1', parent_id: 'TL-LEND', values: { title: 'Start the lending service', file: 'src/main.ts' } };
    // S01: a product kind with its fields, in a stage; until then there is no such kind to add a record of.
    tl.refuse('extension-record add-extension-record', launcher);
    tl.command('product declare-product-kind', { ...HOUSE_KIND, fields: [{ name: 'file', type: 'text', required: true, description: 'The file it starts from.' }] });
    // S02: a new relation, and a pair added to one of Lathe's.
    tl.command('product declare-product-relation', { name: 'starts', source_kind: 'launcher', target_kind: 'command', product_id: 'TL', forward_label: 'Starts', reverse_label: 'Started by', description: 'The launcher starts the command.' });
    // S04: the next load generates the tables, and the Extension record's commands take the new kind with its columns.
    tl.command('extension-record add-extension-record', { ...launcher, links: { starts: ['TL-LEND-CMD01'] } });
    expect(tl.read('data/launcher.jsonl')).toContain('"id":"TL-LEND-EP1"');
    expect(linksOf(tl, 'TL-LEND-EP1')).toEqual(['starts TL-LEND-CMD01']);
    expect(tl.command('extension-record get-extension-record', { id: 'TL-LEND-EP1' })).toContain('TL-LEND-CMD01');
    // S03: a kind declared twice is refused; in the data files, naming the file and line of each.
    tl.refuse('product declare-product-kind', { ...HOUSE_KIND, label: 'Start file' });
    appendFileSync(path.join(tl.root, 'data', 'product_kind.jsonl'), `${JSON.stringify({ ...HOUSE_KIND, label: 'Start file' })}\n`);
    const twice = tl.workspace().problems.filter((p) => p.check === 'data-refused').map((p) => p.message);
    expect(twice.join('\n')).toMatch(/data\/product_kind\.jsonl:2:.*line 1/);
  });

  it('LA-AUT-UC05-FL03-T organize a domain\'s use cases into capabilities and patterns', async () => {
    const tl = product();
    await tl.seed([...LENDING, add('use_case', { id: 'TL-LEND-UC02', title: 'Return a tool', capability_id: 'TL-LEND-CAP01', goal: 'A member brings a tool back.' })]);
    // S01: the domain's capabilities in order; a repeated position is refused.
    tl.command('domain add-capability', { id: 'TL-LEND-CAP02', title: 'Returns', domain_id: 'TL-LEND', position: 2, description: 'Taking tools back from members.' });
    tl.refuse('domain add-capability', { id: 'TL-LEND-CAP03', title: 'Fees', domain_id: 'TL-LEND', position: 2, description: 'Charging members for late tools.' });
    // S02: each use case under its capability.
    tl.command('use-case move-use-case', { id: 'TL-LEND-UC02', capability_id: 'TL-LEND-CAP02' });
    expect(recordOf(tl, 'TL-LEND-UC02')?.parent).toBe('TL-LEND-CAP02');
    // S03: shared behavior once, as a pattern with its rules and settings; a setting name not in lower case is refused.
    const pattern = { id: 'TL-PAT-ACT', title: 'Librarian action', product_id: 'TL', description: 'An action a librarian takes that saves a record.' };
    tl.refuse('pattern add-pattern', { ...pattern, settings: [{ name: 'Record', meaning: 'The record the action saves.' }] });
    tl.command('pattern add-pattern', { ...pattern, settings: [{ name: 'record', meaning: 'The record the action saves.' }] });
    tl.command('pattern add-pattern-rule', { id: 'TL-PAT-ACT-R01', title: 'A saved record reads the same', pattern_id: 'TL-PAT-ACT', statement: 'A record MUST read back as it was saved.' });
    // S04: each follower follows the pattern and gives its settings; the check reports one left without a value.
    tl.command('pattern-following follow-pattern', { follower_id: 'TL-LEND-UC01', pattern_id: 'TL-PAT-ACT', setting_values: [{ setting: 'record', value: 'Loan' }] });
    tl.command('pattern-following follow-pattern', { follower_id: 'TL-LEND-UC02', pattern_id: 'TL-PAT-ACT' });
    expect(problemsOf(tl.workspace(), 'pattern-setting-missing')).toEqual([expect.stringMatching(/^TL-LEND-UC02: /)]);
    tl.command('pattern-following change-setting-values', { follower_id: 'TL-LEND-UC02', pattern_id: 'TL-PAT-ACT', setting_values: [{ setting: 'record', value: 'Return' }] });
    const ws = tl.workspace();
    expect(problemsOf(ws, 'pattern-setting-missing')).toEqual([]);
    expect(gapsOf(ws, 'TL-LEND')).toContain('proved TL-PAT-ACT-R01');
  });

  it('LA-AUT-UC06-FL03-T write a use case\'s flow as ordered steps', async () => {
    const tl = product();
    await tl.seed([
      ...LENDING,
      add('uc_requirement', { id: 'TL-LEND-UC01-R02', title: 'The due date is set', use_case_id: 'TL-LEND-UC01', statement: 'The loan MUST be due two weeks after it opens.' }),
      add('use_case', { id: 'TL-LEND-UC02', title: 'Return a tool', capability_id: 'TL-LEND-CAP01', goal: 'A member brings a tool back.' }),
      add('uc_requirement', { id: 'TL-LEND-UC02-R01', title: 'The return is dated', use_case_id: 'TL-LEND-UC02', statement: 'The return MUST carry its date.' }),
      add('view', { id: 'TL-V01', title: 'Loan desk', description: 'Where the librarian opens and closes loans.' }),
    ]);
    // S01: the flow through the product's interface, its ID ending in the interface's number, and its steps in order on
    // their paths.
    tl.command('product add-interface', { id: 'TL-IF01', title: 'Loan desk', product_id: 'TL', kind: 'web app', description: 'The desk where librarians lend tools.' });
    expect(tl.command('use-case next-id', { kind: 'flow', parent: 'TL-LEND-UC01' })).toBe('TL-LEND-UC01-FL01');
    tl.command('use-case add-flow', { id: 'TL-LEND-UC01-FL01', title: 'Borrow a tool', use_case_id: 'TL-LEND-UC01', interface_id: 'TL-IF01' });
    const step = (n: string, title: string, pathName: string, position: number) =>
      tl.command('use-case add-flow-step', { id: `TL-LEND-UC01-FL01-${n}`, title, flow_id: 'TL-LEND-UC01-FL01', path: pathName, position });
    step('S01', 'The member asks for a tool at the desk', 'main', 1);
    step('S02', 'The librarian opens the loan', 'main', 3);
    step('S03', 'A tool on loan is refused', 'refused', 1);
    // S02: each step's requirements, operation and view.
    tl.command('use-case change-flow-step', { id: 'TL-LEND-UC01-FL01-S01', happens_in: 'TL-V01' });
    tl.command('use-case change-flow-step', { id: 'TL-LEND-UC01-FL01-S02', invokes: 'TL-LEND-CMD01' });
    tl.command('use-case change-flow-step', { id: 'TL-LEND-UC01-FL01-S03', fulfills: ['TL-LEND-UC01-R01'] });
    // S04: the check reports the path that skips a number and the requirement no step fulfills.
    const ws = tl.workspace();
    expect(problemsOf(ws, 'step-order')).toEqual([expect.stringMatching(/^TL-LEND-UC01-FL01-S02: .*no step has position 2/)]);
    expect(problemsOf(ws, 'not-designed')).toEqual([expect.stringMatching(/^TL-LEND-UC01-R02: /), expect.stringMatching(/^TL-LEND-UC02-R01: /)]);
    tl.command('use-case change-flow-step', { id: 'TL-LEND-UC01-FL01-S02', position: 2, fulfills: ['TL-LEND-UC01-R02'] });
    const fixed = tl.workspace();
    expect(problemsOf(fixed, 'step-order')).toEqual([]);
    expect(problemsOf(fixed, 'not-designed')).toEqual([expect.stringMatching(/^TL-LEND-UC02-R01: /)]);
    // S03: a repeated position on a path, or a requirement of another use case, is refused.
    tl.refuse('use-case add-flow-step', { id: 'TL-LEND-UC01-FL01-S04', title: 'Again', flow_id: 'TL-LEND-UC01-FL01', path: 'main', position: 2 });
    expect(tl.refuse('use-case change-flow-step', { id: 'TL-LEND-UC01-FL01-S01', fulfills: ['TL-LEND-UC02-R01'] })).toContain('TL-LEND-UC02-R01');
  });

  it('LA-AUT-UC08-FL03-T read each kind\'s stage and order from the schema', () => {
    const tl = product();
    tl.command('domain add-domain', LENDING_DOMAIN);
    // S01: each kind's stage and place, in the reference and in the workspace, in the schema's one order.
    const before = reference(tl);
    const stages = [...before.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
    expect(stages.slice(0, 6)).toEqual(['Discovery', 'Domain model', 'Use cases', 'Interaction design', 'Technical specification', 'Test plan']);
    const kinds = [...section(before, '## Use cases').matchAll(/^### (.+) \(`(\w+)`\)$/gm)].map((m) => m[2]);
    expect(kinds).toEqual(['capability', 'use_case', 'uc_requirement', 'pattern', 'pattern_rule']);
    const ws = tl.workspace();
    expect(ws.kinds.filter((k) => k.stage === 'use-cases').map((k) => k.kind)).toEqual(kinds);
    // S02: a product kind declared in one of the stages joins it, after Lathe's kinds.
    tl.command('product declare-product-kind', { ...HOUSE_KIND, stage: 'use-cases', name: 'house_rule', label: 'House rule', description: 'A rule of the house.' });
    expect([...section(reference(tl), '## Use cases').matchAll(/^### (.+) \(`(\w+)`\)$/gm)].map((m) => m[2])).toEqual([...kinds, 'house_rule']);
    expect(tl.workspace().kinds.filter((k) => k.stage === 'use-cases').map((k) => k.kind)).toEqual([...kinds, 'house_rule']);
  });

  it('LA-AUT-UC10-FL03-T model each aggregate\'s entities and value objects', async () => {
    const tl = product();
    await tl.seed([
      add('domain', LENDING_DOMAIN),
      add('aggregate', { id: 'TL-LEND-A1', title: 'Loan', domain_id: 'TL-LEND', identity: 'Loan ID', description: 'One tool lent to one member, with its return.' }),
      add('aggregate', { id: 'TL-LEND-A2', title: 'Tool', domain_id: 'TL-LEND', identity: 'Tool ID', description: 'A tool the library holds.' }),
    ]);
    // S01: the aggregate's root and child entities.
    tl.command('aggregate add-entity', { id: 'TL-LEND-EN01', title: 'Loan', aggregate_id: 'TL-LEND-A1', role: 'root', description: 'The loan itself.' });
    tl.command('aggregate add-entity', { id: 'TL-LEND-EN02', title: 'Renewal', aggregate_id: 'TL-LEND-A1', role: 'child', in_root_table: true, description: 'The loan running longer.' });
    // S03: the value objects with their constraints.
    tl.command('value-object add-value-object', { id: 'TL-VO01', title: 'Email address', description: 'Where a member gets mail.', fields: [{ name: 'Address', meaning: 'The address as typed.', type: 'text', required: true }] });
    tl.command('value-object add-constraint', { id: 'TL-VO01-C01', title: 'One at sign', value_object_id: 'TL-VO01', statement: 'An email address MUST hold exactly one @.' });
    // S02: each entity's fields, typed by a basic type, a value object or another aggregate.
    tl.command('aggregate change-entity', {
      id: 'TL-LEND-EN01',
      fields: [
        { name: 'Due date', meaning: 'The last day of the loan.', type: 'date', required: true },
        { name: 'Borrower email', meaning: 'Where reminders go.', type_value_object_id: 'TL-VO01', required: true },
        { name: 'Tool', meaning: 'The tool lent.', type_aggregate_id: 'TL-LEND-A2', required: true, column_name: 'tool_id' },
      ],
    });
    const renewedOn = { name: 'Renewed on', meaning: 'When the loan was renewed.', type: 'date', required: true };
    tl.command('aggregate change-entity', { id: 'TL-LEND-EN02', fields: [renewedOn] });
    tl.refuse('aggregate change-entity', { id: 'TL-LEND-EN02', fields: [renewedOn, { name: 'Fee', meaning: 'Two types.', type: 'decimal', type_value_object_id: 'TL-VO01', required: false }] });
    // S04: the child is reported until the root reaches it with has_many.
    expect(problemsOf(tl.workspace(), 'entity-unreferenced')).toEqual([expect.stringMatching(/^TL-LEND-EN02: /)]);
    tl.command('aggregate change-entity', { id: 'TL-LEND-EN01', has_many: ['TL-LEND-EN02'] });
    const ws = tl.workspace();
    expect(problemsOf(ws, 'entity-unreferenced')).toEqual([]);
    expect(problemsOf(ws, 'value-object-unused')).toEqual([]);
    expect(ws.records.find((r) => r.id === 'TL-VO01')).toMatchObject({ domain: 'TL-LEND' });
    expect(ws.records.find((r) => r.id === 'TL-LEND-EN01')?.parts.entity_field.map((f) => f.name)).toEqual(['Due date', 'Borrower email', 'Tool']);
  });

  it('LA-AUT-UC11-FL03-T read the reference generated from the schema', async () => {
    const tl = product();
    await tl.seed(LENDING);
    // S01: the reference, written from the schema and the check rows, with its word for a use case.
    const lathe = reference(tl);
    expect(lathe).toMatch(/^# Lathe reference\n/);
    expect(lathe).toContain('What clean architecture calls a use case or an interactor is what Lathe calls a command handler');
    expect(lathe).toContain('### `view-unused`');
    // S02: a product's reference shows its own kinds and checks after Lathe's.
    tl.command('product declare-product-kind', HOUSE_KIND);
    tl.command('check add-check', { name: 'launcher-unnamed', product_id: 'TL', domain_id: 'LA-CHK', position: 1, severity: 'warning', summary: 'A launcher with no description.', explanation: 'Each launcher says what it starts.', query: "SELECT id AS record, 'Launcher ' || id || ' says nothing.' AS message FROM launcher WHERE false" });
    const own = reference(tl);
    const technical = section(own, '## Technical specification');
    expect([...technical.matchAll(/^### (.+) \(`(\w+)`\)$/gm)].map((m) => m[2]).at(-1)).toBe('launcher');
    expect(technical).toContain('A file the product starts from.');
    expect(own.indexOf('### `launcher-unnamed`')).toBeGreaterThan(own.indexOf('### `view-unused`'));
    // S03: a product kind, relation or check that would leave the reference blank is refused.
    tl.refuse('product declare-product-kind', { ...HOUSE_KIND, name: 'boot_script', description: ' ' });
    tl.refuse('product declare-product-relation', { name: 'starts', source_kind: 'launcher', target_kind: 'command', product_id: 'TL', forward_label: 'Starts', reverse_label: 'Started by', description: ' ' });
    tl.refuse('check add-check', { name: 'blank', product_id: 'TL', domain_id: 'LA-CHK', position: 2, severity: 'warning', summary: 'Blank.', explanation: ' ', query: 'SELECT 1' });
  });

  it('LA-AUT-UC12-FL03-T model commands and their events', async () => {
    const tl = product();
    await tl.seed([
      add('domain', LENDING_DOMAIN),
      add('aggregate', { id: 'TL-LEND-A1', title: 'Loan', domain_id: 'TL-LEND', identity: 'Loan ID', description: 'One tool lent to one member, with its return.' }),
      add('entity', { id: 'TL-LEND-EN01', title: 'Loan', aggregate_id: 'TL-LEND-A1', role: 'root', description: 'The loan itself.' }),
      add('aggregate', { id: 'TL-LEND-A2', title: 'Tool', domain_id: 'TL-LEND', identity: 'Tool ID', description: 'A tool the library holds.' }),
      add('specification', { id: 'TL-LEND-SP01', title: 'Tool is free', statement: 'A tool is free when no active loan names it.' }),
      link('TL-LEND-SP01', 'reads', 'TL-LEND-A1'),
    ]);
    // S01: the commands, and the events each raises with their fields.
    tl.command('command add-command', { id: 'TL-LEND-CMD01', title: 'Open a loan', entity_id: 'TL-LEND-EN01', description: 'Lends a free tool to a member.' });
    tl.command('command add-command', { id: 'TL-LEND-CMD02', title: 'Open a reminder', entity_id: 'TL-LEND-EN01', description: 'Sets a reminder for the loan\'s due date.' });
    tl.command('domain-event add-domain-event', {
      id: 'TL-LEND-EV01',
      title: 'Loan opened',
      aggregate_id: 'TL-LEND-A1',
      published: false,
      description: 'A tool went out on loan.',
      fields: [{ name: 'Loan ID', meaning: 'Which loan.', type_aggregate_id: 'TL-LEND-A1', required: true }],
    });
    // S02: what each command raises and checks; the event other domains hear is published.
    tl.command('command change-command', { id: 'TL-LEND-CMD01', raises: ['TL-LEND-EV01'], checks: ['TL-LEND-SP01'] });
    tl.command('domain-event change-domain-event', { id: 'TL-LEND-EV01', published: true });
    // S03: a policy under the command it invokes, hearing one event.
    tl.command('command add-policy', { id: 'TL-LEND-PO01', title: 'Remind on loan', command_id: 'TL-LEND-CMD02', statement: 'Whenever a loan is opened, the library MUST open its reminder.', hears: 'TL-LEND-EV01' });
    // A command raises only its own aggregate's events.
    tl.command('domain-event add-domain-event', { id: 'TL-LEND-EV02', title: 'Tool lent', aggregate_id: 'TL-LEND-A2', published: false, description: 'A tool left the shelf.' });
    expect(tl.refuse('command change-command', { id: 'TL-LEND-CMD01', raises: ['TL-LEND-EV01', 'TL-LEND-EV02'] })).toContain('TL-LEND-EV02');
    tl.command('domain-event remove-domain-event', { id: 'TL-LEND-EV02' });
    expect(linksOf(tl, 'TL-LEND-CMD01').sort()).toEqual(['checks TL-LEND-SP01', 'raises TL-LEND-EV01']);
    expect(tl.command('command get-command', { id: 'TL-LEND-CMD01' })).toContain('TL-LEND-EV01');
    const ws = tl.workspace();
    expect(gapsOf(ws, 'TL-LEND').filter((g) => /^(policy-hears-nothing|event-not-raised)/.test(g))).toEqual([]);
  });

  it('LA-AUT-UC13-FL03-T write the test plan', async () => {
    const tl = product();
    await tl.seed([
      ...LENDING,
      add('invariant', { id: 'TL-LEND-INV01', title: 'One active loan per tool', aggregate_id: 'TL-LEND-A1', statement: 'A tool MUST NOT have two active loans.' }),
      add('uc_requirement', { id: 'TL-LEND-UC01-R02', title: 'A member in debt is refused', use_case_id: 'TL-LEND-UC01', statement: 'The library MUST refuse a member who owes a fee.' }),
      add('uc_requirement', { id: 'TL-LEND-UC01-R03', title: 'The due date is set', use_case_id: 'TL-LEND-UC01', statement: 'The loan MUST be due two weeks after it opens.' }),
      add('uc_requirement', { id: 'TL-LEND-UC01-R04', title: 'The renewal date is set', use_case_id: 'TL-LEND-UC01', statement: 'A renewed loan MUST be due two weeks after renewal.' }),
    ]);
    tl.write('test/loans.test.ts', "it('TL-LEND-INV01-T one active loan per tool');\nit('TL-LEND-UC01-R01-T01 a tool on loan is refused');\n");
    // S01: each test under the record it tests, of the kind named after it, with its run by.
    tl.command('aggregate add-invariant-test', { id: 'TL-LEND-INV01-T', title: 'One active loan per tool', invariant_id: 'TL-LEND-INV01', level: 'integration', state: 'automated', file: 'test/loans.test.ts', when: 'A second loan opens for a tool on an active loan', then: 'It is refused' });
    tl.command('use-case add-use-case-test', { id: 'TL-LEND-UC01-R01-T01', title: 'A tool on loan is refused', uc_requirement_id: 'TL-LEND-UC01-R01', level: 'service', state: 'automated', file: 'test/loans.test.ts', when: 'A member borrows a tool that is on loan', then: 'The loan is refused' });
    tl.refuse('use-case add-use-case-test', { id: 'TL-LEND-INV01-T01', title: 'Under the wrong kind', uc_requirement_id: 'TL-LEND-INV01', level: 'service', state: 'not automated yet', when: 'A second loan opens', then: 'It is refused' });
    expect(tl.workspace().coverage.find((c) => c.domain === 'TL-LEND')?.obligations.filter((o) => o.proved).map((o) => o.kind)).toEqual(['invariant', 'uc_requirement']);
    // S02: a long list of requirements sorted into groups.
    for (const [id, group] of [['TL-LEND-UC01-R01', 'Refusals'], ['TL-LEND-UC01-R02', 'Refusals'], ['TL-LEND-UC01-R03', 'Dates'], ['TL-LEND-UC01-R04', 'Dates']]) {
      tl.command('use-case change-uc-requirement', { id, group_name: group });
    }
    const ws = tl.workspace();
    expect(ws.records.filter((r) => r.kind === 'uc_requirement').map((r) => [r.id, r.fields.group_name])).toEqual([
      ['TL-LEND-UC01-R01', 'Refusals'],
      ['TL-LEND-UC01-R02', 'Refusals'],
      ['TL-LEND-UC01-R03', 'Dates'],
      ['TL-LEND-UC01-R04', 'Dates'],
    ]);
    expect(problemsOf(ws, 'lone-child').filter((p) => p.startsWith('TL-LEND-UC01:'))).toEqual([]);
    // S03: the data set the tests start from, with the fixture that builds it, and the tests linked to it.
    tl.command('test-data-set add-test-data-set', { id: 'TL-LEND-TD01', title: 'One tool on loan', domain_id: 'TL-LEND', environment: 'The test database.', records: 'One member, one tool on loan.', prepare: 'Run the seed.', reset: 'Drop the database.', file: 'test/seed.ts', description: 'A tool already lent, for the tests that refuse a second loan.' });
    expect(problemsOf(tl.workspace(), 'test-data-set-unused')).toEqual([expect.stringMatching(/^TL-LEND-TD01: /)]);
    tl.command('aggregate change-invariant-test', { id: 'TL-LEND-INV01-T', starts_from: ['TL-LEND-TD01'] });
    tl.command('use-case change-use-case-test', { id: 'TL-LEND-UC01-R01-T01', starts_from: ['TL-LEND-TD01'] });
    const linked = tl.workspace();
    expect(problemsOf(linked, 'test-data-set-unused')).toEqual([]);
    expect(linked.problems.filter((p) => p.check === 'test-data-set-file-missing').map((p) => [p.severity, p.record])).toEqual([['error', 'TL-LEND-TD01']]);
    tl.write('test/seed.ts', '// One member, one tool on loan.\n');
    expect(problemsOf(tl.workspace(), 'test-data-set-file-missing')).toEqual([]);
  });

  it('LA-AUT-UC22-FL03-T write the business outcomes the product exists to achieve', async () => {
    const tl = product();
    await tl.seed([...LENDING]);
    // S01: a measurable outcome under the product; one without its measure is refused.
    expect(tl.command('business-outcome next-id', { product_id: 'TL' })).toBe('TL-BO01');
    tl.refuse('business-outcome add-business-outcome', { id: 'TL-BO01', title: 'More tools in use', product_id: 'TL', statement: 'Members borrow more tools.', target: 'Twice as many.' });
    tl.command('business-outcome add-business-outcome', { id: 'TL-BO01', title: 'More tools in use', product_id: 'TL', statement: 'Members borrow the library\'s tools more often.', measure: 'Loans opened per tool per month.', target: 'Two per tool per month within a year.' });
    const before = tl.workspace();
    expect(gapsOf(before, 'TL-LEND')).toContain('capability-serves-no-outcome TL-LEND-CAP01');
    expect(gapsOf(before, null)).toContain('outcome-not-served TL-BO01');
    expect(before.kinds.find((k) => k.kind === 'business_outcome')).toMatchObject({ stage: 'discovery' });
    expect(gapsOf(before, null)).toContain('outcome-not-measured TL-BO01');
    // S02: each capability linked to the outcomes it serves closes both of those gaps.
    tl.command('domain change-capability', { id: 'TL-LEND-CAP01', serves: ['TL-BO01'] });
    const served = tl.workspace();
    expect([...gapsOf(served, 'TL-LEND'), ...gapsOf(served, null)].filter((g) => g.includes('outcome'))).toEqual(['outcome-not-measured TL-BO01']);
    expect(tl.command('business-outcome get-business-outcome', { id: 'TL-BO01' })).toContain('TL-LEND-CAP01');
    // S03: each outcome linked to the test that measures it; a test not automated yet measures nothing.
    tl.command('use-case add-use-case-test', { id: 'TL-LEND-UC01-R01-T01', title: 'Loans are counted per tool', uc_requirement_id: 'TL-LEND-UC01-R01', level: 'service', state: 'not automated yet', when: 'Members borrow tools for a month', then: 'The loans are counted per tool' });
    tl.command('business-outcome change-business-outcome', { id: 'TL-BO01', measured_by: ['TL-LEND-UC01-R01-T01'] });
    expect(gapsOf(tl.workspace(), null)).toEqual(['outcome-not-measured TL-BO01']);
    tl.write('test/loans.test.ts', "it('TL-LEND-UC01-R01-T01 loans are counted per tool');\n");
    tl.command('use-case change-use-case-test', { id: 'TL-LEND-UC01-R01-T01', state: 'automated', file: 'test/loans.test.ts' });
    expect(gapsOf(tl.workspace(), null)).toEqual([]);
    expect(tl.command('business-outcome get-business-outcome', { id: 'TL-BO01' })).toContain('TL-LEND-UC01-R01-T01');
  });

  it('LA-AUT-UC16-FL03-T write the engineering standards the code follows', async () => {
    const tl = product();
    await tl.seed([...LENDING, add('command_handler', { id: 'TL-LEND-CMD01-H', title: 'openLoan', command_id: 'TL-LEND-CMD01', file: 'src/loans.ts', description: 'Opens the loan in one transaction.' })]);
    tl.write('src/loans.ts', '// TL-LEND-CMD01-H\n');
    tl.write('test/standards.test.ts', "it('TL-STD-LOG-R01-T01 no console.log in src');\n");
    // S01: a standard and its rules.
    tl.command('standard add-standard', { id: 'TL-STD-LOG', title: 'Logging', product_id: 'TL', description: 'How the code logs what it does.' });
    tl.command('standard add-standard-rule', { id: 'TL-STD-LOG-R01', title: 'No console.log', standard_id: 'TL-STD-LOG', statement: 'Code MUST log through the logger, never console.log.' });
    // S02: each technical record that follows it, and the test that proves it.
    tl.command('command change-command-handler', { id: 'TL-LEND-CMD01-H', meets: ['TL-STD-LOG-R01'] });
    tl.command('standard add-standard-rule-test', { id: 'TL-STD-LOG-R01-T01', title: 'No console.log in src', standard_rule_id: 'TL-STD-LOG-R01', level: 'unit', state: 'automated', file: 'test/standards.test.ts', when: 'The test reads every file under src', then: 'No file calls console.log' });
    // S03: the standard with its rules, what meets them and their tests.
    const shown = tl.command('standard get-standard', { id: 'TL-STD-LOG' });
    for (const id of ['TL-STD-LOG-R01', 'TL-LEND-CMD01-H', 'TL-STD-LOG-R01-T01']) expect(shown).toContain(id);
    const ws = tl.workspace();
    expect(ws.kinds.find((k) => k.kind === 'standard')?.stage).toBe('technical-specification');
    expect(ws.coverage.find((c) => c.domain === null)?.obligations.find((o) => o.kind === 'standard_rule')).toMatchObject({ total: 1, designed: 1, built: 1, proved: 1 });
  });

  it('LA-AUT-UC17-FL03-T write the technical records that build the design', async () => {
    const tl = product();
    await tl.seed([
      ...LENDING,
      add('invariant', { id: 'TL-LEND-INV01', title: 'One active loan per tool', aggregate_id: 'TL-LEND-A1', statement: 'A tool MUST NOT have two active loans.' }),
      add('entity_field', { entity_id: 'TL-LEND-EN01', position: 2, name: 'Tool ID', meaning: 'The tool lent.', type: 'text', required: true }),
    ]);
    // S01: the technical record under the design record it implements, naming its file.
    tl.command('command add-command-handler', { id: 'TL-LEND-CMD01-H', title: 'openLoan', command_id: 'TL-LEND-CMD01', file: 'src/loans.ts', description: 'Opens the loan in one transaction.' });
    tl.command('domain add-repository', { id: 'TL-LEND-REPO01', title: 'Loans', domain_id: 'TL-LEND', file: 'src/loans.ts', description: 'Keeps loans in one table and reads them by tool.', persists: 'TL-LEND-A1' });
    expect(problemsOf(tl.workspace(), 'technical-file-missing').sort()).toEqual([expect.stringMatching(/^TL-LEND-CMD01-H: /), expect.stringMatching(/^TL-LEND-REPO01: /)]);
    tl.write('src/loans.ts', '// TL-LEND-CMD01-H TL-LEND-REPO01\n');
    // S02: the entity's table with its keys, the unique key naming the invariant it enforces.
    const keys = [
      { type: 'primary', columns: ['id'] },
      { type: 'unique', columns: ['tool_id'], invariant_id: 'TL-LEND-INV01', condition: 'returned_at IS NULL' },
    ];
    tl.command('table add-table', { id: 'TL-LEND-EN01-TB', title: 'Loans', entity_id: 'TL-LEND-EN01', name: 'loan', storage: 'table', file: 'src/loans.ts', keys });
    tl.refuse('table change-table', { id: 'TL-LEND-EN01-TB', keys: [...keys, { type: 'index', columns: ['tool_id'], invariant_id: 'TL-LEND-INV01' }] });
    // The key backs the invariant up, but only its rule builds it.
    expect(tl.workspace().coverage.find((c) => c.domain === 'TL-LEND')?.obligations.find((o) => o.kind === 'invariant')).toMatchObject({ designed: 1, built: 0 });
    tl.command('aggregate add-rule', { id: 'TL-LEND-INV01-RL', title: 'tool-on-loan', invariant_id: 'TL-LEND-INV01', file: 'src/loans.ts' });
    const ws = tl.workspace();
    expect(problemsOf(ws, 'technical-file-missing')).toEqual([]);
    expect(ws.records.find((r) => r.id === 'TL-LEND-EN01-TB')?.parts.table_key.map((k) => [k.type, k.invariant_id ?? null])).toEqual([['primary', null], ['unique', 'TL-LEND-INV01']]);
    expect(gapsOf(ws, 'TL-LEND').filter((g) => /^(command-without-handler|aggregate-without-repository|entity-without-table)/.test(g))).toEqual([]);
    expect(ws.coverage.find((c) => c.domain === 'TL-LEND')?.obligations.find((o) => o.kind === 'invariant')).toMatchObject({ designed: 1, built: 1 });
  });

  it('LA-AUT-UC18-FL03-T write what a flow reaches', async () => {
    const tl = product();
    await tl.seed([
      ...LENDING,
      add('interface', { id: 'TL-IF01', title: 'Loan desk', product_id: 'TL', kind: 'web app', description: 'The desk where librarians lend tools.' }),
      add('flow', { id: 'TL-LEND-UC01-FL01', title: 'Borrow a tool', use_case_id: 'TL-LEND-UC01', interface_id: 'TL-IF01' }),
      add('flow_step', { id: 'TL-LEND-UC01-FL01-S01', title: 'The member borrows a tool', flow_id: 'TL-LEND-UC01-FL01', path: 'main', position: 1 }),
    ]);
    // S01: an endpoint under the command it exposes.
    tl.command('endpoint add-endpoint', { id: 'TL-LEND-EP01', title: 'POST /loans', command_id: 'TL-LEND-CMD01', method: 'POST', route: '/loans', description: 'Opens a loan from the desk.' });
    // S02: view requirements under views and API requirements under endpoints.
    tl.command('view add-view', { id: 'TL-V01', title: 'Loan desk', route: '/loans', description: 'Where the librarian opens and closes loans.' });
    tl.command('view add-view-requirement', { id: 'TL-V01-R01', title: 'The due date shows', view_id: 'TL-V01', statement: 'The desk MUST show the loan\'s due date.' });
    tl.command('endpoint add-api-requirement', { id: 'TL-LEND-EP01-R01', title: 'A loan on loan is refused', endpoint_id: 'TL-LEND-EP01', statement: 'The endpoint MUST answer 409 for a tool on loan.' });
    tl.command('integration add-integration', { id: 'TL-INT01', title: 'Mail', system: 'The mail service', description: 'Sends the library\'s mail to members.' });
    // S03: the check reports the view and integration nothing uses, until a step links them.
    const unused = tl.workspace();
    expect([...problemsOf(unused, 'view-unused'), ...problemsOf(unused, 'integration-unused')]).toEqual([expect.stringMatching(/^TL-V01: /), expect.stringMatching(/^TL-INT01: /)]);
    tl.command('use-case change-flow-step', { id: 'TL-LEND-UC01-FL01-S01', happens_in: 'TL-V01', exchanges_with: ['TL-INT01'], invokes: 'TL-LEND-CMD01' });
    const ws = tl.workspace();
    expect(ws.problems.filter((p) => p.severity === 'error')).toEqual([]);
    // The view and the integration belong to the domain whose step uses them.
    const domainOf = (id: string) => ws.records.find((r) => r.id === id)?.domain;
    expect(['TL-LEND-EP01', 'TL-V01', 'TL-INT01'].map(domainOf)).toEqual(['TL-LEND', 'TL-LEND', 'TL-LEND']);
  });

  it('LA-AUT-UC19-FL03-T merge two branches\' data', async () => {
    const tl = product();
    await tl.seed(LENDING);
    const git = (...args: string[]) => {
      const result = spawnSync('git', ['-c', 'user.name=Flow test', '-c', 'user.email=flow@example.com', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', ...args], { cwd: tl.root, encoding: 'utf8' });
      return { status: result.status, out: `${result.stdout}${result.stderr}` };
    };
    expect(git('init', '-q', '-b', 'main').status).toBe(0);
    writeFileSync(path.join(tl.root, '.gitattributes'), '**/data/*.jsonl merge=lathe-data\n');
    git('config', 'merge.lathe-data.name', 'Lathe data files');
    git('config', 'merge.lathe-data.driver', `"${process.execPath}" "${path.join(LATHE_DIR, 'bin', 'lathe.ts')}" merge-data %O %A %B %P`);
    git('add', '-A');
    expect(git('commit', '-q', '-m', 'Lending').status).toBe(0);
    // The Agent's branch and the Owner's each add a requirement to the same file.
    git('checkout', '-q', '-b', 'agent');
    tl.command('use-case add-uc-requirement', { id: 'TL-LEND-UC01-R02', title: 'A member in debt is refused', use_case_id: 'TL-LEND-UC01', statement: 'The library MUST refuse a member who owes a fee.' });
    git('commit', '-q', '-am', 'Agent');
    git('checkout', '-q', 'main');
    tl.command('use-case add-uc-requirement', { id: 'TL-LEND-UC01-R03', title: 'The due date is set', use_case_id: 'TL-LEND-UC01', statement: 'The loan MUST be due two weeks after it opens.' });
    git('commit', '-q', '-am', 'Owner');
    // S01: git merges them through the merge driver, row by row: both rows kept, sorted.
    const merged = git('merge', '-q', '--no-edit', 'agent');
    expect(merged.status, merged.out).toBe(0);
    expect(tl.read('data/uc_requirement.jsonl').split('\n').filter(Boolean).map((l) => JSON.parse(l).id)).toEqual(['TL-LEND-UC01-R01', 'TL-LEND-UC01-R02', 'TL-LEND-UC01-R03']);
    expect(tl.check().status).toBe(0);
    // S02: one row changed on both sides is a real clash, naming the key and both versions.
    git('checkout', '-q', '-b', 'agent-2');
    tl.command('use-case change-uc-requirement', { id: 'TL-LEND-UC01-R02', title: 'A member who owes is refused' });
    git('commit', '-q', '-am', 'Agent renames');
    git('checkout', '-q', 'main');
    tl.command('use-case change-uc-requirement', { id: 'TL-LEND-UC01-R02', title: 'A member in arrears is refused' });
    git('commit', '-q', '-am', 'Owner renames');
    const clash = git('merge', '--no-edit', 'agent-2');
    expect(clash.status).not.toBe(0);
    expect(clash.out).toContain('data/uc_requirement.jsonl: TL-LEND-UC01-R02 was changed on both sides');
    const marked = tl.read('data/uc_requirement.jsonl');
    expect(marked).toContain('A member who owes is refused');
    expect(marked).toContain('A member in arrears is refused');
    git('merge', '--abort');
  });

  it('LA-AUT-UC20-FL03-T sort a domain\'s rules by what they do', async () => {
    const tl = product();
    await tl.seed([
      ...LENDING,
      add('read_model', { id: 'TL-LEND-RM01', title: 'Free tools', domain_id: 'TL-LEND', description: 'The tools on no active loan.' }),
      add('query', { id: 'TL-LEND-QRY01', title: 'List free tools', read_model_id: 'TL-LEND-RM01', description: 'The free tools, by name.' }),
      add('value_object', { id: 'TL-VO01', title: 'Email address', description: 'Where a member gets mail.' }),
      add('value_object_field', { value_object_id: 'TL-VO01', position: 1, name: 'Address', meaning: 'The address as typed.', type: 'text', required: true }),
      add('entity_field', { entity_id: 'TL-LEND-EN01', position: 2, name: 'Borrower email', meaning: 'Where reminders go.', type_value_object_id: 'TL-VO01', required: true }),
      add('table', { id: 'TL-LEND-EN01-TB', title: 'Loans', entity_id: 'TL-LEND-EN01', name: 'loan', storage: 'table' }),
    ]);
    // S01: each value format as a constraint of its value object.
    tl.command('value-object add-constraint', { id: 'TL-VO01-C01', title: 'One at sign', value_object_id: 'TL-VO01', statement: 'An email address MUST hold exactly one @.' });
    // S02: each rule of one aggregate as its invariant, named on the unique key that enforces it.
    tl.command('aggregate add-invariant', { id: 'TL-LEND-INV01', title: 'One loan per number', aggregate_id: 'TL-LEND-A1', statement: 'No two loans MUST share a number.' });
    tl.command('table change-table', { id: 'TL-LEND-EN01-TB', keys: [{ type: 'unique', columns: ['id'], invariant_id: 'TL-LEND-INV01' }] });
    // S03: each check across aggregates as a specification, with what it reads and what checks and selects by it.
    tl.command('specification add-specification', { id: 'TL-LEND-SP01', title: 'Tool is free', statement: 'A tool is free when no active loan names it.' });
    expect(problemsOf(tl.workspace(), 'specification-unused')).toEqual([expect.stringMatching(/^TL-LEND-SP01: /)]);
    tl.command('specification change-specification', { id: 'TL-LEND-SP01', reads: ['TL-LEND-A1'] });
    tl.command('command change-command', { id: 'TL-LEND-CMD01', checks: ['TL-LEND-SP01'] });
    tl.command('read-model change-query', { id: 'TL-LEND-QRY01', selects_by: ['TL-LEND-SP01'] });
    const ws = tl.workspace();
    expect(problemsOf(ws, 'specification-unused')).toEqual([]);
    expect(gapsOf(ws, 'TL-LEND').filter((g) => g.startsWith('specification-reads-nothing'))).toEqual([]);
    expect(ws.coverage.find((c) => c.domain === 'TL-LEND')?.obligations.filter((o) => o.total).map((o) => [o.kind, o.total])).toEqual([['constraint', 1], ['invariant', 1], ['specification', 1], ['uc_requirement', 1]]);
  });

  it('LA-AUT-UC21-FL03-T model read models and queries', async () => {
    const tl = product();
    await tl.seed(LENDING);
    // S01: each read model with its fields, the aggregates it reads, and its queries.
    tl.command('read-model add-read-model', {
      id: 'TL-LEND-RM01',
      title: 'Loans by member',
      domain_id: 'TL-LEND',
      description: 'Each member\'s open loans and how late they are.',
      fields: [
        { name: 'Days overdue', meaning: 'How late the loan is.', type: 'whole number', required: false },
        { name: 'Loan', meaning: 'Which loan.', type_aggregate_id: 'TL-LEND-A1', required: true },
      ],
    });
    expect(gapsOf(tl.workspace(), 'TL-LEND').filter((g) => g.endsWith('TL-LEND-RM01')).sort()).toEqual(expect.arrayContaining(['read-model-reads-nothing TL-LEND-RM01', 'read-model-without-query TL-LEND-RM01']));
    tl.command('read-model change-read-model', { id: 'TL-LEND-RM01', reads: ['TL-LEND-A1'] });
    tl.command('read-model add-query', { id: 'TL-LEND-QRY01', title: 'List a member\'s loans', read_model_id: 'TL-LEND-RM01', description: 'One member\'s loans, the latest first.' });
    tl.refuse('read-model add-query', { id: 'TL-SHOP-QRY01', title: 'Another domain\'s query', read_model_id: 'TL-LEND-RM01', description: 'A query filed under the wrong domain.' });
    // S02: domain services and the domain's terms.
    tl.command('domain add-domain-service', { id: 'TL-LEND-DS01', title: 'Late fee', domain_id: 'TL-LEND', statement: 'The fee MUST be a day rate times the days late.' });
    tl.command('read-model change-query', { id: 'TL-LEND-QRY01', calls: ['TL-LEND-DS01'] });
    tl.command('domain add-term', { id: 'TL-LEND-TM01', title: 'Loan', domain_id: 'TL-LEND', meaning: 'One tool lent to one member until it is returned.' });
    const ws = tl.workspace();
    expect(gapsOf(ws, 'TL-LEND').filter((g) => /^(read-model-reads-nothing|read-model-without-query|domain-service-not-called)/.test(g))).toEqual([]);
    expect(ws.records.filter((r) => r.domain === 'TL-LEND' && ['read_model', 'query', 'domain_service', 'term'].includes(r.kind)).map((r) => r.id)).toEqual(['TL-LEND-RM01', 'TL-LEND-QRY01', 'TL-LEND-DS01', 'TL-LEND-TM01']);
    expect(ws.coverage.find((c) => c.domain === 'TL-LEND')?.obligations.find((o) => o.kind === 'domain_service')).toMatchObject({ total: 1 });
  });
});
