// Lathe's checks of the Product domain, one at a time: each starts from the complete product, which gives no
// problem, and changes one thing to break the rule. LA-PAT-AGGREGATE-TESTS-R04: each of the domain's check rows is tested here.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Workspace } from '../../src/index.ts';
import { adding, changing, complete, loadData, ofCheck, records, removeData, withJourney } from '../helpers.ts';

afterAll(removeData);

let clean: Workspace;
beforeAll(async () => {
  clean = await loadData(complete());
});

/** A check row's tests, under its name. */
const check = (name: string, body: () => void) => describe(name, body);

check('journey-of-one-use-case', () => {
  it('LA-PRD-UC33-R07-T01 a journey whose steps carry out fewer than two use cases is a warning; a step carrying out nothing yet counts as a use case to write', async () => {
    const data = adding(withJourney(), {
      journey: [
        { id: 'EX-JR02', title: 'Borrow a tool and be reminded', product_id: 'EX', trigger: 'A member wants a tool.', result: 'The member knows when it is due.' },
        { id: 'EX-JR03', title: 'Borrow a tool and bring it back', product_id: 'EX', trigger: 'A member wants a tool.', result: 'The tool is back on the shelf.' },
      ],
      journey_step: [
        { id: 'EX-JR02-S01', title: 'A member borrows a tool', journey_id: 'EX-JR02', path: 'main', position: 1 },
        { id: 'EX-JR02-S02', title: 'The library reminds them', journey_id: 'EX-JR02', path: 'main', position: 2 },
        { id: 'EX-JR02-S03', title: 'A member borrows another', journey_id: 'EX-JR02', path: 'twice', position: 1 },
        { id: 'EX-JR03-S01', title: 'A member takes a tool home', journey_id: 'EX-JR03', path: 'main', position: 1 },
        { id: 'EX-JR03-S02', title: 'The librarian takes it back', journey_id: 'EX-JR03', path: 'main', position: 2 },
      ],
      carries_out: [
        { source_id: 'EX-JR02-S01', target_id: 'EX-LEND-UC01' },
        { source_id: 'EX-JR02-S02', target_id: 'EX-LEND-PO01' },
        { source_id: 'EX-JR02-S03', target_id: 'EX-LEND-UC01' },
        { source_id: 'EX-JR03-S01', target_id: 'EX-LEND-UC01' },
      ],
    });
    expect(ofCheck(await loadData(withJourney()), 'journey-of-one-use-case')).toEqual([]);
    expect(ofCheck(await loadData(data), 'journey-of-one-use-case')).toEqual([
      {
        severity: 'warning', check: 'journey-of-one-use-case', record: 'EX-JR02',
        message: 'Journey EX-JR02 carries out one use case, EX-LEND-UC01: a goal reached in one use case is a use case, not a journey; remove the journey, or add the steps it is missing.',
      },
    ]);
  });
});

check('handoff-not-connected', () => {
  it("LA-PRD-UC33-R08-T01 a handoff whose policy hears no event the step before it leads to is a warning, once that step's use case has a flow", async () => {
    // The fixture's handoff follows Borrow a tool, whose flow opens a loan, which raises the event its policy hears.
    expect(ofCheck(await loadData(withJourney()), 'handoff-not-connected')).toEqual([]);
    const deaf = changing(withJourney(), 'hears', (r) => r.source_id === 'EX-LEND-PO01', { target_id: 'EX-LEND-EV02' });
    expect(ofCheck(await loadData(deaf), 'handoff-not-connected')).toEqual([
      {
        severity: 'warning', check: 'handoff-not-connected', record: 'EX-JR01-S03',
        message: 'Journey step EX-JR01-S03 hands off to policy EX-LEND-PO01, which hears no event that EX-LEND-UC01, carried out by the step before it (EX-JR01-S02), leads to; link the step to the policy that follows EX-LEND-UC01, or have EX-LEND-PO01 hear the event it raises.',
      },
    ]);
    // A use case with no flow yet leads nowhere to read.
    const unflowed = changing(
      adding(deaf, { use_case: [{ id: 'EX-LEND-UC03', title: 'Renew a loan', capability_id: 'EX-LEND-CAP01', goal: 'A member keeps a tool longer.' }] }),
      'carries_out', (r) => r.source_id === 'EX-JR01-S02', { target_id: 'EX-LEND-UC03' },
    );
    expect(ofCheck(await loadData(unflowed), 'handoff-not-connected')).toEqual([]);
  });
});

/** The complete product's one interface made another kind. */

check('outcome-target-undated', () => {
  it('LA-STD-MODELING-R13-T02 a business outcome whose target says no date is a warning; a year or a span from an event is a date', async () => {
    expect(ofCheck(clean, 'outcome-target-undated')).toEqual([]);
    const undated = await loadData(changing(complete(), 'business_outcome', () => true, { target: 'Two loans per tool per month.' }));
    expect(ofCheck(undated, 'outcome-target-undated')).toEqual([
      {
        severity: 'warning',
        check: 'outcome-target-undated',
        record: 'EX-BO01',
        message: 'Business outcome EX-BO01 gives its target with no date: say by when it is reached, such as within a year of opening or by 2027.',
      },
    ]);
    for (const target of ['Two loans per tool per month by 2027.', 'Two loans per tool per month, by the end of the first year.']) {
      expect(ofCheck(await loadData(changing(complete(), 'business_outcome', () => true, { target })), 'outcome-target-undated')).toEqual([]);
    }
  });
});

check('accidental-in-essential', () => {
  it("LA-STD-PRINCIPLES-R05-T02 An essential record that names technology its kind's group has no business with is a warning, by Lathe's words and the product's own", async () => {
    expect(ofCheck(clean, 'accidental-in-essential')).toEqual([]);
    // A use case's goal that clicks and a UC requirement that names the product's own interface are leaks.
    let data = changing(complete(), 'use_case', (r) => r.id === 'EX-LEND-UC01', { goal: 'A member clicks the borrow button.' });
    data = changing(data, 'uc_requirement', (r) => r.id === 'EX-LEND-UC01-R01', { statement: 'The Web app MUST refuse a tool whose row says it is on loan.' });
    // A flow step that clicks is a leak, and so is one that names an interface unless it is that interface's variant.
    data = changing(data, 'flow_step', (r) => r.id === 'EX-LEND-UC01-FL-S01', { title: 'Click Borrow on the tool' });
    data = adding(data, {
      flow_step: [
        { id: 'EX-LEND-UC01-FL-S03', title: 'Open the Web app', flow_id: 'EX-LEND-UC01-FL', path: 'extra', position: 1, interface_id: 'EX-IF01' },
        { id: 'EX-LEND-UC01-FL-S04', title: 'Open the Web app again', flow_id: 'EX-LEND-UC01-FL', path: 'extra', position: 2 },
      ],
    });
    // A view is a page with its buttons and rows; it still may not name the storage behind it.
    data = changing(data, 'view', () => true, { title: 'Catalog page', description: 'Every tool in a row with a Borrow button, read from the JSON the database keeps.' });
    // A pattern decides the means and a test drives an interface, so neither is read.
    data = changing(data, 'pattern_rule', () => true, { statement: 'A saved record MUST answer the same JSON over HTTP.' });
    data = changing(data, 'view_test', () => true, { when: 'Clicks the catalog page' });
    // A word that is a term of the record's own domain is its language: the library lends reading tables.
    data = adding(data, { term: [{ id: 'EX-LEND-TM02', title: 'Table', domain_id: 'EX-LEND', meaning: 'A reading table members borrow by the hour.' }] });
    data = changing(data, 'use_case', (r) => r.id === 'EX-LEND-UC02', { goal: 'The librarian adds a tool or a table to the catalog.' });
    data = changing(data, 'term', (r) => r.id === 'EX-LEND-TM01', { meaning: 'One tool lent to one member, kept in Postgres until it is returned.' });
    const ws = await loadData(data);
    expect(ofCheck(ws, 'accidental-in-essential').map((p) => [p.record, p.message.replace(/; say .*/, '').replace(/^.* names technology: /, '')])).toEqual([
      ['EX-LEND-UC01', 'its goal says "click"'],
      ['EX-LEND-UC01-FL-S01', 'its title says "click"'],
      ['EX-LEND-UC01-FL-S04', 'its title says "web app"'],
      ['EX-LEND-UC01-R01', 'its statement says "web app"'],
      ['EX-V01', 'its description says "json"'],
    ]);
    // The product's own technology words count in every group, and no term excuses them.
    const own = await loadData(adding(data, { product_setting: [{ product_id: 'EX', max_children: 15, max_entities_per_aggregate: 7, technology_words: ['Postgres', 'Table'] }] }));
    expect(records(ofCheck(own, 'accidental-in-essential'))).toEqual(['EX-LEND-TM01', 'EX-LEND-TM02', 'EX-LEND-UC01', 'EX-LEND-UC01-FL-S01', 'EX-LEND-UC01-FL-S04', 'EX-LEND-UC01-R01', 'EX-LEND-UC02', 'EX-V01']);
    expect(ofCheck(own, 'accidental-in-essential').find((p) => p.record === 'EX-LEND-TM01')?.message).toContain('its meaning says "postgres"');
  });
});

check('essential-restates-technical', () => {
  it('LA-STD-PRINCIPLES-R05-T03 An essential record that names the shape of a technical record, a table written as storage, a file or folder, a route or a command line, is a warning; words that only sound technical are not', async () => {
    expect(ofCheck(clean, 'essential-restates-technical')).toEqual([]);
    // Lathe's own requirements before they were converted (01c6a47e), over a product that keeps an entity_field table
    // in lathe/schema/ and routes its commands under /api/.
    let data = changing(complete(), 'table', (r) => r.id === 'EX-LEND-EN01-TB', { title: 'entity_field', name: 'entity_field', file: 'lathe/schema/004-domain-model.sql' });
    data = adding(data, {
      endpoint: [{ id: 'EX-LEND-EP02', title: 'POST /api/loans/open', command_id: 'EX-LEND-CMD02', method: 'POST', route: '/api/loans/open', description: 'Opens a loan.' }],
    });
    data = changing(data, 'uc_requirement', (r) => r.id === 'EX-LEND-UC01-R01', {
      statement: 'The engine MUST give each entity its entity_field rows as its fields, in position order, each with a name, a meaning, exactly one type, whether it is required, and a column name and example when they help.',
    });
    data = changing(data, 'uc_requirement', (r) => r.id === 'EX-LEND-UC02-R01', {
      statement: 'The CLI (lathe use-case <command>), the MCP tools (one per command and query) and HTTP (POST /api/use-case/<command>) MUST each name the one command they run.',
    });
    data = changing(data, 'use_case', (r) => r.id === 'EX-LEND-UC01', { goal: 'The merge driver MUST run as `lathe merge-data %O %A %B %P` for every file `.gitattributes` names with `merge=lathe-data`.' });
    data = changing(data, 'domain_service', () => true, { statement: 'Every kind MUST be defined by the numbered migrations in `lathe/schema/`; a loan is due after /api/loans/open answers.' });
    // Words that only sound technical, an interface's own mechanism and a view's route are not restatements.
    data = changing(data, 'use_case', (r) => r.id === 'EX-LEND-UC02', { goal: 'The librarian keeps the free_tools list and the `free tools` shelf, and/or the entity fields, in order.' });
    data = changing(data, 'interface', () => true, { description: 'The desk app, which calls POST /api/loans/open.' });
    data = changing(data, 'view', () => true, { description: 'Every tool, at /catalog/all.' });
    const ws = await loadData(data);
    expect(ofCheck(ws, 'essential-restates-technical').map((p) => [p.record, p.message.replace(/^.* names /, '').replace(/, the shape of .*$/, '')])).toEqual([
      ['EX-LEND-DS01', 'the file lathe/schema/, the route /api/loans/open'],
      ['EX-LEND-UC01', 'the command line lathe merge-data %O %A %B %P'],
      ['EX-LEND-UC01-R01', 'the table entity_field'],
      ['EX-LEND-UC02-R01', 'the route POST /api/use-case/<command>'],
    ]);
    // A table's name that is the title of one of the product's terms is its language.
    const termed = adding(data, { term: [{ id: 'EX-LEND-TM02', title: 'entity_field', domain_id: 'EX-LEND', meaning: 'A field of an entity, as the library lists them.' }] });
    expect(records(ofCheck(await loadData(termed), 'essential-restates-technical'))).toEqual(['EX-LEND-DS01', 'EX-LEND-UC01', 'EX-LEND-UC02-R01']);
  });
});
