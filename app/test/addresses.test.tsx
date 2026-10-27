import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { main, openApp, openSideBar } from './helpers';

// Addresses are bare IDs (LA-PAT-APP-CODE-R19): tabs and space pages saved at anything else are
// dropped (LA-PAT-APP-CODE-R20), and a product's and a domain's one page loses nothing the
// generic record page showed.

const sideBar = () => screen.getByRole('complementary', { name: 'Side bar' });

describe('bare-ID addresses', () => {
  it('LA-PLT-T105 Tabs and space pages saved at anything but a page\'s address are dropped, not converted', async () => {
    const tab = (key: string, page: string) => ({ key, page, preview: false, state: { views: 'wiki' } });
    window.sessionStorage.setItem('lathe:tabs', JSON.stringify({
      DM: { active: 't1', tabs: [tab('t1', '/DM-SHOP-UC01'), tab('t2', '/specs/DM/DM-SHOP'), tab('t3', '/records/DM-SHOP/use_case'), tab('t4', '/DM-SHOP/use_case')] },
    }));
    window.sessionStorage.setItem('lathe:space-pages', JSON.stringify({ NF: '/specs/NF/NF-NOTE?view=graph' }));
    await openApp('/DM-SHOP-UC01');
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    const tabs = [...document.querySelectorAll('.tab-strip [data-page]')].map((t) => t.getAttribute('data-page'));
    expect(tabs).toEqual(['/DM-SHOP-UC01', '/DM-SHOP/use_case']);
    await waitFor(() => expect(window.sessionStorage.getItem('lathe:tabs')).not.toMatch(/\/records|\/specs/));
    // The space's saved page is dropped too: its rail link opens the product.
    const rail = within(screen.getByRole('list', { name: 'Spaces' }));
    expect(rail.getByRole('link', { name: 'Notebook' })).toHaveAttribute('href', '/NF');
  });

  it('LA-EXP-T138 A product\'s and a domain\'s one page, at its ID, shows its text, its facts, its links both ways and its problems', async () => {
    openSideBar();
    for (const [path, title, body] of [['/DM', 'Demo shop', /A demo product for the/], ['/DM-SHOP', 'Shopping', /People pick goods and pay/]] as const) {
      await openApp(path);
      await screen.findByRole('heading', { level: 1, name: title });
      expect(within(main()).getAllByText(body).length).toBeGreaterThan(0);
      for (const name of [/^Parent/, /^Links out/, /^Links in/, /^Problems/]) expect(within(sideBar()).getByRole('heading', { name })).toBeInTheDocument();
      expect(within(sideBar()).getByText('Data file')).toBeInTheDocument();
      // No second page to send the Reader to.
      expect(screen.queryByRole('link', { name: /Open the (product|domain) overview/ })).toBeNull();
    }
  });
});
