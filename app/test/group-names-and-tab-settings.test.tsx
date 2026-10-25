import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import './graph/setup';
import { openApp, openSideBar } from './helpers';

// Follow-ups from brief 56: a stage or folder group is named by its own name, and a tab keeps the graph's switches.

describe('group names and tab settings', () => {
  it('LA-BRW-T554 A stage or folder group page names the group by its own name, not by a kind ("Define", never "Defines")', async () => {
    // The side bar starts closed in the Wiki view (brief 64); this test reads it open.
    openSideBar('details', ['wiki', 'graph', 'model']);
    await openApp('/DM-SHOP/define?view=wiki');
    await screen.findByRole('heading', { level: 1, name: /^Define/ });
    expect(document.querySelector('.group-intro')).toHaveTextContent(/^Define of DM-SHOP/);
    expect(document.body).not.toHaveTextContent('Defines');
    expect(within(screen.getByRole('complementary', { name: 'Side bar' })).getByText(/^Define \(\d+\)$/)).toBeInTheDocument();
  });

  it('LA-BRW-T555 A tab keeps the graph\'s Links switch across a reload', async () => {
    await openApp('/DM-SHOP-UC01?view=graph');
    const links = await screen.findByRole('button', { name: /^Links/ });
    expect(links).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(links);
    await waitFor(() => expect(screen.getByRole('button', { name: /^Links/ })).toHaveAttribute('aria-pressed', 'true'));
    // Reload: the same tab comes back with its switch still on.
    await openApp('/DM-SHOP-UC01?view=graph');
    await waitFor(() => expect(screen.getByRole('button', { name: /^Links/ })).toHaveAttribute('aria-pressed', 'true'));
  });
});
