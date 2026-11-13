// What a write of an essential record is refused for (write-rules.ts, LA-STD-PRINCIPLES-R05): naming technology its kind's group
// has no business with, and linking to an accidental record. Records already in the data are not refused until they
// are written; accidental-in-essential keeps reporting them. Each starts from the complete product.
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { loadWorkspace, openStore, type Store } from '../../src/index.ts';
import { adding, build, changing, complete, loadData, ofCheck, refusedBy, removeData, run, type Data } from '../helpers.ts';

afterAll(removeData);

const opened: Store[] = [];
afterEach(async () => {
  for (const store of opened.splice(0)) await store.close();
});

/** A store over the data, closed after the test. */
async function storeOf(data: Data): Promise<Store> {
  const store = await openStore(await build(data), { latheDataDir: null });
  opened.push(store);
  return store;
}

/** The rules and messages of a refusal. */
const reasons = async (store: Store, command: string, input: Record<string, unknown>) =>
  (await refusedBy(store, command, input)).map((p) => [p.rule, p.key, p.message.replace(/: say what .*$/, '')]);

/** A product kind of the example's own that is essential, and one of its records' relations to any record. */
const essentialKind: Data = {
  product_kind: [{ name: 'notice', product_id: 'EX', label: 'Notice', description: 'A notice the library posts for its members.', parent_kind: 'domain', stage: 'use-cases', obligation: false, complexity: 'essential', id_pattern: '<domain>-NT<nn>', id_example: 'EX-LEND-NT01' }],
  product_relation: [{ name: 'cites', source_kind: 'notice', target_kind: '*', product_id: 'EX', forward_label: 'Cites', reverse_label: 'Cited by', description: 'The notice cites the record.' }],
};

describe('a write of an essential record keeps accidental complexity out', () => {
  it("LA-STD-PRINCIPLES-R05-T05 A write that adds an essential record, or changes its title or lead, naming technology its kind's group has no business with is refused with the word; one that leaves its text as it was is not", async () => {
    const store = await storeOf(complete());
    // Lathe's words for the domain model and use cases, and the product's own interfaces.
    expect(await reasons(store, 'use-case change-use-case', { id: 'EX-LEND-UC01', goal: 'A member clicks the borrow button.' })).toEqual([
      ['essential-names-technology', 'EX-LEND-UC01', 'Use case EX-LEND-UC01 is essential, and its goal says "click"'],
    ]);
    expect(await reasons(store, 'use-case add-uc-requirement', { id: 'EX-LEND-UC01-R02', use_case_id: 'EX-LEND-UC01', title: 'Due date shown', statement: 'The Web app MUST show the due date.' })).toEqual([
      ['essential-names-technology', 'EX-LEND-UC01-R02', 'UC requirement EX-LEND-UC01-R02 is essential, and its statement says "web app"'],
    ]);
    expect(await reasons(store, 'domain change-term', { id: 'EX-LEND-TM01', title: 'Loan row' })).toEqual([
      ['essential-names-technology', 'EX-LEND-TM01', 'Term EX-LEND-TM01 is essential, and its title says "row"'],
    ]);
    // A step names an interface only as the variant that interface alone does; no step may click.
    expect(await reasons(store, 'use-case change-flow-step', { id: 'EX-LEND-UC01-FL-S02', title: 'See the loan in the Web app' })).toEqual([
      ['essential-names-technology', 'EX-LEND-UC01-FL-S02', 'Flow step EX-LEND-UC01-FL-S02 is essential, and its title says "web app"'],
    ]);
    await run(store, 'use-case change-flow-step', { id: 'EX-LEND-UC01-FL-S02', title: 'See the loan in the Web app', interface_id: 'EX-IF01' });
    expect(await reasons(store, 'use-case change-flow-step', { id: 'EX-LEND-UC01-FL-S01', title: 'Click Borrow on the tool' })).toEqual([
      ['essential-names-technology', 'EX-LEND-UC01-FL-S01', 'Flow step EX-LEND-UC01-FL-S01 is essential, and its title says "click"'],
    ]);
    // A view is a page with its buttons and rows, but not the storage behind them.
    await run(store, 'view change-view', { id: 'EX-V01', title: 'Catalog page', description: 'Every tool in a row with a Borrow button.' });
    expect(await reasons(store, 'view change-view', { id: 'EX-V01', description: 'Every tool, read from the database.' })).toEqual([
      ['essential-names-technology', 'EX-V01', 'View EX-V01 is essential, and its description says "database"'],
    ]);
    // A term of the record's own domain is its language: the library lends reading tables.
    await run(store, 'domain add-term', { id: 'EX-LEND-TM02', domain_id: 'EX-LEND', title: 'Table', meaning: 'A reading table members borrow by the hour.' });
    await run(store, 'use-case change-use-case', { id: 'EX-LEND-UC02', goal: 'The librarian adds a tool or a table to the catalog.' });
    // A product has one language: a term of another of its domains excuses its word, and one no term defines is refused.
    await run(store, 'domain add-domain', { id: 'EX-SHELF', title: 'Shelving', product_id: 'EX', position: 2, subdomain_type: 'supporting', description: 'Where the tools stand.' });
    await run(store, 'domain add-term', { id: 'EX-SHELF-TM01', domain_id: 'EX-SHELF', title: 'Column', meaning: 'An upright of the shelf, its bays stacked in it.' });
    await run(store, 'use-case change-uc-requirement', { id: 'EX-LEND-UC02-R01', statement: 'The librarian MUST put a returned tool back in its column.' });
    expect(await reasons(store, 'use-case change-uc-requirement', { id: 'EX-LEND-UC02-R01', statement: 'The librarian MUST put a returned tool back in its column of the database.' })).toEqual([
      ['essential-names-technology', 'EX-LEND-UC02-R01', 'UC requirement EX-LEND-UC02-R01 is essential, and its statement says "database"'],
    ]);
    // A pattern decides the means, so it is not read.
    await run(store, 'pattern change-pattern-rule', { id: 'EX-PAT-ACT-R01', statement: 'A saved record MUST answer the same JSON over HTTP.' });
    // The product's technology words count in every group, and no term excuses them.
    await run(store, 'product-setting set-technology-words', { product_id: 'EX', technology_words: ['Postgres', 'Table'] });
    expect(await reasons(store, 'use-case change-use-case', { id: 'EX-LEND-UC02', goal: 'The librarian adds a reading table to the catalog.' })).toEqual([
      ['essential-names-technology', 'EX-LEND-UC02', 'Use case EX-LEND-UC02 is essential, and its goal says "table"'],
    ]);
    // A record already in the data is not refused until its text is written: the check keeps reporting it.
    await run(store, 'use-case change-use-case', { id: 'EX-LEND-UC02', actors: ['Librarian', 'Member'] });
  });

  it('LA-STD-PRINCIPLES-R05-T06 The write refusal and accidental-in-essential read one list: every record the check reports is refused when the text it names the word in is written again', async () => {
    let data = changing(complete(), 'use_case', (r) => r.id === 'EX-LEND-UC01', { goal: 'A member clicks the borrow button.' });
    data = changing(data, 'uc_requirement', (r) => r.id === 'EX-LEND-UC01-R01', { statement: 'The Web app MUST refuse a tool whose row says it is on loan.' });
    data = changing(data, 'view', () => true, { title: 'Catalog page', description: 'Every tool in a row, read from the JSON the database keeps.' });
    data = changing(data, 'term', () => true, { meaning: 'One tool lent to one member, kept by the repositories.' });
    data = changing(data, 'integration', (r) => r.id === 'EX-INT01', { description: 'Reminders sent through the mail adapter.' });
    data = adding(data, { product_setting: [{ product_id: 'EX', max_children: 15, max_entities_per_aggregate: 7, technology_words: ['Postgres'] }] });
    data = changing(data, 'domain_service', () => true, { statement: 'The due date MUST be 14 days after the loan starts, as Postgres counts days.' });
    const reported = ofCheck(await loadData(data), 'accidental-in-essential').map((p) => [String(p.record), p.message.replace(/^.* names technology: /, '').replace(/; say .*/, '')]);
    expect(reported.map(([record]) => record)).toEqual(['EX-INT01', 'EX-LEND-DS01', 'EX-LEND-TM01', 'EX-LEND-UC01', 'EX-LEND-UC01-R01', 'EX-V01']);
    const store = await storeOf(data);
    const rewrite: Record<string, [string, Record<string, unknown>]> = {
      'EX-INT01': ['integration change-integration', { id: 'EX-INT01', description: 'Reminders sent through the mail adapter, again.' }],
      'EX-LEND-DS01': ['domain change-domain-service', { id: 'EX-LEND-DS01', statement: 'The due date MUST be 14 days after the loan starts, as Postgres counts days, again.' }],
      'EX-LEND-TM01': ['domain change-term', { id: 'EX-LEND-TM01', meaning: 'One tool lent to one member, kept by the repositories, again.' }],
      'EX-LEND-UC01': ['use-case change-use-case', { id: 'EX-LEND-UC01', goal: 'A member clicks the borrow button, again.' }],
      'EX-LEND-UC01-R01': ['use-case change-uc-requirement', { id: 'EX-LEND-UC01-R01', statement: 'The Web app MUST refuse a tool whose row says it is on loan, again.' }],
      'EX-V01': ['view change-view', { id: 'EX-V01', description: 'Every tool in a row, read from the JSON the database keeps, again.' }],
    };
    for (const [record, said] of reported) {
      const [command, input] = rewrite[record];
      const refused = await refusedBy(store, command, input);
      expect(refused.map((p) => p.key), record).toEqual([record]);
      expect(refused[0].message, record).toContain(said.split(' and ').at(-1));
    }
  });

  it('LA-STD-PRINCIPLES-R05-T07 A change is refused only for the text it sets: a record whose title names technology can still have its lead text changed', async () => {
    let data = adding(complete(), { product_setting: [{ product_id: 'EX', max_children: 15, max_entities_per_aggregate: 7, technology_words: ['Postgres'] }] });
    data = changing(data, 'use_case', (r) => r.id === 'EX-LEND-UC01', { title: 'Borrow a tool from Postgres' });
    const root = await build(data);
    const store = await openStore(root, { latheDataDir: null });
    opened.push(store);
    // The goal changes, though the title names the word: the write does not set the title.
    await run(store, 'use-case change-use-case', { id: 'EX-LEND-UC01', goal: 'A member borrows a free tool for a week.' });
    expect(ofCheck(await loadWorkspace(root), 'accidental-in-essential').map((p) => [p.record, p.message.replace(/^.* names technology: /, '').replace(/; say .*/, '')])).toEqual([
      ['EX-LEND-UC01', 'its title says "postgres"'],
    ]);
    // A write that sets the title is refused for the title alone.
    expect(await reasons(store, 'use-case change-use-case', { id: 'EX-LEND-UC01', title: 'Borrow a tool kept in Postgres' })).toEqual([
      ['essential-names-technology', 'EX-LEND-UC01', 'Use case EX-LEND-UC01 is essential, and its title says "postgres"'],
    ]);
    // An add sets every text it is given.
    expect(await reasons(store, 'use-case add-use-case', { id: 'EX-LEND-UC03', title: 'Return a tool', domain_id: 'EX-LEND', goal: 'A member returns a tool and Postgres records it.', result_id: 'EX-LEND-QRY01', actors: ['Member'] })).toEqual([
      ['essential-names-technology', 'EX-LEND-UC03', 'Use case EX-LEND-UC03 is essential, and its goal says "postgres"'],
    ]);
  });

  it('LA-STD-PRINCIPLES-R05-T08 A write that links an essential record to an accidental one, or declares a relation that would, is refused; an outcome may still be measured by a record of an accidental kind', async () => {
    const store = await storeOf(adding(complete(), essentialKind));
    expect(await reasons(store, 'product declare-product-relation', { name: 'cites', source_kind: 'notice', target_kind: 'table', product_id: 'EX', forward_label: 'Cites', reverse_label: 'Cited by', description: 'The notice cites the table.' })).toEqual([
      ['essential-links-accidental', 'name cites, source_kind notice, target_kind table', 'The relation cites would link the essential notice to the accidental table: an essential record never points at how it is built; link the other way, from the technical record to what it implements, builds or fills.'],
    ]);
    // A relation already declared to any record still links only what is not accidental.
    expect(await reasons(store, 'extension-record add-extension-record', { kind: 'notice', id: 'EX-LEND-NT01', parent_id: 'EX-LEND', values: { title: 'Closed on Sunday' }, links: { cites: ['EX-LEND-EN01-TB'] } })).toEqual([
      ['essential-links-accidental', 'source_id EX-LEND-NT01, target_id EX-LEND-EN01-TB', 'Notice EX-LEND-NT01 is essential and Table EX-LEND-EN01-TB accidental, so cites cannot link them: an essential record never points at how it is built; link the other way, from the technical record to what it implements, builds or fills.'],
    ]);
    await run(store, 'extension-record add-extension-record', { kind: 'notice', id: 'EX-LEND-NT01', parent_id: 'EX-LEND', values: { title: 'Closed on Sunday' }, links: { cites: ['EX-LEND-UC01'] } });
    // measured_by may: what measures an outcome may be a report.
    await run(store, 'product declare-product-kind', { name: 'report', product_id: 'EX', label: 'Report', description: 'A script that measures the outcomes.', parent_kind: 'domain', stage: 'technical-specification', obligation: false, complexity: 'accidental', id_pattern: '<domain>-RP<nn>', id_example: 'EX-LEND-RP01' });
    await run(store, 'product declare-product-relation', { name: 'measured_by', source_kind: 'business_outcome', target_kind: 'report', product_id: 'EX', forward_label: 'Measured by', reverse_label: 'Measures', description: 'The report measures the business outcome.' });
  });
});

/** A second domain of the product, with an aggregate its command changes and a read model its query asks. */
const shop: Data = {
  domain: [{ id: 'EX-SHOP', title: 'Shop', product_id: 'EX', position: 2, subdomain_type: 'supporting', description: 'Selling spare parts.' }],
  aggregate: [{ id: 'EX-SHOP-A1', title: 'Sale', domain_id: 'EX-SHOP', identity: 'Sale ID', description: 'One part sold to one member.' }],
  entity: [{ id: 'EX-SHOP-EN01', title: 'Sale', aggregate_id: 'EX-SHOP-A1', role: 'root', description: 'The sale itself.' }],
  command: [{ id: 'EX-SHOP-CMD01', title: 'Sell a part', entity_id: 'EX-SHOP-EN01', description: 'Sells a spare part to a member.' }],
  read_model: [{ id: 'EX-SHOP-RM01', title: 'Parts for sale', domain_id: 'EX-SHOP', description: 'The spare parts on the shelf.' }],
  query: [{ id: 'EX-SHOP-QRY01', title: 'List parts for sale', read_model_id: 'EX-SHOP-RM01', description: 'The parts for sale, by name.' }],
};

describe('a write keeps a use case with its result', () => {
  it("LA-STD-MODELING-R20-T02 A write that adds a use case, or changes its result, so that its result is of another domain is refused, naming Move a use case; one in its result's domain is not", async () => {
    const store = await storeOf(adding(complete(), shop));
    expect(await reasons(store, 'use-case add-use-case', { id: 'EX-LEND-UC03', title: 'Sell a part', domain_id: 'EX-LEND', goal: 'A member buys a spare part.', result_id: 'EX-SHOP-CMD01', actors: ['Member'] })).toEqual([
      ['use-case-result-in-domain', 'EX-LEND-UC03', "Use case EX-LEND-UC03 would be in EX-LEND, but its result EX-SHOP-CMD01 is of EX-SHOP: a use case sits in its result's domain; move it to EX-SHOP with Move a use case, or give it a result of its own domain."],
    ]);
    await run(store, 'use-case add-use-case', { id: 'EX-SHOP-UC01', title: 'Sell a part', domain_id: 'EX-SHOP', goal: 'A member buys a spare part.', result_id: 'EX-SHOP-CMD01', actors: ['Member'] });
    await run(store, 'use-case add-use-case', { id: 'EX-LEND-UC03', title: 'See the free tools', domain_id: 'EX-LEND', goal: 'A member sees which tools are free.', result_id: 'EX-LEND-QRY01', actors: ['Member'] });
    expect(await reasons(store, 'use-case change-use-case', { id: 'EX-LEND-UC03', result_id: 'EX-SHOP-QRY01' })).toEqual([
      ['use-case-result-in-domain', 'EX-LEND-UC03', "Use case EX-LEND-UC03 would be in EX-LEND, but its result EX-SHOP-QRY01 is of EX-SHOP: a use case sits in its result's domain; move it to EX-SHOP with Move a use case, or give it a result of its own domain."],
    ]);
    // Data already written stays loadable: the check reports it.
    const written = adding(complete(), { ...shop, use_case: [{ id: 'EX-LEND-UC03', title: 'Sell a part', domain_id: 'EX-LEND', goal: 'A member buys a spare part.', result_id: 'EX-SHOP-CMD01' }] });
    expect(ofCheck(await loadData(written), 'use-case-result-in-domain').map((p) => p.record)).toEqual(['EX-LEND-UC03']);
  });
});
