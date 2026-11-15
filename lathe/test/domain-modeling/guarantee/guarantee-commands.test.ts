// The Guarantee aggregate's commands and queries (LA-MOD-A24) on the store fixture's platform domain, TL-PLAT, which
// makes one guarantee kept by a building block and proved by a test: its rule (a guarantee sits in a platform domain),
// and its reads (a guarantee whole, a domain's guarantees, the next free IDs).
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { openStore } from '../../../src/index.ts';
import { GET_GUARANTEE, LIST_GUARANTEES, NEXT_GUARANTEE_ID } from '../../../src/domain-modeling/guarantee/queries.ts';
import { runQuery } from '../../../src/platform/commands/run.ts';
import { refusedBy, run } from '../../helpers.ts';
import { everyKind, removeData, writeData } from '../../store/fixture.ts';

afterAll(removeData);

/** Every data file of the product, by name, as text. */
const files = (root: string) => Object.fromEntries(readdirSync(path.join(root, 'data')).map((f) => [f, readFileSync(path.join(root, 'data', f), 'utf8')]));

describe('the Guarantee aggregate', () => {
  it('LA-MOD-INV187-T a guarantee in a business domain is refused, and so is unmarking a platform domain that makes one', async () => {
    const root = writeData(everyKind());
    const store = await openStore(root);
    const before = files(root);
    const added = await refusedBy(store, 'guarantee add-guarantee', { id: 'TL-LEND-GU01', title: 'Loans are kept', domain_id: 'TL-LEND', statement: 'Every loan MUST be kept.' });
    expect(added).toEqual([expect.objectContaining({
      rule: 'guarantee-in-platform-domain',
      message: 'TL-LEND is not marked platform, so it makes no guarantee and TL-LEND-GU01 cannot sit in it: a guarantee sits in a platform domain, and a business domain is described by its use cases and aggregates',
    })]);
    const unmarked = await refusedBy(store, 'domain change-domain', { id: 'TL-PLAT', platform: null });
    expect(unmarked).toEqual([expect.objectContaining({ rule: 'guarantee-in-platform-domain' })]);
    expect(unmarked[0].message).toContain('TL-PLAT is not marked platform');
    expect(files(root)).toEqual(before);
    await store.close();
  });

  it("LA-MOD-UC173-R02-T01 a domain's guarantees are listed, one is read whole with its tests and building blocks, and the next free IDs are given", async () => {
    const store = await openStore(writeData(everyKind()));
    await run(store, 'guarantee add-guarantee-test', {
      id: 'TL-PLAT-GU01-T02', title: 'A change that fails saves nothing on restart', guarantee_id: 'TL-PLAT-GU01', level: 'system', state: 'not automated yet',
      when: 'Stops the program half way through a change.', then: 'Expects the data as it was before the change.', starts_from: ['TL-LEND-TD01'],
    });
    expect(runQuery(store, LIST_GUARANTEES, { domain_id: 'TL-PLAT' })).toEqual([{ id: 'TL-PLAT-GU01', title: 'Every change is saved whole' }]);
    expect(runQuery(store, LIST_GUARANTEES, { domain_id: 'TL-LEND' })).toEqual([]);
    const page = runQuery(store, GET_GUARANTEE, { id: 'TL-PLAT-GU01-T02' }) as { record: unknown; keptBy: string[]; tests: { test: { id: string }; startsFrom: string[] }[] };
    expect(page.record).toEqual({ id: 'TL-PLAT-GU01-T02', kind: 'guarantee_test' });
    expect(page.keptBy).toEqual(['TL-LEND-ENTRY01']);
    expect(page.tests.map((t) => [t.test.id, t.startsFrom])).toEqual([['TL-PLAT-GU01-T01', []], ['TL-PLAT-GU01-T02', ['TL-LEND-TD01']]]);
    expect(runQuery(store, NEXT_GUARANTEE_ID, { kind: 'guarantee', parent: 'TL-PLAT' })).toBe('TL-PLAT-GU02');
    expect(runQuery(store, NEXT_GUARANTEE_ID, { kind: 'guarantee_test', parent: 'TL-PLAT-GU01' })).toBe('TL-PLAT-GU01-T03');
    expect(() => runQuery(store, NEXT_GUARANTEE_ID, { kind: 'guarantee_test', parent: 'TL-PLAT' })).toThrow('a guarantee_test sits under a guarantee, and TL-PLAT is a domain');
    expect(() => runQuery(store, GET_GUARANTEE, { id: 'TL-LEND' })).toThrow('TL-LEND is a domain, not a guarantee or a record in one');
    await store.close();
  });

  it('changes and removes a guarantee and its tests through its own commands only', async () => {
    const store = await openStore(writeData(everyKind()));
    await run(store, 'guarantee change-guarantee', { id: 'TL-PLAT-GU01', title: 'Every change is kept whole', kept_by: ['TL-LEND-ENTRY01', 'TL-LEND-TOOL01'] });
    expect(store.rows('kept_by')).toEqual([{ source_id: 'TL-PLAT-GU01', target_id: 'TL-LEND-ENTRY01' }, { source_id: 'TL-PLAT-GU01', target_id: 'TL-LEND-TOOL01' }]);
    await run(store, 'guarantee change-guarantee-test', { id: 'TL-PLAT-GU01-T01', state: 'not automated yet', file: null });
    expect(store.rows('guarantee_test')[0]).toMatchObject({ state: 'not automated yet' });
    await run(store, 'guarantee remove-guarantee-test', { id: 'TL-PLAT-GU01-T01' });
    expect(store.rows('guarantee_test')).toEqual([]);
    await run(store, 'guarantee remove-guarantee', { id: 'TL-PLAT-GU01' });
    expect([store.rows('guarantee'), store.rows('kept_by')]).toEqual([[], []]);
    await store.close();
  });
});
