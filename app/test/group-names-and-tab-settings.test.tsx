import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import './graph/setup';
import { openApp, openSideBar } from './helpers';

// A stage or folder group is named by its own name, and a tab keeps the graph's switches.

describe('group names and tab settings', () => {
  it('LA-V93-R25-T03 A stage or folder group page names the group by its own name, not by a kind ("Domain model", never "Domain models")', async () => {
    // The side bar starts closed in the Wiki view; this test reads it open.
    openSideBar('details', ['wiki', 'graph', 'model']);
    await openApp('/DM-SHOP/domain-model?view=wiki');
    await screen.findByRole('heading', { level: 1, name: /^Domain model/ });
    expect(document.querySelector('.group-intro')).toHaveTextContent(/^Domain model of DM-SHOP/);
    expect(document.body).not.toHaveTextContent('Domain models');
    expect(within(screen.getByRole('complementary', { name: 'Side bar' })).getByText(/^Domain model \(\d+\)$/)).toBeInTheDocument();
  });

  const proveLaV96R14T02 = async () => {
    await openApp('/DM-SHOP-UC01?view=graph');
    const links = await screen.findByRole('button', { name: /^Links/ });
    expect(links).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(links);
    await waitFor(() => expect(screen.getByRole('button', { name: /^Links/ })).toHaveAttribute('aria-pressed', 'true'));
    // Reload: the same tab comes back with its switch still on.
    await openApp('/DM-SHOP-UC01?view=graph');
    await waitFor(() => expect(screen.getByRole('button', { name: /^Links/ })).toHaveAttribute('aria-pressed', 'true'));
  };
  it('LA-V96-R14-T02 A tab keeps the graph\'s Links switch across a reload', proveLaV96R14T02);
  it('LA-V96-R15-T02 A tab keeps the graph\'s Links switch across a reload', proveLaV96R14T02);
});
