// IDs named in a record's text. The engine reads no structure out of text: an ID in a goal, statement or notes field
// is plain text, kept as written, whatever its prefix or formatting, and only link tables link records. Each product
// is a space of its own: a link stays inside its product, and an ID of another product in text is no link and no
// problem.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ENGINE_CHECKS, type Workspace } from '../src/index.ts';
import { adding, changing, complete, loadData, refusals, removeData } from './helpers.ts';

const goal = 'It follows EX-LEND-UC02, then\nEX-LEND-UC01-R01, then EX-LEND-UC02 again. EX-LEND-UC01 is this record. It names NX-E-UC01 of another product, '
  + 'EX-LEND-INV99 that no record has, `EX-LEND-UC02` in a code span, and STD-CODE-R01 and SYS-AUTH.\n```\nEX-LEND-UC94\n```';

const data = () =>
  adding(changing(complete(), 'use_case', (r) => r.id === 'EX-LEND-UC01', { goal }), {
    product: [{ id: 'NX', title: 'Next product' }],
    domain: [{ id: 'NX-E', title: 'Elsewhere', product_id: 'NX', subdomain_type: 'generic' }],
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
  it('LA-AUT-T33 An ID a record names in its text is kept as written, and makes no link or problem', () => {
    expect(text('EX-LEND-UC01')).toContain('It follows EX-LEND-UC02, then\nEX-LEND-UC01-R01, then EX-LEND-UC02 again');
    expect(ws.links).toEqual(clean.links);
    expect(ws.problems).toEqual([]);
    // A record carries its typed fields and parts, and no list of the IDs its text names.
    expect(Object.keys(ws.records.find((r) => r.id === 'EX-LEND-UC01')!).sort()).toEqual(['aggregate', 'domain', 'fields', 'id', 'kind', 'parent', 'parts', 'product', 'title']);
  });

  it("LA-AUT-T121 A record's text naming another product's record, or no record, is plain text", () => {
    expect(text('EX-LEND-UC01')).toContain('NX-E-UC01');
    expect(text('EX-LEND-UC01')).toContain('EX-LEND-INV99');
    expect(ENGINE_CHECKS.map((c) => c.check)).toEqual(['data-refused']);
  });

  it('LA-CHK-T12 IDs in code spans and fenced code blocks are kept with the text as written', () => {
    expect(text('EX-LEND-UC01')).toContain('`EX-LEND-UC02` in a code span');
    expect(text('EX-LEND-UC01')).toContain('```\nEX-LEND-UC94\n```');
  });

  it('LA-AUT-T37 Only link tables link records: a link to a record that does not exist is refused, while text naming it is not', async () => {
    const base = { product: [{ id: 'MX', title: 'Mentions' }], domain: [{ id: 'MX-D', title: 'Domain', product_id: 'MX', subdomain_type: 'core', description: 'It reads MX-D-SP99.' }] };
    expect(await refusals(base)).toEqual([]);
    const command = { aggregate: [{ id: 'MX-D-A1', title: 'Loan', domain_id: 'MX-D' }], command: [{ id: 'MX-D-CMD01', title: 'Open', aggregate_id: 'MX-D-A1' }] };
    expect(await refusals({ ...base, ...command, checks: [{ source_id: 'MX-D-CMD01', target_id: 'MX-D-SP99' }] })).toEqual([expect.objectContaining({ rule: 'foreign-key', table: 'checks' })]);
  });

  it('LA-CHK-T52 A link from a record of one product to a record of another is refused, whatever the relation', async () => {
    const both = adding(complete(), {
      product: [{ id: 'NX', title: 'Next product' }],
      view: [{ id: 'NX-V01', title: 'Elsewhere' }],
      happens_in: [],
    });
    both.happens_in = [...both.happens_in.filter((l) => l.source_id !== 'EX-LEND-UC02-FL-S01'), { source_id: 'EX-LEND-UC02-FL-S01', target_id: 'NX-V01' }];
    expect(await refusals(both)).toEqual([
      expect.objectContaining({ rule: 'link-crosses-product', table: 'happens_in', message: expect.stringContaining('EX-LEND-UC02-FL-S01 is in product EX') }),
    ]);
  });
});
