// Coverage of storage: a storage requirement is an obligation of its aggregate's or read model's domain, built only
// through its aggregate's repository (or its read model's reader) once that names a file that exists and the data
// store it is kept in, and proved by its storage requirement tests; every repository, reader and table names its data
// store, and every data store keeps something. Each case starts from the complete product, where everything is covered.
import { afterAll, describe, expect, it } from 'vitest';
import { adding, complete, gaps, loadData, obligation, removeData, without } from '../helpers.ts';

afterAll(removeData);

describe('LA-MOD-UC31-R01-T01 a storage requirement sits under its aggregate or read model, built through what stores it and proved by its tests', () => {
  it('counts it in its domain, designed by construction, built by the repository that names its data store, and proved by its test', async () => {
    const ws = await loadData(complete());
    expect(obligation(ws, 'EX-LEND', 'storage_requirement')).toMatchObject({ total: 1, designed: 1, built: 1, proved: 1 });
  });

  it('is not built while its repository names no data store or no file that exists, and not proved without its test', async () => {
    const unstored = await loadData(without(complete(), 'stored_in', (l) => l.source_id === 'EX-LEND-REPO01'));
    expect(gaps(unstored)).toEqual(['built EX-LEND-A1-SR01', 'stored-nowhere EX-LEND-REPO01']);
    const unfiled = await loadData(complete(), { missing: ['src/store.ts'] });
    expect(gaps(unfiled)).toContain('built EX-LEND-A1-SR01');
    const untested = await loadData(without(complete(), 'storage_requirement_test', () => true));
    expect(gaps(untested)).toEqual(['proved EX-LEND-A1-SR01']);
  });

  it('is built through its read model\'s reader when it sits under a read model', async () => {
    const data = adding(complete(), { storage_requirement: [{ id: 'EX-LEND-RM01-SR01', title: 'Rebuilt on start', read_model_id: 'EX-LEND-RM01', statement: 'The free tools MAY be lost on a restart, and MUST be rebuilt from the loans.' }] });
    expect(gaps(await loadData(data))).toEqual(['proved EX-LEND-RM01-SR01']);
    expect(gaps(await loadData(without(data, 'stored_in', (l) => l.source_id === 'EX-LEND-RM01-RD')))).toEqual(['built EX-LEND-RM01-SR01', 'proved EX-LEND-RM01-SR01', 'stored-nowhere EX-LEND-RM01-RD']);
  });
});

describe('LA-TEC-UC32-R01-T01 every repository, reader and table names the one data store it is kept in, and a data store nothing uses is a gap', () => {
  it('reports a repository, reader or table that names no data store, and a data store that stores nothing', async () => {
    const data = adding(without(complete(), 'stored_in', (l) => ['EX-LEND-RM01-RD', 'EX-LEND-EN03-TB'].includes(String(l.source_id))), {
      data_store: [{ id: 'EX-LEND-STORE01', title: 'localStorage', domain_id: 'EX-LEND', kind: 'browser storage', description: 'The browser\'s local storage.' }],
    });
    expect(gaps(await loadData(data))).toEqual(['data-store-unused EX-LEND-STORE01', 'stored-nowhere EX-LEND-EN03-TB', 'stored-nowhere EX-LEND-RM01-RD']);
  });
});
