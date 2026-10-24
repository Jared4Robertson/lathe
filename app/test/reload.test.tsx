import { act, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
  it('LA-BRW-T19 An open spec page reloads the workspace when the server reports spec:changed', async () => {
    const { requests } = await openApp('/records/DM-SHOP-C01');
    await screen.findByRole('heading', { level: 1, name: 'Basket service' });
    expect(requests.filter((r) => r === 'GET /api/spec')).toHaveLength(1);

    // An agent renames the component on disk; the server sends spec:changed.
    const changed = workspace();
    changed.records.find((r) => r.id === 'DM-SHOP-C01')!.title = 'Basket store';
    const after = serve({ workspace: changed });
    await act(async () => { for (const callback of listeners.get('spec:changed') ?? []) callback(); });

    expect(await screen.findByRole('heading', { level: 1, name: 'Basket store' })).toBeInTheDocument();
    expect(after).toEqual(['GET /api/spec']);
    // The address and page stay the same; no manual refresh.
    expect(window.location.pathname).toBe('/records/DM-SHOP-C01');
  });
});
