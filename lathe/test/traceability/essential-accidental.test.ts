// Essential and accidental complexity (LA-STD-PRINCIPLES-R05, R06): every kind says which it is; an essential record
// says what the product's people need without naming how it is built (accidental-in-essential); an accidental record
// is derived, provided or a fill that serves an essential record (accidental-not-accounted-for); each fill is accidental
// debt and three fills of one slot a pattern candidate; a provided obligation is built and proved through its provider;
// and the store refuses a generated fill. Each starts from the complete product and changes one thing.
import { afterAll, describe, expect, it } from 'vitest';
import { adding, changing, complete, loadData, obligation, ofCheck, records, refusals, removeData, without } from '../helpers.ts';

afterAll(removeData);

const SLOT = { slot: [{ id: 'EX-PAT-ACT-SL01', title: 'Saved record', pattern_id: 'EX-PAT-ACT', statement: 'A fill MUST save the record and its event in one transaction.' }] };
const fills = (...ids: string[]) => ({ fills: ids.map((id) => ({ source_id: id, target_id: 'EX-PAT-ACT-SL01' })) });
const TOOLING = { tooling: [{ id: 'EX-LEND-TOOL01', title: 'generate', domain_id: 'EX-LEND', file: 'scripts/generate.ts' }] };

describe('essential and accidental complexity', () => {
  it('LA-STD-PRINCIPLES-R05-T01 Each kind is essential or accidental by kind, never by record: a test follows what it proves, a standard its type', async () => {
    const ws = await loadData(complete());
    const of = (kind: string) => ws.kinds.find((k) => k.kind === kind)?.complexity;
    for (const kind of ['business_outcome', 'aggregate', 'use_case', 'pattern', 'slot', 'flow_step', 'view_requirement', 'test_data_set']) expect(of(kind), kind).toBe('essential');
    for (const kind of ['command_handler', 'table', 'ui_component', 'data_store', 'tooling']) expect(of(kind), kind).toBe('accidental');
    for (const kind of ['use_case_test', 'standard_rule', 'standard_rule_test']) expect(of(kind), kind).toBe('as-parent');
    expect(of('standard')).toBe('by-type');
    expect(of('question')).toBeNull();
    // An engineering standard and its rule are accidental, the rule's test follows them and is not reported; a quality
    // standard and its rule are essential.
    const unaccounted = records(ofCheck(ws, 'accidental-not-accounted-for'));
    expect(unaccounted).toEqual(expect.arrayContaining(['EX-STD-CODE', 'EX-STD-CODE-R01', 'EX-LEND-CMD01-H', 'EX-STORE01']));
    expect(unaccounted).not.toContain('EX-STD-CODE-R01-T01');
    expect(unaccounted.filter((id): id is string => id !== null && !/-(H|DM|TB|VT|RL|PR|ET|PJ|RD|SV|AD)$|-(REPO|STORE)\d+$|^EX-UI\d+$|^EX-STD-/.test(id))).toEqual([]);
    const quality = await loadData(changing(complete(), 'standard', () => true, { type: 'quality' }));
    expect(records(ofCheck(quality, 'accidental-not-accounted-for'))).not.toEqual(expect.arrayContaining(['EX-STD-CODE']));
    expect(records(ofCheck(quality, 'accidental-not-accounted-for'))).not.toContain('EX-STD-CODE-R01');
  });

  it("LA-STD-PRINCIPLES-R05-T02 An essential record that names technology in its title or lead text is a warning, by Lathe's words and the product's own", async () => {
    expect(ofCheck(await loadData(complete()), 'accidental-in-essential')).toEqual([]);
    let data = changing(complete(), 'use_case', (r) => r.id === 'EX-LEND-UC01', { goal: 'A member clicks the borrow button.' });
    data = changing(data, 'view', () => true, { title: 'Catalog page' });
    data = changing(data, 'term', () => true, { meaning: 'One tool lent to one member, kept in Postgres until it is returned.' });
    // An accidental record may name technology: the UI component's description says page.
    let ws = await loadData(data);
    expect(ofCheck(ws, 'accidental-in-essential').map((p) => [p.severity, p.record, p.message])).toEqual([
      ['warning', 'EX-LEND-UC01', expect.stringContaining('Use case EX-LEND-UC01 is essential but names technology: its goal says "click"')],
      ['warning', 'EX-V01', expect.stringContaining('its title says "page"')],
    ]);
    // The product's own technology words count too.
    ws = await loadData(adding(data, { product_setting: [{ product_id: 'EX', max_children: 15, max_entities_per_aggregate: 7, technology_words: ['Postgres'] }] }));
    expect(records(ofCheck(ws, 'accidental-in-essential'))).toEqual(['EX-LEND-TM01', 'EX-LEND-UC01', 'EX-V01']);
    expect(ofCheck(ws, 'accidental-in-essential').find((p) => p.record === 'EX-LEND-TM01')?.message).toContain('its meaning says "postgres"');
  });

  it('LA-STD-PRINCIPLES-R06-T01 An accidental record is a warning until a tooling record generates it, something provides it or a record above it, or it fills a slot serving an essential record', async () => {
    const before = records(ofCheck(await loadData(complete()), 'accidental-not-accounted-for'));
    expect(before).toEqual(expect.arrayContaining(['EX-LEND-CMD01-H', 'EX-LEND-CMD02-H', 'EX-UI01', 'EX-LEND-REPO01', 'EX-LEND-REPO02', 'EX-STORE01', 'EX-STD-CODE', 'EX-STD-CODE-R01']));
    const data = adding(complete(), {
      ...TOOLING,
      generates: [{ source_id: 'EX-LEND-TOOL01', target_id: 'EX-LEND-CMD01-H' }],
      provided_by: [{ source_id: 'EX-STORE01', target_id: 'EX-INT01' }, { source_id: 'EX-STD-CODE', target_id: 'EX-INT01' }],
      ...SLOT,
      // Under the command it handles; building the view requirement; persisting an aggregate with a storage
      // requirement; and one serving nothing essential.
      ...fills('EX-LEND-CMD02-H', 'EX-UI01', 'EX-LEND-REPO01', 'EX-LEND-REPO02'),
    });
    const ws = await loadData(data);
    const after = ofCheck(ws, 'accidental-not-accounted-for');
    for (const id of ['EX-LEND-CMD01-H', 'EX-STORE01', 'EX-STD-CODE', 'EX-STD-CODE-R01', 'EX-LEND-CMD02-H', 'EX-UI01', 'EX-LEND-REPO01']) expect(records(after), id).not.toContain(id);
    expect(after.find((p) => p.record === 'EX-LEND-REPO02')?.message).toBe(
      'Repository EX-LEND-REPO02 is accidental complexity nothing accounts for: it fills a slot but serves no essential record; put it under the essential record it implements, or remove it.',
    );
    // The generator is itself accidental, and is reported until it is accounted for.
    expect(records(after)).toContain('EX-LEND-TOOL01');
  });

  it('LA-STD-PRINCIPLES-R06-T02 Each fill is listed as accidental debt in its domain, and the third fill of one slot makes it a pattern candidate', async () => {
    const two = await loadData(adding(complete(), { ...SLOT, ...fills('EX-LEND-CMD01-H', 'EX-LEND-CMD02-H') }));
    expect(two.coverage.find((c) => c.domain === 'EX-LEND')?.debt).toEqual([
      { id: 'EX-LEND-CMD01-H', slot: 'EX-PAT-ACT-SL01' },
      { id: 'EX-LEND-CMD02-H', slot: 'EX-PAT-ACT-SL01' },
    ]);
    expect(two.problems.filter((p) => p.severity === 'error')).toEqual([]);
    expect(ofCheck(two, 'pattern-candidate')).toEqual([]);
    const three = await loadData(adding(complete(), { ...SLOT, ...fills('EX-LEND-CMD01-H', 'EX-LEND-CMD02-H', 'EX-LEND-CMD03-H') }));
    expect(ofCheck(three, 'pattern-candidate')).toEqual([
      {
        severity: 'warning',
        check: 'pattern-candidate',
        record: 'EX-PAT-ACT-SL01',
        message: "Slot EX-PAT-ACT-SL01 (Saved record) has 3 fills (EX-LEND-CMD01-H, EX-LEND-CMD02-H, EX-LEND-CMD03-H): a pattern candidate; make the pattern's fixed part or a setting express what they repeat, and generate them.",
      },
    ]);
  });

  it('LA-STD-PRINCIPLES-R06-T03 An obligation something outside the product provides is built and proved through its provider', async () => {
    let data = without(complete(), 'rule', () => true);
    data = without(data, 'starts_from', (r) => r.source_id === 'EX-LEND-INV01-T');
    data = without(data, 'invariant_test', () => true);
    const bare = await loadData(data);
    expect(obligation(bare, 'EX-LEND', 'invariant')).toMatchObject({ total: 1, built: 0, proved: 0 });
    const provided = await loadData(adding(data, { provided_by: [{ source_id: 'EX-LEND-INV01', target_id: 'EX-INT01' }] }));
    expect(obligation(provided, 'EX-LEND', 'invariant')).toMatchObject({ total: 1, designed: 1, built: 1, proved: 1 });
    expect(provided.coverage.find((c) => c.domain === 'EX-LEND')?.proved_by['EX-LEND-INV01']).toEqual(['EX-INT01']);
    expect(provided.chains.find((c) => c.obligation === 'EX-LEND-INV01')?.build).toEqual(['EX-INT01']);
  });

  it('LA-STD-PRINCIPLES-R06-T04 The store refuses a fill of a record a tooling record generates: a fill is written by hand', async () => {
    const problems = await refusals(adding(complete(), { ...TOOLING, generates: [{ source_id: 'EX-LEND-TOOL01', target_id: 'EX-LEND-CMD01-H' }], ...SLOT, ...fills('EX-LEND-CMD01-H') }));
    expect(problems).toEqual([
      expect.objectContaining({
        rule: 'fill-is-hand-written',
        message: expect.stringContaining('EX-LEND-CMD01-H cannot fill EX-PAT-ACT-SL01: EX-LEND-TOOL01 generates it'),
      }),
    ]);
  });
});
