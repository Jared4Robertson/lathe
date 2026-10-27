// LA-PLT-T09: a reload after a write gives the same workspace as a fresh load, with each phase timed; the reference
// is kept until a data file or migration it reads changes (LA-PLT-DR02, LA-PLT-DR01).
import { afterAll, describe, expect, it } from 'vitest';
import { buildReference, loadWorkspace, openStore, type LoadTimings } from '../src/index.ts';
import { build, complete, removeData } from './helpers.ts';

afterAll(removeData);

describe('reloading', () => {
  it('LA-PLT-T09 A reload after a write gives the same workspace as a fresh load, with each phase timed', async () => {
    const root = await build(complete());
    const cold: Partial<LoadTimings> = {};
    const first = await loadWorkspace(root, { timings: cold });
    for (const phase of ['open', 'files', 'checks', 'coverage', 'total'] as const) expect(cold[phase]).toBeGreaterThanOrEqual(0);

    // Nothing changed: the workspace is the same.
    expect(await loadWorkspace(root)).toEqual(first);

    // One row changed through the store: the next load shows it, as a fresh load does.
    const store = await openStore(root);
    await store.set('use_case', 'EX-LEND-UC01', { title: 'Borrow a tool for a week' });
    await store.close();
    const reloaded = await loadWorkspace(root);
    expect(reloaded.records.find((r) => r.id === 'EX-LEND-UC01')?.title).toBe('Borrow a tool for a week');
    expect(await loadWorkspace(root)).toEqual(reloaded);
  });

  it('LA-PLT-T09 The reference is kept until a data file it reads changes', async () => {
    const root = await build(complete());
    const first = await buildReference(root);
    expect(await buildReference(root)).toBe(first);
    const store = await openStore(root);
    await store.add('product_kind', { name: 'memo', product_id: 'EX', label: 'Memo', description: 'A short note.', parent_kind: 'domain', obligation: false });
    await store.close();
    const next = await buildReference(root);
    expect(next).not.toBe(first);
    expect(next.kinds.map((k) => k.kind)).toContain('memo');
  });
});
