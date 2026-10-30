import { act, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { setRow } from './fixtures/load';
import { workspace } from './fixtures/workspace';
import { openApp, serve } from './helpers';

// Capture the app's subscriptions to server events, so the test can send one.
const listeners = vi.hoisted(() => new Map<string, Set<() => void>>());
vi.mock('../src/events', () => ({
  onLatheEvent: (event: string, callback: () => void) => {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)!.add(callback);
    return () => listeners.get(event)!.delete(callback);
  } }));

describe('reload on change', () => {
  it('LA-V61-R01-T01 An open spec page reloads the data when the server reports spec:changed', async () => {
    const { requests } = await openApp('/DM-SHOP-CMD01-H');
    await screen.findByRole('heading', { level: 1, name: 'addToBasket' });
    expect(requests.some((r) => r.startsWith('GET /api/record-summaries/list-record-summaries?'))).toBe(true);

    // An agent renames the command handler in its data file; the server sends spec:changed.
    const changed = setRow(workspace(), 'command_handler', 'DM-SHOP-CMD01-H', { title: 'Basket store' });
    const after = serve({ data: changed });
    await act(async () => { for (const callback of listeners.get('spec:changed') ?? []) callback(); });

    expect(await screen.findByRole('heading', { level: 1, name: 'Basket store' })).toBeInTheDocument();
    // The space's reads again (its records, folder tree, problems and coverage, and the meta model), the products the nav
    // lists, and the command's page its command through the aggregate's own query; never one dump of every table.
    expect(after.requests).toEqual(expect.arrayContaining([
      'GET /api/command/get-command?id=DM-SHOP-CMD01-H',
      'GET /api/product/list-products',
      'GET /api/meta-model/get-meta-model',
      'GET /api/record-summaries/list-record-summaries?product_id=DM',
      'GET /api/folder-tree/get-folder-tree?product_id=DM',
      'GET /api/problems/list-problems?product_id=DM',
      'GET /api/coverage/get-coverage?product_id=DM',
    ]));
    // The address and page stay the same; no manual refresh.
    expect(window.location.pathname).toBe('/DM-SHOP-CMD01-H');
  });

  it('LA-V61-R01-T02 A reload the server refuses keeps the page on screen and says the specs could not be reloaded', async () => {
    await openApp('/DM-SHOP-CMD01-H');
    await screen.findByRole('heading', { level: 1, name: 'addToBasket' });
    // The files are caught mid-write: the space's reads are refused until the next change.
    const served = serve();
    const answer = globalThis.fetch;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url;
      if (url.startsWith('/api/record-summaries/') || url.startsWith('/api/folder-tree/')) {
        return new Response(JSON.stringify({ error: 'data/command.jsonl: line 3 is not a row.' }), { status: 422, headers: { 'content-type': 'application/json' } });
      }
      return answer(input, init);
    }));
    await act(async () => { for (const callback of listeners.get('spec:changed') ?? []) callback(); });

    expect(await screen.findByText(/Couldn't reload the specs: data\/command.jsonl: line 3 is not a row\./)).toBeInTheDocument();
    // The page, its wiki card and its nav stay as they were.
    expect(screen.getByRole('heading', { level: 1, name: 'addToBasket' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Wiki card' })).toBeInTheDocument();
    expect(served.requests.length).toBeGreaterThan(0);
  });
});
