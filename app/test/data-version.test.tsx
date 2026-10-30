import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DataChange } from '../../lathe/src/server/events';
import { useDataVersion } from '../src/exploring/record-summaries/reads';
import { readModelChanges } from '../src/record/read';

// The data's version after a write (LA-PLT-UC03-R02, LA-V61-R54): the server announces a write's change, naming the read models it
// touched, before it answers the write, so the page waits for that change and reads again only those read models.

const listeners = vi.hoisted(() => new Set<(change: DataChange | null) => void>());
vi.mock('../src/events', () => ({
  onLatheEvent: (_event: string, callback: (change: DataChange | null) => void) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
  } }));

const hear = (change: DataChange | null) => act(() => { for (const callback of listeners) callback(change); });
const useCaseRead = '/api/use-case/get-use-case';
const metaRead = '/api/meta-model/get-meta-model';

describe('LA-V61-R54-T02 after a write, the page reads again only the read models the write touched', () => {
  it('waits for the server\'s change for the write, heard before or after its answer', async () => {
    listeners.clear();
    const { result } = renderHook(() => useDataVersion());
    await hear({ tables: [], readModels: [] }); // The channel greets the page.
    const [useCase, meta] = [readModelChanges(useCaseRead), readModelChanges(metaRead)];

    // The change comes after the write's answer: the reload waits for it.
    let mark = result.current.mark();
    let done = false;
    let reloading!: Promise<void>;
    act(() => { reloading = result.current.reload({ mark, tables: ['use_case'] }).then(() => { done = true; }); });
    await hear({ tables: ['use_case'], readModels: ['use-case'] });
    expect(result.current.version).toBe(1);
    act(() => result.current.answered(1));
    await reloading;
    expect(done).toBe(true);
    expect(readModelChanges(useCaseRead)).not.toBe(useCase);
    expect(readModelChanges(metaRead)).toBe(meta);

    // The change came first (the server sends it before it answers): the reload finds it and moves nothing again.
    mark = result.current.mark();
    await hear({ tables: ['flow'], readModels: ['use-case'] });
    act(() => result.current.answered(2));
    await act(() => result.current.reload({ mark, tables: ['flow'] }));
    expect(result.current.version).toBe(2);
    expect(readModelChanges(metaRead)).toBe(meta);
  });

  it('reads everything again when no channel is open, or the change does not come', async () => {
    listeners.clear();
    const { result } = renderHook(() => useDataVersion());
    const meta = readModelChanges(metaRead);
    let reloading!: Promise<void>;
    act(() => { reloading = result.current.reload({ mark: 0, tables: ['use_case'] }); });
    expect(result.current.version).toBe(1);
    expect(readModelChanges(metaRead)).not.toBe(meta);
    act(() => result.current.answered(1));
    await reloading;

    await hear({ tables: [], readModels: [] });
    const later = readModelChanges(metaRead);
    act(() => { reloading = result.current.reload({ mark: result.current.mark(), tables: ['use_case'] }); });
    await act(() => new Promise((resolve) => setTimeout(resolve, 400)));
    expect(result.current.version).toBe(2);
    expect(readModelChanges(metaRead)).not.toBe(later);
    act(() => result.current.answered(2));
    await reloading;
  });
});
