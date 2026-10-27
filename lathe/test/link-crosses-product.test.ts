// Each product is a space of its own (brief 82): a link stays inside its product, whatever the relation, and the
// store refuses one that leaves it. An ID named in a record's text is plain text, not a link.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Workspace } from '../src/index.ts';
import { fixture, load, refusals, removeData, type Data } from './helpers.ts';

let ws: Workspace;
beforeAll(async () => {
  // cross-product: Alpha (AA) and Beta (BB). AA-ONE-UC01 and AA-ONE-DR01 name Beta's records in their text only.
  ws = await load('cross-product');
});
afterAll(removeData);

/** The cross-product fixture's rows, read from its data files. */
function crossProduct(): Data {
  const dir = path.join(fixture('cross-product'), 'data');
  return Object.fromEntries(readdirSync(dir).map((f) => [f.replace(/\.jsonl$/, ''), readFileSync(path.join(dir, f), 'utf8').trim().split('\n').map((l) => JSON.parse(l))]));
}

describe('a link stays inside its product', () => {
  it('LA-CHK-T52 A link from a record of one product to a record of another is refused, whatever the relation; an ID in text is not a link', async () => {
    const data = crossProduct();
    const involves = await refusals({ ...data, involves: [...(data.involves ?? []), { source_id: 'AA-ONE-DR01', target_id: 'BB-TWO-A1' }] });
    expect(involves).toEqual([
      expect.objectContaining({
        rule: 'link-crosses-product', table: 'involves',
        message: 'AA-ONE-DR01 is in product AA, so it cannot involves BB-TWO-A1, which is in product BB',
      }),
    ]);
    const rule = { id: 'BB-TWO-DR01', title: 'A loan has a tool', domain_id: 'BB-TWO', statement: 'A loan MUST name a tool.' };
    const applies = await refusals({ ...data, domain_rule: [...data.domain_rule, rule], applies: [...(data.applies ?? []), { source_id: 'AA-ONE-UC01', target_id: 'BB-TWO-DR01' }] });
    expect(applies).toEqual([expect.objectContaining({ rule: 'link-crosses-product', table: 'applies' })]);
    // The fixture's own links stay inside their products, and an ID of another product in text is no link and no problem.
    expect(ws.problems.filter((p) => p.severity === 'error')).toEqual([]);
    expect(ws.records.find((r) => r.id === 'AA-ONE-UC01')?.fields.goal).toContain('BB-TWO-UC01');
    expect(ws.links.some((l) => l.target.startsWith('BB') && l.source.startsWith('AA'))).toBe(false);
    expect(ws.problems.some((p) => p.record?.startsWith('AA') && p.message.includes('BB-TWO'))).toBe(false);
  });
});
