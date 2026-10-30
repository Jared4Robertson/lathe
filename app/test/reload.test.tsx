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
      'GET /api/product/list-products?',
      'GET /api/meta-model/get-meta-model?',
      'GET /api/record-summaries/list-record-summaries?product_id=DM',
      'GET /api/folder-tree/get-folder-tree?product_id=DM',
      'GET /api/problems/list-problems?product_id=DM',
      'GET /api/coverage/get-coverage?product_id=DM',
    ]));
    // The address and page stay the same; no manual refresh.
    expect(window.location.pathname).toBe('/DM-SHOP-CMD01-H');
  });
});
