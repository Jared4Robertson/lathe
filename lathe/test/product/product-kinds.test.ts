// Authoring the schema's kinds, stages and obligations, and a product's own kinds and relations (LA-PRD-UC03,
// LA-PRD-UC04, LA-PRD-UC08), proved through the store and the engine's load.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadWorkspace, openStore, type Workspace } from '../../src/index.ts';
import { everyKind } from '../store/fixture.ts';
import { adding, build, changing, complete, loadData, obligation, refusals, removeData, run, withTable, writeData, type Data } from '../helpers.ts';

afterAll(removeData);

/** The complete product with an obligation kind of its own, designed and proved only through relations with a role. */
const withAuditRules = (): Data =>
  adding(complete(), {
    product_kind: [{ name: 'audit_rule', product_id: 'EX', label: 'Audit rule', description: 'A rule an auditor checks.', parent_kind: 'domain', stage: 'use-cases', obligation: true, complexity: 'essential', id_pattern: '<domain>-AR<nn>' }],
    product_relation: [
      { name: 'shapes', source_kind: 'command_handler', target_kind: 'audit_rule', product_id: 'EX', role: 'design', forward_label: 'Shapes', reverse_label: 'Shaped by', description: 'The handler carries out the audit rule.' },
      { name: 'audits', source_kind: 'use_case_test', target_kind: 'audit_rule', product_id: 'EX', role: 'proof', forward_label: 'Audits', reverse_label: 'Audited by', description: 'The test proves the audit rule.' },
      { name: 'mentions', source_kind: 'command_handler', target_kind: 'audit_rule', product_id: 'EX', forward_label: 'Mentions', reverse_label: 'Mentioned by', description: 'The handler mentions the audit rule.' },
    ],
    audit_rule: [
      { id: 'EX-LEND-AR01', title: 'Every loan is logged', domain_id: 'EX-LEND' },
      { id: 'EX-LEND-AR02', title: 'Every return is logged', domain_id: 'EX-LEND' },
    ],
    shapes: [{ source_id: 'EX-LEND-CMD01-H', target_id: 'EX-LEND-AR01' }],
    audits: [{ source_id: 'EX-LEND-UC01-R01-T01', target_id: 'EX-LEND-AR01' }],
    mentions: [{ source_id: 'EX-LEND-CMD01-H', target_id: 'EX-LEND-AR02' }],
  });

/** The complete product with a kind of its own in the domain model, and a pair added to Lathe's `about`. */
const withReport = (): Data =>
  adding(complete(), {
    product_kind: [{ name: 'report', product_id: 'EX', label: 'Report', description: 'A printed report of a domain.', parent_kind: 'domain', stage: 'domain-model', obligation: false, complexity: 'essential', id_pattern: '<domain>-REP<nn>' }],
    product_kind_field: [{ kind: 'report', position: 1, name: 'paper', type: 'text', required: true, description: 'The paper size it prints on.' }],
    product_relation: [
      { name: 'about', source_kind: 'question', target_kind: 'report', product_id: 'EX', forward_label: 'About', reverse_label: 'Questions about this', description: 'The open question concerns the report.' },
      { name: 'prints', source_kind: 'report', target_kind: 'view', product_id: 'EX', forward_label: 'Prints', reverse_label: 'Printed by', description: 'The report prints the view.' },
    ],
    report: [{ id: 'EX-LEND-REP01', title: 'Loans this month', domain_id: 'EX-LEND', paper: 'A4' }],
    question: [{ id: 'EX-LEND-Q01', title: 'Who reads the report?', domain_id: 'EX-LEND', owner: 'Librarian', description: 'Nobody has said who reads the monthly report.' }],
    prints: [{ source_id: 'EX-LEND-REP01', target_id: 'EX-V01' }],
  });

/** The product with its own kind, then the question's link to the report, written once the report's table exists. */
async function loadReport(): Promise<Workspace> {
  const root = await build(withReport());
  const store = await openStore(root, { latheDataDir: null });
  await run(store, 'product change-question', { id: 'EX-LEND-Q01', about: ['EX-LEND-REP01'] });
  await store.close();
  return loadWorkspace(root);
}

let plain: Workspace;
let report: Workspace;
beforeAll(async () => {
  [plain, report] = await Promise.all([loadData(complete()), loadReport()]);
});

describe('obligations and link roles', () => {
  it('LA-PRD-UC03-R06-T01 Which kinds are obligations, and which links design or prove a product\'s own obligation, come from the schema', async () => {
    const ws = await loadData(withAuditRules());
    // Coverage counts exactly the kinds whose obligation flag is yes, Lathe's and the product's own alike.
    const flagged = ws.kinds.filter((k) => k.obligation).map((k) => k.kind);
    expect(flagged).toContain('audit_rule');
    for (const scope of ws.coverage) expect(scope.obligations.map((o) => o.kind)).toEqual(flagged);
    // The product's obligation is designed by a link whose relation's role is design, built by that source's file,
    // and proved by a link whose role is proof; a link of a relation with no role does neither.
    expect(ws.relations.filter((r) => r.target_kind === 'audit_rule').map((r) => [r.relation, r.role]).sort()).toEqual([['audits', 'proof'], ['mentions', ''], ['shapes', 'design']]);
    expect(obligation(ws, 'EX-LEND', 'audit_rule')).toMatchObject({ total: 2, designed: 1, built: 1, proved: 1 });
    const gaps = ws.coverage.flatMap((c) => c.gaps).filter((g) => g.kind === 'audit_rule').map((g) => `${g.missing} ${g.id}`);
    expect(gaps).toEqual(['designed EX-LEND-AR02', 'proved EX-LEND-AR02']);
  });
});

describe('a product\'s own kinds', () => {
  it('LA-PRD-UC04-R02-T01 A product\'s own kind is listed after Lathe\'s, with its own label, stage and obligation, and Lathe\'s kinds keep theirs', () => {
    const own = report.kinds.at(-1)!;
    expect(own).toMatchObject({ kind: 'report', label: 'Report', stage: 'domain-model', position: null, parent_kinds: ['domain'], obligation: false, required_fields: ['paper'] });
    // Lathe's kinds come first, exactly as in a product with no kinds of its own.
    expect(report.kinds.slice(0, -1)).toEqual(plain.kinds);
    expect(report.records.find((r) => r.id === 'EX-LEND-REP01')).toMatchObject({ kind: 'report', parent: 'EX-LEND', domain: 'EX-LEND', fields: { paper: 'A4' } });
  });

  it('LA-PRD-UC08-R02-T01 A product places its own kind in one of the six stages, or none, and cannot add a stage or change one of Lathe\'s kinds', async () => {
    expect(report.stages).toEqual(plain.stages);
    expect(report.kinds.find((k) => k.kind === 'report')!.stage).toBe('domain-model');
    const kind = everyKind().product_kind[0];
    // Any of the six stages, or none, loads.
    for (const stage of [...plain.stages.map((s) => s.stage), undefined]) {
      expect(await refusals(changing(everyKind(), 'product_kind', () => true, { stage })), String(stage)).toEqual([]);
    }
    const unstaged = await openStore(writeData(changing(everyKind(), 'product_kind', () => true, { stage: undefined })), { latheDataDir: null });
    expect(unstaged.schema.kinds.cli_command.stage).toBeNull();
    expect(unstaged.schema.stages).toHaveLength(6);
    await unstaged.close();
    // A stage Lathe does not have is refused, and so is a kind with the name of one of Lathe's.
    expect(await refusals(withTable(everyKind(), 'product_kind', [{ ...kind, stage: 'deployment' }]))).toEqual([
      expect.objectContaining({ rule: 'column', file: 'data/product_kind.jsonl', line: 1 }),
    ]);
    const taken = await refusals(withTable(everyKind(), 'product_kind', [{ ...kind, name: 'command' }]));
    expect(taken.map((p) => p.message).join('\n')).toContain('has the name of a table Lathe already has');
  });

  it('LA-PRD-UC04-R04-T01 A kind declared twice is refused, naming its file and line and the line of the first', async () => {
    const kind = everyKind().product_kind[0];
    const problems = await refusals(withTable(everyKind(), 'product_kind', [kind, kind]));
    expect(problems).toEqual([
      expect.objectContaining({ rule: 'primary-key', table: 'product_kind', file: 'data/product_kind.jsonl', line: 2, key: 'cli_command', message: 'product_kind cli_command is already on line 1' }),
    ]);
  });
});

describe('a product\'s own relations', () => {
  it('LA-PRD-UC04-R03-T01 A product relation with a new name gets a link table of its own; one with Lathe\'s name adds only its pair', async () => {
    const pairs = (ws: Workspace, relation: string) => ws.relations.filter((r) => r.relation === relation);
    // Lathe's about gains exactly the declared pair, and its own pairs, labels and role stay as they were.
    expect(pairs(report, 'about')).toEqual([
      ...pairs(plain, 'about'),
      { relation: 'about', source_kind: 'question', target_kind: 'report', role: '', description: 'The open question concerns the report.', forward_label: 'About', reverse_label: 'Questions about this' },
    ]);
    expect(report.relations.filter((r) => r.relation !== 'about' && r.relation !== 'prints')).toEqual(plain.relations.filter((r) => r.relation !== 'about'));
    // The new name is a relation of its own, with its link table holding its links.
    expect(pairs(report, 'prints')).toEqual([{ relation: 'prints', source_kind: 'report', target_kind: 'view', role: '', description: 'The report prints the view.', forward_label: 'Prints', reverse_label: 'Printed by' }]);
    expect(report.links.filter((l) => l.source === 'EX-LEND-REP01' || l.target === 'EX-LEND-REP01')).toEqual([
      { source: 'EX-LEND-Q01', relation: 'about', target: 'EX-LEND-REP01' },
      { source: 'EX-LEND-REP01', relation: 'prints', target: 'EX-V01' },
    ]);
    const store = await openStore(writeData(everyKind()), { latheDataDir: null });
    expect(store.schema.tables.documents).toMatchObject({ role: 'link', stored: true });
    await store.close();
  });
});

describe('a product\'s own interface design kind presents', () => {
  /** The complete product with an invocation kind of its own, in the interface design, that presents commands and queries. */
  const withInvocations = (stage = 'interface-design'): Data =>
    adding(complete(), {
      product_kind: [{ name: 'invocation', product_id: 'EX', label: 'Invocation', description: 'One invocation of the library\'s command line.', parent_kind: 'product', stage, obligation: false, complexity: 'essential', id_pattern: '<P>-INV<nn>' }],
      product_relation: [
        { name: 'presents', source_kind: 'invocation', target_kind: 'command', product_id: 'EX', forward_label: 'Presents', reverse_label: 'Presented in', description: 'A person sends the command through the invocation.' },
        { name: 'presents', source_kind: 'invocation', target_kind: 'query', product_id: 'EX', forward_label: 'Presents', reverse_label: 'Presented in', description: 'A person asks the query through the invocation.' },
      ],
    });

  it('LA-PRD-UC04-R06-T01 A product\'s interface design kind may present commands and queries; any other kind may not', async () => {
    const root = await build(withInvocations());
    const store = await openStore(root, { latheDataDir: null });
    await run(store, 'extension-record add-extension-record', { kind: 'invocation', id: 'EX-INV01', parent_id: 'EX', values: { title: 'library lend' }, links: { presents: ['EX-LEND-CMD01', 'EX-LEND-QRY01'] } });
    await store.close();
    const ws = await loadWorkspace(root);
    expect(ws.relations.filter((r) => r.relation === 'presents').map((r) => `${r.source_kind} ${r.target_kind} ${r.forward_label}/${r.reverse_label}`)).toEqual([
      'invocation command Presents/Presented in',
      'invocation query Presents/Presented in',
      'view command Presents/Presented in',
      'view query Presents/Presented in',
    ]);
    expect(ws.links.filter((l) => l.source === 'EX-INV01')).toEqual([
      { source: 'EX-INV01', relation: 'presents', target: 'EX-LEND-CMD01' },
      { source: 'EX-INV01', relation: 'presents', target: 'EX-LEND-QRY01' },
    ]);
    // A view's own presents links stay as they were.
    expect(ws.links.filter((l) => l.source === 'EX-V01' && l.relation === 'presents')).toHaveLength(3);
    // A kind of any other stage cannot present.
    expect((await refusals(withInvocations('technical-specification'))).map((p) => [p.rule, p.message])).toEqual([
      ['product-relation-own', "Lathe's relation presents links presents_source to operation, so it cannot link invocation to command; give the relation a name of its own."],
      ['product-relation-own', "Lathe's relation presents links presents_source to operation, so it cannot link invocation to query; give the relation a name of its own."],
    ]);
  });
});

describe('stages', () => {
  it('LA-PRD-UC08-R01-T01 The engine loads the six stages in order and each kind\'s stage and position, with the product and open questions outside them', () => {
    expect(plain.stages.map((s) => [s.position, s.stage, s.label])).toEqual([
      [1, 'discovery', 'Discovery'],
      [2, 'domain-model', 'Domain model'],
      [3, 'use-cases', 'Use cases'],
      [4, 'interface-design', 'Interface design'],
      [5, 'technical-specification', 'Technical specification'],
      [6, 'test-plan', 'Test plan'],
    ]);
    for (const s of plain.stages) expect(s.description.trim(), s.stage).not.toBe('');
    // Kinds come in position order, 1, 2, 3..., stage by stage.
    expect(plain.kinds.map((k) => k.position)).toEqual(plain.kinds.map((_, i) => i + 1));
    const order = plain.stages.map((s) => s.stage);
    const staged = plain.kinds.filter((k) => k.stage !== null).map((k) => order.indexOf(k.stage!));
    expect(staged).toEqual([...staged].sort((a, b) => a - b));
    expect(plain.kinds.filter((k) => k.stage === null).map((k) => k.kind)).toEqual(['product', 'question']);
  });

  it('LA-PRD-UC08-R01-T02 Every kind\'s stage is one of the schema\'s stages, and a product kind with no stage sits in none', async () => {
    const stages = new Set(plain.stages.map((s) => s.stage));
    for (const k of plain.kinds) if (k.stage !== null) expect(stages.has(k.stage), k.kind).toBe(true);
    const ws = await loadData(adding(complete(), {
      product_kind: [{ name: 'memo', product_id: 'EX', label: 'Memo', description: 'A note about a domain.', parent_kind: 'domain', obligation: false, complexity: 'essential' }],
    }));
    expect(ws.kinds.find((k) => k.kind === 'memo')).toMatchObject({ stage: null, position: null });
    expect(ws.stages).toEqual(plain.stages);
  });
});
