// The record-keeping flows of traceability: the Owner or an Agent ends a pattern following, a slot fill or a provider
// through each aggregate's own command, each walked through the real `lathe` command on a temporary product (LA-IF03)
// that starts as the tool library example's records.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { link, product, removeProducts, type Product } from '../product.ts';
import { copyExample } from './example.ts';

afterAll(removeProducts);

/** Whether a data file of the product holds the text. */
const has = (tl: Product, table: string, text: string) => existsSync(path.join(tl.root, 'data', `${table}.jsonl`)) && tl.read(`data/${table}.jsonl`).includes(text);

describe('Record-keeping flows of traceability', () => {
  it('LA-TRC-UC101-FL-T LA-TRC-UC101-R01-T01 LA-TRC-UC101-R02-T01 stop following a pattern', () => {
    const tl = product();
    copyExample(tl);
    const follow = { follower_id: 'TL-LEND-UC01', pattern_id: 'TL-PAT-LIBRARIAN-ACTION' };
    expect(has(tl, 'follows', '"source_id":"TL-LEND-UC01","target_id":"TL-PAT-LIBRARIAN-ACTION"')).toBe(true);
    tl.command('pattern-following stop-following-pattern', follow);
    expect(has(tl, 'follows', '"source_id":"TL-LEND-UC01"')).toBe(false);
    expect(has(tl, 'setting_value', '"follower_id":"TL-LEND-UC01"')).toBe(false);
    // It follows no longer, so a second stop is refused.
    tl.refuse('pattern-following stop-following-pattern', follow);
  });

  it('LA-TRC-UC102-FL-T LA-TRC-UC102-R01-T01 LA-TRC-UC102-R02-T01 stop filling a slot', () => {
    const tl = product();
    copyExample(tl);
    const fill = { record_id: 'TL-LEND-CMD01-H', slot_id: 'TL-PAT-LIBRARIAN-ACTION-SL01' };
    tl.command('slot-filling stop-filling-slot', fill);
    expect(has(tl, 'fills', '"source_id":"TL-LEND-CMD01-H"')).toBe(false);
    expect(has(tl, 'fills', '"source_id":"TL-LEND-CMD02-H"')).toBe(true);
    tl.refuse('slot-filling stop-filling-slot', fill);
  });

  it('LA-TRC-UC103-FL-T LA-TRC-UC103-R01-T01 LA-TRC-UC103-R02-T01 remove a provider', async () => {
    const tl = product();
    copyExample(tl);
    await tl.seed([link('TL-LEND-STORE01', 'provided_by', 'TL-INT01')]);
    tl.command('provision remove-provider', { record_id: 'TL-LEND-STORE01' });
    expect(has(tl, 'provided_by', 'TL-LEND-STORE01')).toBe(false);
    // The record has none now, so a second removal is refused.
    tl.refuse('provision remove-provider', { record_id: 'TL-LEND-STORE01' });
  });
});
