// The record-keeping flows of checking: the Owner or an Agent keeps a product's settings through the command, each
// walked through the real `lathe` command on a temporary product (LA-IF03).
import { afterAll, describe, expect, it } from 'vitest';
import { product, removeProducts } from '../product.ts';

afterAll(removeProducts);

describe('Record-keeping flows of checking', () => {
  it('LA-CHK-UC101-FL-T LA-CHK-UC101-R01-T01 LA-CHK-UC101-R02-T01 set the product\'s technology words', () => {
    const tl = product();
    // S01: the first time adds the product's settings with the default limits.
    tl.command('product-setting set-technology-words', { product_id: 'TL', technology_words: ['Postgres'] });
    expect(tl.read('data/product_setting.jsonl')).toMatch(/"max_children":15.*"technology_words":\["Postgres"\]/);
    // S01 again: the new list replaces the last, and the limits a product set stay.
    tl.command('product-setting set-limits', { product_id: 'TL', max_children: 9, max_entities_per_aggregate: 5 });
    tl.command('product-setting set-technology-words', { product_id: 'TL', technology_words: ['Redis', 'Kafka'] });
    // S02: the settings read as set.
    const settings = tl.read('data/product_setting.jsonl');
    expect(settings).toContain('"technology_words":["Kafka","Redis"]');
    expect(settings).toContain('"max_children":9');
    // S03: a product that does not exist is refused, and nothing changes.
    tl.refuse('product-setting set-technology-words', { product_id: 'XX', technology_words: ['Redis'] });
    expect(tl.read('data/product_setting.jsonl')).toBe(settings);
  });
});
