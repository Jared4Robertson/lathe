// The Serves reads (LA-TRC-RM12, LA-TRC-QRY16, LA-TRC-QRY17): the business outcomes a record serves, and a product's
// records by the outcomes they serve, worked out from the rows on every read through the read model's reader.
import { afterEach, describe, expect, it } from 'vitest';
import { GET_SERVES, LIST_SERVES } from '../../../src/traceability/serves/queries.ts';
import { runQuery } from '../../../src/platform/commands/run.ts';
import type { ReadView } from '../../../src/platform/data/rules.ts';
import { openStore, type Store } from '../../../src/platform/data/store.ts';
import { StoreError } from '../../../src/platform/data/problems.ts';
import { complete, withJourney, without, writeData, type Data } from '../../helpers.ts';
import type { ProductServes, RecordServes } from '../../../src/traceability/serves/read-model.ts';

const open: Store[] = [];
afterEach(async () => { for (const s of open.splice(0)) await s.close(); });

async function view(data: Data): Promise<ReadView> {
  const store = await openStore(writeData(data));
  open.push(store);
  return { schema: store.schema, rows: (t) => store.rows(t), record: (id) => store.record(id) };
}

describe('LA-TRC-UC20-R01-T01 get-serves names the outcomes a record serves and the use cases and journeys it serves them through, from the rows alone', () => {
  it('answers an aggregate, a storage requirement, a view requirement and a record none reaches, and refuses an unknown record', async () => {
    const data = await view(complete());
    expect(runQuery(data, GET_SERVES, { id: 'EX-LEND-A1' })).toEqual({ id: 'EX-LEND-A1', outcomes: ['EX-BO01'], useCases: ['EX-LEND-UC01'], journeys: [] });
    expect(runQuery(data, GET_SERVES, { id: 'EX-LEND-A1-SR01' })).toEqual({ id: 'EX-LEND-A1-SR01', outcomes: ['EX-BO01'], useCases: ['EX-LEND-UC01'], journeys: [] });
    expect(runQuery(data, GET_SERVES, { id: 'EX-V01-R01' })).toEqual({ id: 'EX-V01-R01', outcomes: ['EX-BO01'], useCases: ['EX-LEND-UC01', 'EX-LEND-UC02'], journeys: [] });
    expect(runQuery(data, GET_SERVES, { id: 'EX-LEND' })).toEqual({ id: 'EX-LEND', outcomes: [], useCases: [], journeys: [] });
    expect(() => runQuery(data, GET_SERVES, { id: 'EX-NONE' })).toThrow(StoreError);
    expect(GET_SERVES.text(runQuery(data, GET_SERVES, { id: 'EX-LEND-A1' }) as RecordServes)).toBe('EX-LEND-A1 serves EX-BO01 through EX-LEND-UC01');
  });

  it('names the journeys a record serves through, as the Serves line says via', async () => {
    const data = await view(withJourney());
    const policy = runQuery(data, GET_SERVES, { id: 'EX-LEND-PO01' }) as RecordServes;
    expect(policy).toEqual({ id: 'EX-LEND-PO01', outcomes: ['EX-BO01', 'EX-BO02'], useCases: ['EX-LEND-UC01'], journeys: ['EX-JR01'] });
    expect(GET_SERVES.text(policy)).toBe('EX-LEND-PO01 serves EX-BO01, EX-BO02 through EX-LEND-UC01 via EX-JR01');
  });
});

describe('LA-TRC-UC20-R02-T03 list-serves lists a product\'s records by the outcomes they serve, and the aggregates, read models and obligations none reaches', () => {
  it('lists every reached record of the space, and none unserved when every one is reached', async () => {
    const all = runQuery(await view(complete()), LIST_SERVES, { product_id: 'EX' }) as ProductServes;
    expect(all.unserved).toEqual([]);
    expect(all.served.find((s) => s.id === 'EX-LEND-RM01')).toEqual({ id: 'EX-LEND-RM01', outcomes: ['EX-BO01'], useCases: ['EX-LEND-UC01'], journeys: [] });
    expect(all.served.some((s) => s.id === 'EX-BO01')).toBe(false);
  });

  it('lists a read model no step reaches as serving none, and refuses an unknown product', async () => {
    const data = await view(without(complete(), 'invokes', (r) => r.target_id === 'EX-LEND-QRY01'));
    expect((runQuery(data, LIST_SERVES, { product_id: 'EX' }) as ProductServes).unserved).toEqual(['EX-LEND-RM01']);
    expect(() => runQuery(data, LIST_SERVES, { product_id: 'NOPE' })).toThrow(StoreError);
  });
});
