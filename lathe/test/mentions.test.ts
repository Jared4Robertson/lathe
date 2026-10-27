// IDs named in a record's text. The engine no longer reads structure out of text: an ID in a goal, statement or
// notes field is plain text, kept as written, and only link tables link records. The mentions-prose fixture names
// IDs of its own product, of another product, of no record, and in code spans and fences.
import { beforeAll, describe, expect, it } from 'vitest';
import { ENGINE_CHECKS, type Workspace } from '../src/index.ts';
import { load, refusals } from './helpers.ts';

let ws: Workspace;
beforeAll(async () => {
  ws = await load('mentions-prose');
});
const record = (id: string) => ws.records.find((r) => r.id === id)!;
const text = (id: string) => Object.values(record(id).fields).filter((v): v is string => typeof v === 'string').join('\n');

describe('IDs in text', () => {
  it('LA-AUT-T33 An ID a record names in its text is kept as written, and makes no link', () => {
    expect(text('MX-D-UC01')).toContain('It follows MX-D-UC02, then\nMX-D-UC01-R01, then MX-D-UC02 again');
    expect(ws.links).toEqual([]);
    // A record carries its typed fields and parts, and no list of the IDs its text names.
    expect(Object.keys(record('MX-D-UC01')).sort()).toEqual(['domain', 'fields', 'id', 'kind', 'parent', 'parts', 'product', 'title']);
  });

  it("LA-AUT-T121 A record's text naming another product's record is plain text: products are separate spaces", () => {
    expect(text('MX-D-UC04')).toContain('NX-E-UC01');
    expect(ws.links.some((l) => l.source === 'MX-D-UC04')).toBe(false);
    expect(ws.problems.filter((p) => p.record === 'MX-D-UC04' && p.message.includes('NX-E-UC01'))).toEqual([]);
  });

  it('LA-CHK-T12 IDs in code spans and fenced code blocks are kept with the text as written', () => {
    const all = ws.records.map((r) => text(r.id)).join('\n');
    for (const id of ['MX-D-UC94', 'MX-D-UC95', 'MX-D-UC96', 'MX-D-UC97', 'MX-D-UC98']) expect(all).toContain(id);
    expect(ws.problems.filter((p) => p.message.includes('UC9'))).toEqual([]);
  });

  it('LA-AUT-T34 A token that is not an ID of this workspace is plain text and no problem', () => {
    expect(text('MX-D-UC01')).toContain('ZZ-D-UC01');
    expect(ws.problems.filter((p) => p.message.includes('ZZ-D-UC01') || p.message.includes('MXY-D-UC01'))).toEqual([]);
  });

  it('LA-AUT-T35 Text keeps every repeat as written, its own ID included', () => {
    expect(text('MX-D-UC01').match(/MX-D-UC02/g)!.length).toBeGreaterThanOrEqual(2);
    expect(text('MX-D-UC01')).toContain('MX-D-UC01 is this record');
  });

  it('LA-AUT-T36 An ID in text that no record has is no warning: no check reads text for IDs', () => {
    expect(text('MX-D-UC01')).toContain('MX-D-DR99');
    expect(ws.problems.filter((p) => p.message.includes('MX-D-DR99'))).toEqual([]);
    expect(ENGINE_CHECKS.map((c) => c.check)).toEqual(['data-refused']);
  });

  it('LA-AUT-T37 Only link tables link records: a link to a record that does not exist is refused, while text naming it is not', async () => {
    const data = {
      product: [{ id: 'MX', title: 'Mentions product' }],
      domain: [{ id: 'MX-D', title: 'Domain', product_id: 'MX' }],
      use_case: [{ id: 'MX-D-UC01', title: 'Cite', domain_id: 'MX-D', goal: 'It applies MX-D-DR99.' }],
    };
    expect(await refusals(data)).toEqual([]);
    expect(await refusals({ ...data, applies: [{ source_id: 'MX-D-UC01', target_id: 'MX-D-DR99' }] })).toEqual([expect.objectContaining({ rule: 'foreign-key', table: 'applies' })]);
  });
});
