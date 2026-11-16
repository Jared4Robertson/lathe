// The Library aggregate's commands and queries (LA-MOD-A26) on the store fixture, whose lending domain ships a library, TL-LEND-LB01,
// serving TL-BO01 and making one guarantee for its consumers: its reads (a library whole, a domain's libraries, the next free
// ID), and its commands, each changing one library through its own repository, a removal refused while a guarantee it
// makes is left.
import { afterAll, describe, expect, it } from 'vitest';
import { openStore } from '../../../src/index.ts';
import { GET_LIBRARY, LIST_LIBRARIES, NEXT_LIBRARY_ID } from '../../../src/domain-modeling/library/queries.ts';
import { runQuery } from '../../../src/platform/commands/run.ts';
import { refusedBy, run } from '../../helpers.ts';
import { everyKind, removeData, writeData } from '../../store/fixture.ts';

afterAll(removeData);

describe('the Library aggregate', () => {
  it("LA-MOD-UC182-R02-T01 a domain's libraries are listed, one is read whole with the guarantees it makes, and the next free ID is given", async () => {
    const store = await openStore(writeData(everyKind()));
    expect(runQuery(store, LIST_LIBRARIES, { domain_id: 'TL-LEND' })).toEqual([{ id: 'TL-LEND-LB01', title: 'Reminder runtime' }]);
    expect(runQuery(store, LIST_LIBRARIES, { domain_id: 'TL-PLAT' })).toEqual([]);
    const page = runQuery(store, GET_LIBRARY, { id: 'TL-LEND-LB01' }) as { serves: string[]; guarantees: { id: string }[] };
    expect(page.serves).toEqual([]);
    expect(page.guarantees.map((g) => g.id)).toEqual(['TL-LEND-LB01-GU01']);
    expect(runQuery(store, NEXT_LIBRARY_ID, { domain_id: 'TL-LEND' })).toBe('TL-LEND-LB02');
    expect(() => runQuery(store, GET_LIBRARY, { id: 'TL-LEND' })).toThrow('TL-LEND is a domain, not a library');
    expect(() => runQuery(store, NEXT_LIBRARY_ID, { domain_id: 'TL-LEND-A1' })).toThrow('a library sits under a domain, and TL-LEND-A1 is not one');
    await store.close();
  });

  it('LA-MOD-UC182-R01-T02 LA-MOD-UC183-R01-T02 LA-MOD-UC184-R01-T02 adds, changes and removes a library through its own commands, refused while a guarantee it makes is left', async () => {
    const store = await openStore(writeData(everyKind()));
    await run(store, 'library add-library', { id: 'TL-LEND-LB02', title: 'Second', domain_id: 'TL-LEND', description: 'Another unit shipped.', serves: ['TL-BO01'] });
    await run(store, 'library change-library', { id: 'TL-LEND-LB02', description: 'Another unit shipped, changed.', serves: [] });
    expect(store.rows('library').find((r) => r.id === 'TL-LEND-LB02')).toMatchObject({ description: 'Another unit shipped, changed.' });
    expect(store.rows('serves').filter((s) => s.source_id === 'TL-LEND-LB02')).toEqual([]);
    await run(store, 'guarantee add-guarantee', { id: 'TL-LEND-LB02-GU01', title: 'Kept', library_id: 'TL-LEND-LB02', statement: 'It MUST keep what it holds.', consumers: 'Every branch service.', kept_by: ['TL-LEND-TOOL01'] });
    const refused = await refusedBy(store, 'library remove-library', { id: 'TL-LEND-LB02' });
    expect(refused.map((p) => p.message).join(' ')).toContain('TL-LEND-LB02-GU01');
    await run(store, 'guarantee remove-guarantee', { id: 'TL-LEND-LB02-GU01' });
    await run(store, 'library remove-library', { id: 'TL-LEND-LB02' });
    expect(store.rows('library').map((r) => r.id)).toEqual(['TL-LEND-LB01']);
    await store.close();
  });

});
