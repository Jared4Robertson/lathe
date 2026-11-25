// The Generated component aggregate's commands and queries (LA-MOD-A25) on the store fixture, whose lending domain ships a generated component, TL-LEND-GC01,
// serving TL-BO01 and making one guarantee for its consumers: its reads (a generated component whole, a domain's generated components, the next free
// ID), and its commands, each changing one generated component through its own repository, a removal refused while a guarantee it
// makes is left.
import { afterAll, describe, expect, it } from 'vitest';
import { openStore } from '../../../src/index.ts';
import { GET_GENERATED_COMPONENT, LIST_GENERATED_COMPONENTS, NEXT_GENERATED_COMPONENT_ID } from '../../../src/domain-modeling/generated-component/queries.ts';
import { runQuery } from '../../../src/platform/commands/run.ts';
import { refusedBy, run } from '../../helpers.ts';
import { everyKind, removeData, writeData } from '../../store/fixture.ts';

afterAll(removeData);

describe('the Generated component aggregate', () => {
  it("LA-MOD-UC179-R02-T01 a domain's generated components are listed, one is read whole with the guarantees it makes, and the next free ID is given", async () => {
    const store = await openStore(writeData(everyKind()));
    expect(runQuery(store, LIST_GENERATED_COMPONENTS, { domain_id: 'TL-LEND' })).toEqual([{ id: 'TL-LEND-GC01', title: 'Loan adapter' }]);
    expect(runQuery(store, LIST_GENERATED_COMPONENTS, { domain_id: 'TL-PLAT' })).toEqual([]);
    const page = runQuery(store, GET_GENERATED_COMPONENT, { id: 'TL-LEND-GC01' }) as { serves: string[]; guarantees: { id: string }[] };
    expect(page.serves).toEqual(['TL-BO01']);
    expect(page.guarantees.map((g) => g.id)).toEqual(['TL-LEND-GC01-GU01']);
    expect(runQuery(store, NEXT_GENERATED_COMPONENT_ID, { domain_id: 'TL-LEND' })).toBe('TL-LEND-GC02');
    expect(() => runQuery(store, GET_GENERATED_COMPONENT, { id: 'TL-LEND' })).toThrow('TL-LEND is a domain, not a generated component');
    expect(() => runQuery(store, NEXT_GENERATED_COMPONENT_ID, { domain_id: 'TL-LEND-A1' })).toThrow('a generated component sits under a domain, and TL-LEND-A1 is not one');
    await store.close();
  });

  it('LA-MOD-UC179-R01-T02 LA-MOD-UC180-R01-T02 LA-MOD-UC181-R01-T02 adds, changes and removes a generated component through its own commands, refused while a guarantee it makes is left', async () => {
    const store = await openStore(writeData(everyKind()));
    await run(store, 'generated-component add-generated-component', { id: 'TL-LEND-GC02', title: 'Second', domain_id: 'TL-LEND', description: 'Another unit shipped.', serves: ['TL-BO01'] });
    await run(store, 'generated-component change-generated-component', { id: 'TL-LEND-GC02', description: 'Another unit shipped, changed.', serves: [] });
    expect(store.rows('generated_component').find((r) => r.id === 'TL-LEND-GC02')).toMatchObject({ description: 'Another unit shipped, changed.' });
    expect(store.rows('serves').filter((s) => s.source_id === 'TL-LEND-GC02')).toEqual([]);
    await run(store, 'guarantee add-guarantee', { id: 'TL-LEND-GC02-GU01', title: 'Kept', generated_component_id: 'TL-LEND-GC02', statement: 'It MUST keep what it holds.', consumers: 'Every branch service.', kept_by: ['TL-LEND-TOOL01'] });
    const refused = await refusedBy(store, 'generated-component remove-generated-component', { id: 'TL-LEND-GC02' });
    expect(refused.map((p) => p.message).join(' ')).toContain('TL-LEND-GC02-GU01');
    await run(store, 'guarantee remove-guarantee', { id: 'TL-LEND-GC02-GU01' });
    await run(store, 'generated-component remove-generated-component', { id: 'TL-LEND-GC02' });
    expect(store.rows('generated_component').map((r) => r.id)).toEqual(['TL-LEND-GC01']);
    await store.close();
  });

});
