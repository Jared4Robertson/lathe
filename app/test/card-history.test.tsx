import './graph/setup';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { changeSummary } from '../src/views/history';
import { openApp } from './helpers';
import { testWorkspace } from './graph/workspace';

// A record's History, at the end of its whole page in the wiki card (LA-V102-R05).

const card = () => within(screen.getByRole('region', { name: 'Wiki card' }));
const history = () => within(document.querySelector<HTMLElement>('.wiki-panel .record-history')!);

/** Answers GET /api/history with `answer` (by the query asked), on top of the specs the page loads. */
function serveHistory(answer: (query: URLSearchParams) => unknown) {
  const base = globalThis.fetch;
  const asked: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith('/api/history')) return base(input, init);
    asked.push(url);
    const query = new URL(url, 'http://lathe.local').searchParams;
    return new Response(JSON.stringify(answer(query)), { status: 200, headers: { 'content-type': 'application/json' } });
  }));
  return asked;
}

/** The wiki card open on the whole page, for the session. */
const expanded = () => window.sessionStorage.setItem('lathe:place', JSON.stringify({ depth: 1, hiddenKinds: [], card: { open: true, expanded: true } }));

describe('a record\'s History in the wiki card', () => {
  it('LA-V102-R05-T01 History in the wiki card lists the commits that touched the record\'s rows, the uncommitted change first, shows a commit\'s diff inline, loads more, and says calmly when there is no git', async () => {
    const statement = { table: 'use_case', key: 'P-D-UC01', change: 'changed' as const, fields: [{ name: 'goal', before: 'Lend it.', after: 'Lend a thing to a member.' }] };
    const actor = { table: 'use_case_actor', key: 'use_case_id P-D-UC01, position 1', change: 'added' as const, fields: [{ name: 'role_name', after: 'Member' }] };
    const commit = (n: number) => ({ hash: `${String(n).padStart(4, '0')}${'a'.repeat(36)}`, short: `${String(n).padStart(4, '0')}aaa`, date: '2026-10-24T10:00:00Z', author: 'Owner', subject: `Change ${n}`, changes: n === 1 ? [statement, actor] : [statement], truncated: false });
    expanded();
    await openApp('/P-D-UC01', { data: testWorkspace() });
    const asked = serveHistory((q) => {
      const skip = Number(q.get('skip') ?? 0);
      return {
        state: 'ok', id: q.get('id'), files: ['data/use_case.jsonl', 'data/use_case_actor.jsonl'],
        uncommitted: skip ? [] : [{ table: 'use_case', key: 'P-D-UC01', change: 'changed', fields: [{ name: 'title', before: 'Lend', after: 'Lend a thing' }] }],
        commits: skip ? [commit(21)] : Array.from({ length: 20 }, (_, i) => commit(i + 1)), more: !skip };
    });
    // Nothing is read until the Reader asks.
    const show = await card().findByRole('button', { name: 'Show the history' });
    expect(asked).toEqual([]);
    fireEvent.click(show);
    const list = await history().findByRole('list', { name: 'Commits that changed P-D-UC01' });
    expect(history().getByText('data/use_case.jsonl')).toBeInTheDocument();
    const rows = within(list).getAllByRole('button');
    expect(rows[0]).toHaveTextContent('Not committed');
    expect(rows[0]).toHaveTextContent('title changed');
    expect(rows[1]).toHaveTextContent(/Change 1.*Owner.*0001aaa/);
    // Each commit says what it changed: the record's fields, and its parts by table.
    expect(rows[1]).toHaveTextContent('goal changed · use case actor: added');
    expect(rows).toHaveLength(21);
    expect(asked[0]).toBe('/api/history?id=P-D-UC01');
    expect(changeSummary(statement)).toBe('goal changed');

    // The uncommitted change's fields, inline, before and after.
    fireEvent.click(rows[0]);
    expect(rows[0]).toHaveAttribute('aria-expanded', 'true');
    const working = await history().findByRole('region', { name: 'Uncommitted changes' });
    expect(working.querySelector('.history-before')).toHaveTextContent('Lend');
    expect(working.querySelector('.history-after')).toHaveTextContent('Lend a thing');
    // One open at a time.
    fireEvent.click(rows[1]);
    const first = await history().findByRole('region', { name: 'Changes in 0001aaa' });
    expect(within(first).getByRole('heading', { name: /The record/ })).toBeInTheDocument();
    expect(within(first).getByRole('heading', { name: /use case actor \(use_case_id P-D-UC01, position 1\)/ })).toBeInTheDocument();
    expect(history().queryByRole('region', { name: 'Uncommitted changes' })).toBeNull();
    expect(asked.every((u) => !u.includes('commit='))).toBe(true);

    fireEvent.click(history().getByRole('button', { name: 'Load more' }));
    await waitFor(() => expect(within(list).getAllByRole('button')).toHaveLength(22));
    expect(history().queryByRole('button', { name: 'Load more' })).toBeNull();

    // No git: said calmly. A new page starts with the button again.
    await openApp('/P-D-UC01', { data: testWorkspace() });
    serveHistory((q) => ({ state: 'no-repo', id: q.get('id'), files: ['data/use_case.jsonl'], message: 'The product folder is not a git repository, so its records have no history yet.' }));
    fireEvent.click(await card().findByRole('button', { name: 'Show the history' }));
    expect(await history().findByText(/not a git repository/)).toBeInTheDocument();
  });
});
