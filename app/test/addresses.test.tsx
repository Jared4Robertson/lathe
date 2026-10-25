import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { main, openApp } from './helpers';

// Addresses are bare IDs (LA-PAT-APP-CODE-R19): tabs and space pages saved under the old
// addresses open at the new ones, and a product's and a domain's one page loses nothing the
// generic record page showed.

const inspector = () => screen.getByRole('complementary', { name: 'Inspector' });

describe('bare-ID addresses', () => {
  it('LA-BRW-T522 Tabs and space pages saved under old addresses open at today\'s', async () => {
    const tab = (key: string, page: string) => ({ key, page, preview: false, state: { views: 'wiki' } });
    window.sessionStorage.setItem('lathe:tabs', JSON.stringify({
      DM: { active: 't1', tabs: [tab('t1', '/records/DM-SHOP-UC01'), tab('t2', '/specs/DM/DM-SHOP'), tab('t3', '/records/DM-SHOP/use_case')] },
    }));
    window.sessionStorage.setItem('lathe:space-pages', JSON.stringify({ NF: '/specs/NF/NF-NOTE?view=graph' }));
    await openApp('/DM-SHOP-UC01');
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    const tabs = [...document.querySelectorAll('.tab-strip [data-page]')].map((t) => t.getAttribute('data-page'));
    expect(tabs).toEqual(['/DM-SHOP-UC01', '/DM-SHOP', '/DM-SHOP/use_case']);
    // Written back in today's form.
    await waitFor(() => expect(window.sessionStorage.getItem('lathe:tabs')).not.toMatch(/\/records|\/specs/));
    const rail = within(screen.getByRole('list', { name: 'Spaces' }));
    expect(rail.getByRole('link', { name: 'Notebook' })).toHaveAttribute('href', '/NF-NOTE?view=graph');
  });

  it('LA-BRW-T523 A product\'s and a domain\'s one page, at its ID, shows its body, its facts, its links both ways and its problems', async () => {
    for (const [path, title, body] of [['/DM', 'Demo shop', /A demo product for the/], ['/DM-SHOP', 'Shopping', /People pick goods and pay/]] as const) {
      await openApp(path);
      await screen.findByRole('heading', { level: 1, name: title });
      expect(within(main()).getAllByText(body).length).toBeGreaterThan(0);
      for (const name of [/^Parent/, /^Links out/, /^Links in/, /^Problems/]) expect(within(inspector()).getByRole('heading', { name })).toBeInTheDocument();
      expect(within(inspector()).getByText('Spec file')).toBeInTheDocument();
      // No second page to send the Reader to.
      expect(screen.queryByRole('link', { name: /Open the (product|domain) overview/ })).toBeNull();
    }
  });
});
