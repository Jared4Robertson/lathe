import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { parseSpecRoute } from '../src/specs/data';
import { main, openApp } from './helpers';

const menu = () => screen.getByRole('navigation', { name: 'Main' });
const heading = () => within(main()).getByRole('heading', { level: 1 });

describe('routing', () => {
  it('LA-BRW-T01 Every page has its own address, and back and forward move between pages', async () => {
    expect(parseSpecRoute('/specs/DM')).toEqual({ page: 'product', product: 'DM' });
    expect(parseSpecRoute('/specs/DM/DM-SHOP')).toEqual({ page: 'domain', product: 'DM', domain: 'DM-SHOP' });
    expect(parseSpecRoute('/specs/DM/DM-SHOP/graph')).toEqual({ page: 'redirect', to: '/specs/DM/DM-SHOP?view=graph' });
    expect(parseSpecRoute('/records/DM-SHOP-C01')).toEqual({ page: 'record', id: 'DM-SHOP-C01' });
    expect(parseSpecRoute('/records/DM-SHOP/use_case')).toEqual({ page: 'group', parent: 'DM-SHOP', kind: 'use_case' });
    expect(parseSpecRoute('/checks')).toEqual({ page: 'checks' });
    expect(parseSpecRoute('/format')).toEqual({ page: 'format' });
    expect(parseSpecRoute('/diagrams/people')).toBeNull();

    // Opening an address directly (a bookmark or a reload) shows that page.
    await openApp('/records/DM-SHOP-UC01-R01');
    expect(await screen.findByRole('heading', { level: 1, name: 'The basket shows the new item' })).toBeInTheDocument();

    // Clicking a link changes the address without a full reload.
    const user = userEvent.setup();
    await user.click(within(menu()).getByRole('link', { name: 'Shopping' }));
    expect(window.location.pathname).toBe('/specs/DM/DM-SHOP');
    expect(heading()).toHaveTextContent('Shopping');
    await user.click(within(menu()).getByRole('link', { name: /Checks/ }));
    expect(window.location.pathname).toBe('/checks');
    expect(heading()).toHaveTextContent('Checks');

    // Back and forward move between the pages.
    await act(async () => { window.history.back(); await new Promise((r) => window.addEventListener('popstate', r, { once: true })); });
    expect(window.location.pathname).toBe('/specs/DM/DM-SHOP');
    expect(heading()).toHaveTextContent('Shopping');
    await act(async () => { window.history.back(); await new Promise((r) => window.addEventListener('popstate', r, { once: true })); });
    expect(heading()).toHaveTextContent('The basket shows the new item');
    await act(async () => { window.history.forward(); await new Promise((r) => window.addEventListener('popstate', r, { once: true })); });
    expect(heading()).toHaveTextContent('Shopping');
  });

  it('LA-BRW-T02 The menu lists each product and its domains beside the Diagrams section', async () => {
    await openApp('/specs/DM', { diagrams: [{ slug: 'people', title: 'People and tools', description: null }] });
    const nav = menu();
    expect(within(nav).getByText('Diagrams')).toBeInTheDocument();
    expect(await within(nav).findByRole('link', { name: 'People and tools' })).toHaveAttribute('href', '/diagrams/people');
    expect(within(nav).getByRole('button', { name: '+ New diagram' })).toBeInTheDocument();

    expect(within(nav).getByText('Specs')).toBeInTheDocument();
    const demo = within(nav).getByRole('link', { name: 'Demo shop' });
    expect(demo).toHaveAttribute('href', '/specs/DM');
    expect(demo).toHaveAttribute('aria-current', 'page');
    const domains = within(demo.closest('li')!).getAllByRole('link').slice(1);
    expect(domains.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Paying', '/specs/DM/DM-PAY'],
      ['Shopping', '/specs/DM/DM-SHOP'],
    ]);
    const notebook = within(nav).getByRole('link', { name: 'Notebook' });
    expect(within(notebook.closest('li')!).getByRole('link', { name: 'Notes' })).toHaveAttribute('href', '/specs/NF/NF-NOTE');
  });
});
