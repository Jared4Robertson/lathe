import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { indexWorkspace, parseSpecRoute } from '../src/specs/data';
import { workspace } from './fixtures/workspace';
import { main, openApp } from './helpers';

const menu = () => screen.getByRole('navigation', { name: 'Main' });
const heading = () => within(main()).getByRole('heading', { level: 1 });

describe('routing', () => {
  it('LA-BRW-T01 Every page has its own address, and back and forward move between pages', async () => {
    // A record is at its bare ID; a product's and a domain's ID is their overview, once the specs are known.
    const index = indexWorkspace(workspace());
    expect(parseSpecRoute('/DM', index)).toEqual({ page: 'product', product: 'DM' });
    expect(parseSpecRoute('/DM-SHOP', index)).toEqual({ page: 'domain', product: 'DM', domain: 'DM-SHOP' });
    expect(parseSpecRoute('/DM-SHOP')).toEqual({ page: 'record', id: 'DM-SHOP' });
    expect(parseSpecRoute('/specs/DM/DM-SHOP/graph')).toEqual({ page: 'redirect', to: '/DM-SHOP?view=graph' });
    expect(parseSpecRoute('/DM-SHOP-C01', index)).toEqual({ page: 'record', id: 'DM-SHOP-C01' });
    expect(parseSpecRoute('/DM-SHOP/use_case')).toEqual({ page: 'group', parent: 'DM-SHOP', kind: 'use_case' });
    expect(parseSpecRoute('/')).toEqual({ page: 'specs' });
    expect(parseSpecRoute('/checks')).toEqual({ page: 'checks' });
    expect(parseSpecRoute('/format')).toEqual({ page: 'format' });
    expect(parseSpecRoute('/diagrams/people')).toBeNull();
    expect(parseSpecRoute('/settings/appearance')).toBeNull();
    expect(parseSpecRoute('/nothing-here')).toEqual({ page: 'missing' });

    // Opening an address directly (a bookmark or a reload) shows that page.
    await openApp('/DM-SHOP-UC01-R01');
    expect(await screen.findByRole('heading', { level: 1, name: 'The basket shows the new item' })).toBeInTheDocument();

    // Clicking a link changes the address without a full reload.
    const user = userEvent.setup();
    await user.click(within(menu()).getByRole('link', { name: 'Shopping' }));
    expect(window.location.pathname).toBe('/DM-SHOP');
    expect(heading()).toHaveTextContent('Shopping');
    await user.click(within(menu()).getByRole('link', { name: /^Checks:/ }));
    expect(window.location.pathname).toBe('/checks');
    expect(heading()).toHaveTextContent('Checks');

    // Back and forward move between the pages.
    await act(async () => { window.history.back(); await new Promise((r) => window.addEventListener('popstate', r, { once: true })); });
    expect(window.location.pathname).toBe('/DM-SHOP');
    expect(heading()).toHaveTextContent('Shopping');
    await act(async () => { window.history.back(); await new Promise((r) => window.addEventListener('popstate', r, { once: true })); });
    expect(heading()).toHaveTextContent('The basket shows the new item');
    await act(async () => { window.history.forward(); await new Promise((r) => window.addEventListener('popstate', r, { once: true })); });
    expect(heading()).toHaveTextContent('Shopping');
  });

  it('LA-BRW-T02 The menu lists each product and its domains beside the Diagrams section', async () => {
    await openApp('/DM', { diagrams: [{ slug: 'people', title: 'People and tools', description: null }] });
    const nav = menu();
    expect(within(nav).getByText('Diagrams')).toBeInTheDocument();
    expect(await within(nav).findByRole('link', { name: 'People and tools' })).toHaveAttribute('href', '/diagrams/people');
    expect(within(nav).getByRole('button', { name: 'New diagram' })).toBeInTheDocument();

    // The current space's section: its product, then its domains; another product is only in the rail.
    const items = nav.querySelector<HTMLElement>('.space-items')!;
    const demo = within(items).getByRole('link', { name: 'Demo shop' });
    expect(demo).toHaveAttribute('href', '/DM');
    expect(demo).toHaveAttribute('aria-current', 'page');
    const domains = within(within(items).getByRole('list', { name: 'Domains of Demo shop' })).getAllByRole('link');
    expect(domains.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Paying', '/DM-PAY'],
      ['Shopping', '/DM-SHOP'],
    ]);
    expect(within(nav).queryByRole('link', { name: 'Notes' })).toBeNull();
    expect(within(within(nav).getByRole('list', { name: 'Spaces' })).getByRole('link', { name: 'Notebook' })).toHaveAttribute('href', '/NF');
  });
});
