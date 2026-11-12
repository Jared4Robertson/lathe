// The record-keeping flows of the product definition: the Owner or an Agent keeps a product, its kinds and relations,
// open questions, interfaces, business outcomes and journeys through each aggregate's own command, each walked through
// the real `lathe` command on a temporary product (LA-IF03) that starts as the tool library example's records.
import { afterAll, describe, expect, it } from 'vitest';
import { link, product, removeProducts, type Product } from '../product.ts';
import { copyExample, copyRow } from './example.ts';

afterAll(removeProducts);

/** The product's own kind with a note, declared for the tests that remove one. */
const MEMO = { name: 'memo', product_id: 'TL', label: 'Memo', description: 'A note.', parent_kind: 'product', stage: 'technical-specification', obligation: false, complexity: 'accidental', fields: [{ name: 'text', type: 'text', required: true, description: 'The note.' }] };

/** Whether a data file of the product holds the text. */
const has = (tl: Product, table: string, text: string) => tl.read(`data/${table}.jsonl`).includes(text);

describe('Record-keeping flows of the product definition', () => {
  it('LA-PRD-UC101-FL-T LA-PRD-UC101-R01-T01 LA-PRD-UC101-R02-T01 add a product', () => {
    const tl = product();
    tl.command('product add-product', { id: 'SH', title: 'Shop', description: 'Sells tools.', roles: [{ name: 'Owner', description: 'Runs the shop.' }] });
    expect(has(tl, 'product', '"id":"SH"')).toBe(true);
    expect(has(tl, 'role', 'Runs the shop.')).toBe(true);
    const before = tl.read('data/product.jsonl');
    tl.refuse('product add-product', { id: 'TL', title: 'Again', description: 'Twice.' });
    expect(tl.read('data/product.jsonl')).toBe(before);
  });

  it('LA-PRD-UC102-FL-T LA-PRD-UC102-R01-T01 LA-PRD-UC102-R02-T01 change a product kind', () => {
    const tl = product();
    copyExample(tl);
    tl.command('product change-product-kind', { name: 'report', label: 'Outcome report' });
    expect(has(tl, 'product_kind', 'Outcome report')).toBe(true);
    // The example's report record has a file, so a kind without one no longer fits it.
    const before = tl.read('data/product_kind_field.jsonl');
    tl.refuse('product change-product-kind', { name: 'report', fields: [{ name: 'script', type: 'text', required: true, description: 'The script.' }] });
    expect(tl.read('data/product_kind_field.jsonl')).toBe(before);
  });

  it('LA-PRD-UC103-FL-T LA-PRD-UC103-R01-T01 LA-PRD-UC103-R02-T01 remove a product kind', () => {
    const tl = product();
    copyExample(tl);
    tl.command('product declare-product-kind', MEMO);
    tl.command('product remove-product-kind', { name: 'memo' });
    expect(has(tl, 'product_kind', '"name":"memo"')).toBe(false);
    tl.refuse('product remove-product-kind', { name: 'report' });
    expect(has(tl, 'product_kind', '"name":"report"')).toBe(true);
  });

  it('LA-PRD-UC104-FL-T LA-PRD-UC104-R01-T01 LA-PRD-UC104-R02-T01 change a product relation', () => {
    const tl = product();
    copyExample(tl);
    tl.command('product change-product-relation', { name: 'measured_by', source_kind: 'business_outcome', target_kind: 'report', description: 'The report counts the measure.' });
    expect(has(tl, 'product_relation', 'The report counts the measure.')).toBe(true);
    tl.refuse('product change-product-relation', { name: 'measured_by', source_kind: 'business_outcome', target_kind: 'memo', description: 'No such pair.' });
  });

  it('LA-PRD-UC105-FL-T LA-PRD-UC105-R01-T01 LA-PRD-UC105-R02-T01 remove a product relation', () => {
    const tl = product();
    copyExample(tl);
    tl.command('product declare-product-kind', MEMO);
    tl.command('product declare-product-relation', { name: 'noted_by', source_kind: 'memo', target_kind: 'business_outcome', product_id: 'TL', forward_label: 'Notes', reverse_label: 'Noted by', description: 'The memo notes the outcome.' });
    tl.command('product remove-product-relation', { name: 'noted_by', source_kind: 'memo', target_kind: 'business_outcome' });
    expect(has(tl, 'product_relation', 'noted_by')).toBe(false);
    // The example's outcomes are still measured by the report, so that pair stays.
    tl.refuse('product remove-product-relation', { name: 'measured_by', source_kind: 'business_outcome', target_kind: 'report' });
    expect(has(tl, 'product_relation', 'measured_by')).toBe(true);
  });

  it('LA-PRD-UC106-FL-T LA-PRD-UC106-R01-T01 LA-PRD-UC106-R02-T01 change an open question', () => {
    const tl = product();
    copyExample(tl);
    tl.command('product add-question', { id: 'TL-Q01', title: 'How long is a loan?', product_id: 'TL', owner: 'Librarian', description: 'Two weeks or one.' });
    tl.command('product change-question', { id: 'TL-Q01', title: 'How long is a loan, in days?', about: ['TL-LEND-UC01'] });
    expect(has(tl, 'question', 'in days')).toBe(true);
    expect(has(tl, 'about', 'TL-LEND-UC01')).toBe(true);
    tl.refuse('product change-question', { id: 'TL-Q01', owner: 'Mayor' });
    expect(has(tl, 'question', '"owner":"Librarian"')).toBe(true);
  });

  it('LA-PRD-UC107-FL-T LA-PRD-UC107-R01-T01 LA-PRD-UC107-R02-T01 remove an interface', () => {
    const tl = product();
    copyExample(tl);
    const desk = { product_id: 'TL', title: 'Desk screen', kind: 'web app', description: 'The screen at the desk.', public: false, actors: ['Librarian'] };
    tl.command('interface add-interface', { id: 'TL-IF03', ...desk, offers: ['TL-LEND-UC01'] });
    tl.command('interface add-interface', { id: 'TL-IF04', ...desk, title: 'Spare screen' });
    tl.command('interface remove-interface', { id: 'TL-IF04' });
    expect(has(tl, 'interface', 'TL-IF04')).toBe(false);
    // A variant step of the borrow flow names the desk screen, so it stays.
    tl.command('use-case add-flow-step', { id: 'TL-LEND-UC01-FL-S90', title: 'The librarian borrows for the member at the desk', flow_id: 'TL-LEND-UC01-FL', path: 'desk', position: 1, interface_id: 'TL-IF03' });
    tl.refuse('interface remove-interface', { id: 'TL-IF03' });
    expect(has(tl, 'interface', 'TL-IF03')).toBe(true);
    expect(has(tl, 'offers', 'TL-LEND-UC01')).toBe(true);
  });

  it('LA-PRD-UC108-FL-T LA-PRD-UC108-R01-T01 LA-PRD-UC108-R02-T01 remove a business outcome', async () => {
    const tl = product();
    copyExample(tl);
    await tl.seed([copyRow('business_outcome', 'TL-BO01', { id: 'TL-BO09', title: 'Tools kept clean' }), link('TL-BO09', 'measured_by', 'TL-LEND-RP01')]);
    tl.command('business-outcome remove-business-outcome', { id: 'TL-BO09' });
    expect(has(tl, 'business_outcome', 'TL-BO09')).toBe(false);
    expect(has(tl, 'measured_by', 'TL-BO09')).toBe(false);
    // A journey serves TL-BO01, so it stays.
    tl.refuse('business-outcome remove-business-outcome', { id: 'TL-BO01' });
    expect(has(tl, 'business_outcome', 'TL-BO01')).toBe(true);
  });

  it('LA-PRD-UC109-FL-T LA-PRD-UC109-R01-T01 LA-PRD-UC109-R02-T01 change a journey', () => {
    const tl = product();
    copyExample(tl);
    tl.command('journey change-journey', { id: 'TL-JR01', title: 'Get a damaged tool back into lending', serves: ['TL-BO05', 'TL-BO01'] });
    expect(has(tl, 'journey', 'back into lending')).toBe(true);
    expect(has(tl, 'serves', '{"source_id":"TL-JR01","target_id":"TL-BO01"}')).toBe(true);
    tl.refuse('journey change-journey', { id: 'TL-JR01', serves: ['TL-BO99'] });
  });

  it('LA-PRD-UC110-FL-T LA-PRD-UC110-R01-T01 LA-PRD-UC110-R02-T01 remove a journey', async () => {
    const tl = product();
    copyExample(tl);
    await tl.seed([link('TL-BO01', 'measured_by', 'TL-JR02-T')]);
    tl.command('journey remove-journey', { id: 'TL-JR03' });
    for (const table of ['journey', 'journey_step', 'journey_test', 'carries_out']) expect(has(tl, table, 'TL-JR03')).toBe(false);
    expect(has(tl, 'use_case', 'TL-LEND-UC01')).toBe(true);
    // An outcome measures the other journey's test, so it stays.
    tl.refuse('journey remove-journey', { id: 'TL-JR02' });
    expect(has(tl, 'journey', 'TL-JR02')).toBe(true);
  });

  it('LA-PRD-UC111-FL-T LA-PRD-UC111-R01-T01 LA-PRD-UC111-R02-T01 remove a journey step', () => {
    const tl = product();
    copyExample(tl);
    tl.command('journey remove-journey-step', { id: 'TL-JR01-S04' });
    expect(has(tl, 'journey_step', 'TL-JR01-S04')).toBe(false);
    expect(has(tl, 'carries_out', 'TL-JR01-S04')).toBe(false);
    // An open question is about the first step, so it stays.
    tl.command('product add-question', { id: 'TL-Q01', title: 'Who takes the tool back?', product_id: 'TL', owner: 'Librarian', description: 'The desk or the shelf.', about: ['TL-JR01-S01'] });
    tl.refuse('journey remove-journey-step', { id: 'TL-JR01-S01' });
    expect(has(tl, 'journey_step', 'TL-JR01-S01')).toBe(true);
  });

  it('LA-PRD-UC112-FL-T LA-PRD-UC112-R01-T01 LA-PRD-UC112-R02-T01 change a journey test', () => {
    const tl = product();
    copyExample(tl);
    tl.command('journey change-journey-test', { id: 'TL-JR01-T', expected_result: 'The tool is lent again once marked repaired.' });
    expect(has(tl, 'journey_test', 'lent again once marked repaired')).toBe(true);
    // An automated test must name its file.
    tl.refuse('journey change-journey-test', { id: 'TL-JR01-T', file: '' });
    expect(has(tl, 'journey_test', 'test/journeys.test.ts')).toBe(true);
  });

  it('LA-PRD-UC113-FL-T LA-PRD-UC113-R01-T01 LA-PRD-UC113-R02-T01 remove a journey test', async () => {
    const tl = product();
    copyExample(tl);
    await tl.seed([link('TL-BO01', 'measured_by', 'TL-JR02-T')]);
    tl.command('journey remove-journey-test', { id: 'TL-JR03-T' });
    expect(has(tl, 'journey_test', 'TL-JR03-T')).toBe(false);
    // An outcome measures the other journey's test, so it stays.
    tl.refuse('journey remove-journey-test', { id: 'TL-JR02-T' });
    expect(has(tl, 'journey_test', 'TL-JR02-T')).toBe(true);
  });
});
