import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useChanges } from '../src/changes/changes';
import { ChangesProvider } from '../src/changes/ChangesProvider';
import type { RecordIndex } from '../src/exploring/record-summaries/record-index';

const change = (id: string) => ({ id, kind: 'use_case', title: id, change: 'added', fields: [], parts: [], links: { added: [], removed: [] } });
const answer = (ids: string[]) => new Response(JSON.stringify({ product: 'EX', baseline: { state: 'ok', commit: 'abc', short: 'abc', subject: 'Base', date: '2026-11-09', base: null }, changes: ids.map(change) }));

function Count() {
  return <output>{useChanges().changes.length}</output>;
}

afterEach(() => vi.unstubAllGlobals());

describe('LA-V96-R28-T03 The Changes count', () => {
  it('reads the baseline again when the new data comes before the announcement of its change', async () => {
    let ids: string[] = [];
    const fetched = vi.fn(async () => answer(ids));
    vi.stubGlobal('fetch', fetched);
    const indexOf = (byId: RecordIndex['byId']) => ({ byId, product: 'EX' }) as unknown as RecordIndex;
    const tree = (index: RecordIndex) => <ChangesProvider index={index} product="EX"><Count /></ChangesProvider>;
    const { rerender } = render(tree(indexOf(new Map())));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('0'));

    // The new records have come; the announcement that would mark the read model changed has not.
    ids = ['EX-UC01', 'EX-UC02'];
    const records: RecordIndex['byId'] = new Map();
    await act(async () => rerender(tree(indexOf(records))));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('2'));

    // The same records in a new index (the checks' run came) read nothing again.
    const reads = fetched.mock.calls.length;
    await act(async () => rerender(tree(indexOf(records))));
    expect(fetched.mock.calls.length).toBe(reads);
  });
});
