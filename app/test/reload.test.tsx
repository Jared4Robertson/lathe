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
  },
}));

describe('reload on change', () => {
  it('LA-V61-R01-T01 An open spec page reloads the data when the server reports spec:changed', async () => {
    const { requests } = await openApp('/DM-SHOP-CMD01-H');
    await screen.findByRole('heading', { level: 1, name: 'addToBasket' });
    expect(requests.filter((r) => r === 'GET /api/spec')).toHaveLength(1);

    // An agent renames the command handler in its data file; the server sends spec:changed.
    const changed = setRow(workspace(), 'command_handler', 'DM-SHOP-CMD01-H', { title: 'Basket store' });
    const after = serve({ data: changed });
    await act(async () => { for (const callback of listeners.get('spec:changed') ?? []) callback(); });

    expect(await screen.findByRole('heading', { level: 1, name: 'Basket store' })).toBeInTheDocument();
    // The spec again, and the products the nav lists and the Changes baseline read again with it (GET /api/baseline, its
    // last commit may have moved); the command's page reads its command again through the aggregate's own query.
    expect(after.requests.filter((r) => !r.startsWith('GET /api/baseline?'))).toEqual(['GET /api/spec', 'GET /api/product/list-products?', 'GET /api/command/get-command?id=DM-SHOP-CMD01-H']);
    // The address and page stay the same; no manual refresh.
    expect(window.location.pathname).toBe('/DM-SHOP-CMD01-H');
  });
});
