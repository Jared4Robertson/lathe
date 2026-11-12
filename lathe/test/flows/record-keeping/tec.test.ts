// The record-keeping flows of the technical specification: the Owner or an Agent keeps a domain's entry points,
// tooling and tables, and a product's standards with their rules and rule tests, through each aggregate's own command,
// each walked through the real `lathe` command on a temporary product (LA-IF03) that starts as the tool library
// example's records.
import { afterAll, describe, expect, it } from 'vitest';
import { add, link, product, removeProducts, type Product } from '../product.ts';
import { copyExample, copyRow } from './example.ts';

afterAll(removeProducts);

/** Whether a data file of the product holds the text. */
const has = (tl: Product, table: string, text: string) => tl.read(`data/${table}.jsonl`).includes(text);

/** A standard with one rule and its test, and a technical record that meets the rule. */
const CODE = [
  add('standard', { id: 'TL-STD-CODE', title: 'Code', product_id: 'TL', type: 'engineering', description: 'How the library\'s code is written.' }),
  add('standard_rule', { id: 'TL-STD-CODE-R01', title: 'Names say what a thing is', standard_id: 'TL-STD-CODE', statement: 'A name MUST say what the thing is.' }),
  add('standard_rule_test', { id: 'TL-STD-CODE-R01-T01', title: 'A vague name is found', standard_rule_id: 'TL-STD-CODE-R01', level: 'unit', state: 'automated', file: 'test/names.test.ts', when: 'Scans the code for names like data or thing.', then: 'Expects none.' }),
];
/** A standard no record meets. */
const SPARE = [
  add('standard', { id: 'TL-STD-SPARE', title: 'Spare', product_id: 'TL', type: 'quality', description: 'A standard nothing meets.' }),
  add('standard_rule', { id: 'TL-STD-SPARE-R01', title: 'Nothing is spare', standard_id: 'TL-STD-SPARE', statement: 'Nothing MUST be spare.' }),
];

describe('Record-keeping flows of the technical specification', () => {
  it('LA-TEC-UC101-FL-T LA-TEC-UC101-R01-T01 LA-TEC-UC101-R02-T01 remove an entry point', async () => {
    const tl = product();
    copyExample(tl);
    await tl.seed([copyRow('entry_point', 'TL-LEND-ENTRY01', { id: 'TL-LEND-ENTRY09', title: 'spare.ts', file: 'src/spare.ts' })]);
    tl.command('entry-point remove-entry-point', { id: 'TL-LEND-ENTRY09' });
    expect(has(tl, 'entry_point', 'TL-LEND-ENTRY09')).toBe(false);
    // An open question is about the entry point, so it stays.
    tl.command('product add-question', { id: 'TL-Q01', title: 'Is the server the only entry?', product_id: 'TL', owner: 'Owner', description: 'Or the report too.', about: ['TL-LEND-ENTRY01'] });
    tl.refuse('entry-point remove-entry-point', { id: 'TL-LEND-ENTRY01' });
    expect(has(tl, 'entry_point', 'TL-LEND-ENTRY01')).toBe(true);
  });

  it('LA-TEC-UC102-FL-T LA-TEC-UC102-R01-T01 LA-TEC-UC102-R02-T01 remove a tooling record', async () => {
    const tl = product();
    copyExample(tl);
    await tl.seed([copyRow('tooling', 'TL-LEND-TOOL01', { id: 'TL-LEND-TOOL09', title: 'spare.json', file: 'spare.json' })]);
    tl.command('tooling remove-tooling', { id: 'TL-LEND-TOOL09' });
    expect(has(tl, 'tooling', 'TL-LEND-TOOL09')).toBe(false);
    tl.command('product add-question', { id: 'TL-Q01', title: 'Is tsconfig the only config?', product_id: 'TL', owner: 'Owner', description: 'Or vitest too.', about: ['TL-LEND-TOOL01'] });
    tl.refuse('tooling remove-tooling', { id: 'TL-LEND-TOOL01' });
    expect(has(tl, 'tooling', 'TL-LEND-TOOL01')).toBe(true);
  });

  it('LA-TEC-UC103-FL-T LA-TEC-UC103-R01-T01 LA-TEC-UC103-R02-T01 change a standard', async () => {
    const tl = product();
    await tl.seed([...CODE, ...SPARE]);
    tl.command('standard change-standard', { id: 'TL-STD-CODE', title: 'Code style', description: 'How the code reads.' });
    expect(has(tl, 'standard', 'Code style')).toBe(true);
    expect(has(tl, 'standard', '"product_id":"TL"')).toBe(true);
    // A title another standard has is refused.
    tl.refuse('standard change-standard', { id: 'TL-STD-CODE', title: 'Spare' });
    expect(has(tl, 'standard', 'Code style')).toBe(true);
  });

  it('LA-TEC-UC104-FL-T LA-TEC-UC104-R01-T01 LA-TEC-UC104-R02-T01 remove a standard', async () => {
    const tl = product();
    copyExample(tl);
    await tl.seed([...CODE, ...SPARE, link('TL-LEND-TOOL01', 'meets', 'TL-STD-CODE-R01')]);
    tl.command('standard remove-standard', { id: 'TL-STD-SPARE' });
    expect(has(tl, 'standard', 'TL-STD-SPARE')).toBe(false);
    expect(has(tl, 'standard_rule', 'TL-STD-SPARE-R01')).toBe(false);
    // A tooling record meets the other standard's rule, so it stays.
    tl.refuse('standard remove-standard', { id: 'TL-STD-CODE' });
    expect(has(tl, 'standard', 'TL-STD-CODE')).toBe(true);
  });

  it('LA-TEC-UC105-FL-T LA-TEC-UC105-R01-T01 LA-TEC-UC105-R02-T01 add a standard rule', async () => {
    const tl = product();
    await tl.seed(CODE);
    tl.command('standard add-standard-rule', { id: 'TL-STD-CODE-R02', title: 'Names are short', standard_id: 'TL-STD-CODE', statement: 'A name SHOULD be short.', group_name: 'Naming' });
    expect(has(tl, 'standard_rule', 'TL-STD-CODE-R02')).toBe(true);
    tl.refuse('standard add-standard-rule', { id: 'TL-STD-CODE-R02', title: 'Again', standard_id: 'TL-STD-CODE', statement: 'A name MAY be again.' });
  });

  it('LA-TEC-UC106-FL-T LA-TEC-UC106-R01-T01 LA-TEC-UC106-R02-T01 remove a standard rule', async () => {
    const tl = product();
    copyExample(tl);
    await tl.seed([...CODE, add('standard_rule', { id: 'TL-STD-CODE-R02', title: 'Names are short', standard_id: 'TL-STD-CODE', statement: 'A name SHOULD be short.' }), link('TL-LEND-TOOL01', 'meets', 'TL-STD-CODE-R01')]);
    tl.command('standard remove-standard-rule', { id: 'TL-STD-CODE-R02' });
    expect(has(tl, 'standard_rule', 'TL-STD-CODE-R02')).toBe(false);
    // A tooling record meets the first rule, so it stays with its test.
    tl.refuse('standard remove-standard-rule', { id: 'TL-STD-CODE-R01' });
    expect(has(tl, 'standard_rule_test', 'TL-STD-CODE-R01-T01')).toBe(true);
  });

  it('LA-TEC-UC107-FL-T LA-TEC-UC107-R01-T01 LA-TEC-UC107-R02-T01 change a standard rule test', async () => {
    const tl = product();
    await tl.seed(CODE);
    tl.command('standard change-standard-rule-test', { id: 'TL-STD-CODE-R01-T01', when: 'Scans every source file for vague names.', level: 'integration' });
    expect(has(tl, 'standard_rule_test', 'every source file')).toBe(true);
    // An automated test must name its file.
    tl.refuse('standard change-standard-rule-test', { id: 'TL-STD-CODE-R01-T01', file: '' });
    expect(has(tl, 'standard_rule_test', 'test/names.test.ts')).toBe(true);
  });

  it('LA-TEC-UC108-FL-T LA-TEC-UC108-R01-T01 LA-TEC-UC108-R02-T01 remove a standard rule test', async () => {
    const tl = product();
    copyExample(tl);
    await tl.seed([...CODE, add('standard_rule_test', { id: 'TL-STD-CODE-R01-T02', title: 'A long name is found', standard_rule_id: 'TL-STD-CODE-R01', level: 'unit', state: 'not automated yet', when: 'Scans for long names.', then: 'Expects none.' }), link('TL-BO01', 'measured_by', 'TL-STD-CODE-R01-T01')]);
    tl.command('standard remove-standard-rule-test', { id: 'TL-STD-CODE-R01-T02' });
    expect(has(tl, 'standard_rule_test', 'TL-STD-CODE-R01-T02')).toBe(false);
    // An outcome measures the first test, so it stays.
    tl.refuse('standard remove-standard-rule-test', { id: 'TL-STD-CODE-R01-T01' });
    expect(has(tl, 'standard_rule_test', 'TL-STD-CODE-R01-T01')).toBe(true);
  });

  it('LA-TEC-UC109-FL-T LA-TEC-UC109-R01-T01 LA-TEC-UC109-R02-T01 remove a table', () => {
    const tl = product();
    copyExample(tl);
    // The loans table fills a slot of the pattern, which keeps it until the fill ends.
    tl.refuse('table remove-table', { id: 'TL-LEND-EN04-TB' });
    tl.command('slot-filling stop-filling-slot', { record_id: 'TL-LEND-EN04-TB', slot_id: 'TL-PAT-LIBRARIAN-ACTION-SL04' });
    tl.command('table remove-table', { id: 'TL-LEND-EN04-TB' });
    expect(has(tl, 'table', 'TL-LEND-EN04-TB')).toBe(false);
    expect(has(tl, 'table_key', 'TL-LEND-EN04-TB')).toBe(false);
    // The members table is the target of another table's foreign key, so it stays.
    tl.refuse('table remove-table', { id: 'TL-LEND-EN01-TB' });
    expect(has(tl, 'table', 'TL-LEND-EN01-TB')).toBe(true);
  });
});
