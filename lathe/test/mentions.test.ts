// IDs named in a record's text. The engine reads no structure out of text: an ID in a goal, statement or notes field
// is plain text, kept as written, whatever its prefix or formatting, and only link tables link records. Each product
// is a space of its own: a link stays inside its product, and an ID of another product in text is no link and no
// problem.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ENGINE_CHECKS, loadWorkspace, type Workspace } from '../src/index.ts';
import { adding, build, changing, complete, loadData, refusals, removeData } from './helpers.ts';

const goal = 'It follows EX-LEND-UC02, then\nEX-LEND-UC01-R01, then EX-LEND-UC02 again. EX-LEND-UC01 is this record. It names NX-E-UC01 of another product, '
  + 'EX-LEND-INV99 that no record has, `EX-LEND-UC02` in a code span, and STD-CODE-R01 and SYS-AUTH.\n```\nEX-LEND-UC94\n```';

const data = () =>
  adding(changing(complete(), 'use_case', (r) => r.id === 'EX-LEND-UC01', { goal }), {
    product: [{ id: 'NX', title: 'Next product', description: 'A second product beside the first.' }],
    domain: [{ id: 'NX-E', title: 'Elsewhere', product_id: 'NX', position: 1, subdomain_type: 'generic', description: 'Work done in the second product.' }],
  });

let ws: Workspace;
let clean: Workspace;
beforeAll(async () => {
  ws = await loadData(data());
  clean = await loadData(complete());
});
afterAll(removeData);
const text = (id: string) => Object.values(ws.records.find((r) => r.id === id)!.fields).filter((v): v is string => typeof v === 'string').join('\n');

describe('IDs in text', () => {
  it('LA-PRD-UC38-R03-T01 An ID a record names in its text is kept as written, and makes no link', () => {
    expect(text('EX-LEND-UC01')).toContain('It follows EX-LEND-UC02, then\nEX-LEND-UC01-R01');
    expect(ws.links).toEqual(clean.links);
    // A record carries its typed fields and parts, and no list of the IDs its text names.
    expect(Object.keys(ws.records.find((r) => r.id === 'EX-LEND-UC01')!).sort()).toEqual(['aggregate', 'domain', 'fields', 'id', 'kind', 'parent', 'parts', 'product', 'title']);
  });

  it('LA-PRD-UC38-R03-T01 IDs in code spans and fenced code blocks are kept with the text as written', () => {
    expect(text('EX-LEND-UC01')).toContain('`EX-LEND-UC02` in a code span');
    expect(text('EX-LEND-UC01')).toContain('```\nEX-LEND-UC94\n```');
  });

  it('LA-PRD-UC38-R03-T01 Text keeps every repeat as written, its own ID included', () => {
    expect(text('EX-LEND-UC01')).toContain('then EX-LEND-UC02 again. EX-LEND-UC01 is this record.');
  });

  it("LA-PRD-UC38-R03-T01 A record's text naming another product's record is plain text", () => {
    expect(text('EX-LEND-UC01')).toContain('NX-E-UC01');
    expect(ws.links.filter((l) => l.source === 'EX-LEND-UC01' || l.target === 'NX-E-UC01')).toEqual([]);
    expect(ws.problems).toEqual([]);
  });

  it('LA-PRD-UC38-R04-T01 A token that is not an ID of this workspace is plain text and no problem', () => {
    expect(text('EX-LEND-UC01')).toContain('STD-CODE-R01 and SYS-AUTH');
    expect(ws.problems).toEqual([]);
  });

  it('LA-PRD-UC38-R04-T01 An ID in text that no record has is no warning: no check reads text for IDs', () => {
    expect(text('EX-LEND-UC01')).toContain('EX-LEND-INV99');
    expect(ws.problems).toEqual([]);
    expect(ENGINE_CHECKS.map((c) => c.check)).toEqual(['data-refused', 'strict-check', 'strict-gaps']);
  });

  it('LA-PRD-UC38-R03-T01 Only link tables link records: a link to a record that does not exist is refused, while text naming it is not', async () => {
    const base = { product: [{ id: 'MX', title: 'Mentions', description: 'A product whose text names IDs.' }], domain: [{ id: 'MX-D', title: 'Domain', product_id: 'MX', position: 1, subdomain_type: 'core', description: 'It reads MX-D-SP99.' }] };
    expect(await refusals(base)).toEqual([]);
    const command = { aggregate: [{ id: 'MX-D-A1', title: 'Loan', domain_id: 'MX-D', identity: 'Loan ID', description: 'One loan.' }], entity: [{ id: 'MX-D-EN01', title: 'Loan', aggregate_id: 'MX-D-A1', role: 'root', description: 'The loan itself.' }], command: [{ id: 'MX-D-CMD01', title: 'Open', entity_id: 'MX-D-EN01', description: 'Opens a loan.' }] };
    expect(await refusals({ ...base, ...command, checks: [{ source_id: 'MX-D-CMD01', target_id: 'MX-D-SP99' }] })).toEqual([expect.objectContaining({ rule: 'foreign-key', table: 'checks' })]);
  });

  /** The complete product with a view of another product that presents one of its commands. */
  const crossing = () => {
    const both = adding(complete(), {
      product: [{ id: 'NX', title: 'Next product', description: 'A second product beside the first.' }],
      view: [{ id: 'NX-V01', title: 'Elsewhere', description: 'A page of the second product.' }],
    });
    both.presents = [...both.presents.filter((l) => !(l.source_id === 'EX-V01' && l.target_id === 'EX-LEND-CMD02')), { source_id: 'NX-V01', target_id: 'EX-LEND-CMD02' }];
    return both;
  };

  it('LA-PRD-UC38-R02-T01 A link from a record of one product to a record of another is refused, whatever the relation', async () => {
    expect(await refusals(crossing())).toEqual([
      expect.objectContaining({ rule: 'link-crosses-product', table: 'presents', message: expect.stringContaining('NX-V01 is in product NX') }),
    ]);
  });

  it('LA-CHK-UC01-R04-T02 A link into another product in a data file is a data-refused error', async () => {
    const root = await build(adding(complete(), { product: [{ id: 'NX', title: 'Next product', description: 'A second product beside the first.' }], view: [{ id: 'NX-V01', title: 'Elsewhere', description: 'A page of the second product.' }] }));
    const file = path.join(root, 'data', 'presents.jsonl');
    writeFileSync(file, readFileSync(file, 'utf8').replace(/"source_id":"EX-V01"(,"target_id":"EX-LEND-CMD02")/, '"source_id":"NX-V01"$1'));
    const loaded = await loadWorkspace(root);
    expect(loaded.problems).toEqual([expect.objectContaining({ severity: 'error', check: 'data-refused', message: expect.stringContaining('NX-V01 is in product NX') })]);
  });
});
