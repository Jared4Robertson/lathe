import './graph/setup';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { SpecData } from '../../lathe/src/server/contract';
import { findItems, rankItems } from '../src/shell/QuickFind';
import { colorField, colorOf, iconField, monogramOf, productOfPath, spaceOf } from '../src/shell/spaces';
import { spaceIndex } from '../src/specs/data';
import { addRows, indexOf, setRow } from './fixtures/load';
import { workspace } from './fixtures/workspace';
import { modelWorkspace } from './fixtures/model';
import { main, openApp } from './helpers';

// Product spaces: the rail at the far left of the nav, one icon per product; the nav, quick find
// and Checks are the current space's alone; Alt+1 to Alt+9 switch spaces.

const nav = () => screen.getByRole('navigation', { name: 'Main' });
const rail = () => within(nav()).getByRole('list', { name: 'Spaces' });
const spaceLink = (name: string) => within(rail()).getByRole('link', { name });
const panel = () => nav().querySelector<HTMLElement>('.space-items')!;
const announcer = () => screen.getByTestId('announcer');

/** The fixture with an icon on Notebook, capabilities in Shopping, and a third product. */
function spacesWorkspace(): SpecData {
  const ws = setRow(workspace(), 'product', 'NF', { icon: '📓', color: '#335577' });
  addRows(ws, 'capability',
    { id: 'DM-SHOP-CAP02', title: 'Paying for the basket', domain_id: 'DM-SHOP', position: 3 },
    { id: 'DM-SHOP-CAP03', title: 'Filling the basket', domain_id: 'DM-SHOP', position: 2 },
  );
  addRows(ws, 'product', { id: 'AB', title: 'Alpha beta', icon: 'far too long' });
  addRows(ws, 'domain', { id: 'AB-ONE', title: 'First things', product_id: 'AB' });
  return ws;
}

describe('product spaces', () => {
  it('LA-EXP-DS01-T01 The rail lists the products in order, each with its icon or its monogram on a stable color', async () => {
    // The icon field: one emoji or up to two characters; otherwise the ID's monogram.
    expect(iconField('📓')).toBe('📓');
    expect(iconField('TL')).toBe('TL');
    expect(iconField('👩‍💻')).toBe('👩‍💻');
    expect(iconField('far too long')).toBeNull();
    expect(iconField('ABC')).toBeNull();
    expect(iconField('')).toBeNull();
    expect(monogramOf('TL')).toBe('TL');
    expect(monogramOf('LA')).toBe('LA');
    expect(colorField('#335577')).toBe('#335577');
    expect(colorField('url(x)')).toBeNull();
    expect(colorOf('TL')).toBe(colorOf('TL'));
    expect(colorOf('TL')).not.toBe(colorOf('LA'));
    const index = indexOf(spacesWorkspace());
    expect(spaceOf(index.byId.get('NF')!).color).toBe('#335577');
    expect(spaceOf(index.byId.get('DM')!).color).toBe(colorOf('DM'));
  });

  it('LA-V90-R08-T01 The rail lists the products in order with their icons or monograms, and nothing above every product', async () => {
    await openApp('/DM', { data: spacesWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    const items = within(rail()).getAllByRole('link');
    expect(items.map((a) => a.querySelector('.sr-only')!.textContent)).toEqual(['Alpha beta', 'Demo shop', 'Notebook']);
    expect(items.map((a) => a.querySelector('.space-mark')!.textContent)).toEqual(['AB', 'DM', '📓']);
    expect(items[0].querySelector('.space-mark')).toHaveClass('is-monogram');
    expect(items[2].querySelector('.space-mark')).toHaveClass('is-icon');
    // Nothing after the spaces: no item above every product.
    expect(nav().querySelector('.space-rail hr')).toBeNull();
    expect(within(nav().querySelector<HTMLElement>('.space-rail')!).getAllByRole('link')).toHaveLength(3);
  });

  it('LA-EXP-DS02-T01 The current space is the product of the page, its Checks page included', () => {
    const index = indexOf(spacesWorkspace());
    expect(productOfPath(index, '/NF-NOTE')).toBe('NF');
    expect(productOfPath(index, '/DM-SHOP-UC01-R01')).toBe('DM');
    expect(productOfPath(index, '/DM-SHOP/use_case')).toBe('DM');
    expect(productOfPath(index, '/NF/checks')).toBe('NF');
    expect(productOfPath(index, '/format')).toBeNull();
    expect(productOfPath(index, '/')).toBeNull();
  });

  it('LA-V90-R09-T01 The current space is marked with aria-current and an accent bar', async () => {
    await openApp('/NF-NOTE', { data: spacesWorkspace() });
    await waitFor(() => expect(spaceLink('Notebook')).toHaveAttribute('aria-current', 'true'));
    expect(spaceLink('Demo shop')).not.toHaveAttribute('aria-current');
    expect(spaceLink('Notebook')).toHaveClass('is-current');
    const css = (await import('node:fs')).readFileSync((await import('node:path')).resolve(process.cwd(), 'src/styles.css'), 'utf8');
    expect(css).toMatch(/\.space-item\[aria-current\]::before/);
  });

  it('LA-V90-R72-T01 The rail shows with two or more products; with one there is none, and the product heads the nav', async () => {
    await openApp('/DM', { data: spacesWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    expect(nav().querySelector('.space-rail')).not.toBeNull();
    // One product: no rail, the panel the whole nav, the product's name and icon its first row.
    await openApp('/P', { data: modelWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Product' });
    expect(nav().querySelector('.space-rail')).toBeNull();
    expect(within(nav()).queryByRole('list', { name: 'Spaces' })).toBeNull();
    const head = within(panel()).getByRole('link', { name: 'Product' });
    expect(head).toHaveAttribute('href', '/P');
    expect(head.querySelector('.space-mark')).toHaveTextContent('P');
    // Collapsed, the nav keeps its buttons and lists no spaces.
    fireEvent.click(within(nav()).getByRole('button', { name: 'Collapse the navigation' }));
    expect(within(nav()).getByRole('button', { name: 'Expand the navigation' })).toBeInTheDocument();
    expect(within(nav()).queryByRole('list', { name: 'Spaces' })).toBeNull();
    fireEvent.click(within(nav()).getByRole('button', { name: 'Expand the navigation' }));
  });

  it('LA-V41-R03-T01 The space\'s Checks page is inside it, at its product\'s ID, opened from the nav', async () => {
    await openApp('/NF-NOTE', { data: spacesWorkspace() });
    await waitFor(() => expect(spaceLink('Notebook')).toHaveAttribute('aria-current', 'true'));
    // Checks is the space's own page: the space stays Notebook.
    await userEvent.setup().click(within(nav()).getByRole('link', { name: /^Checks \d+ (errors?|warnings?|problems)/ }));
    expect(window.location.pathname).toBe('/NF/checks');
    expect(spaceLink('Notebook')).toHaveAttribute('aria-current', 'true');
    expect(within(panel()).getByRole('link', { name: 'Notes' })).toBeInTheDocument();
  });

  it('LA-V90-R10-T01 Choosing a space scopes the nav to its domains, stages, capabilities and groups', async () => {
    await openApp('/DM', { data: spacesWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    expect(within(nav().querySelector<HTMLElement>('.nav-space')!).getByRole('link', { name: 'Demo shop' })).toHaveAttribute('href', '/DM');
    expect(within(within(panel()).getByRole('list', { name: 'Domains of Demo shop' })).getAllByRole('link', { name: /^(Paying|Shopping)$/ }).map((a) => a.textContent)).toEqual(['Paying', 'Shopping']);
    // Capabilities in their order, in their domain's Use cases stage.
    const user = userEvent.setup();
    await user.click(within(panel()).getByRole('button', { name: 'Unfold Shopping' }));
    await user.click(within(within(panel()).getByRole('list', { name: 'Folders of Shopping' })).getByRole('button', { name: /^Use cases/ }));
    await user.click(within(within(panel()).getByRole('list', { name: 'Use cases of Shopping' })).getByRole('button', { name: /^Capabilities/ }));
    expect(within(panel()).getByRole('list', { name: 'Capabilities of Shopping' }).textContent).toBe('BuyingFilling the basketPaying for the basket');
    // The product's groups: its open questions.
    const groups = within(panel()).getByRole('list', { name: 'Groups of Demo shop' });
    expect(within(groups).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/DM/question']);
    expect(within(nav()).queryByRole('link', { name: 'Notes' })).toBeNull();

    await userEvent.setup().click(spaceLink('Notebook'));
    expect(window.location.pathname).toBe('/NF');
    expect(within(nav().querySelector<HTMLElement>('.nav-space')!).getByRole('link', { name: 'Notebook' })).toHaveAttribute('href', '/NF');
    expect(within(panel()).getByRole('link', { name: 'Notes' })).toBeInTheDocument();
    expect(within(nav()).queryByRole('link', { name: 'Shopping' })).toBeNull();
    expect(within(nav()).queryByRole('list', { name: 'Groups of Demo shop' })).toBeNull();
  });

  /** A page in Demo shop, then Notebook's product page and a page in it. */
  const twoSpacesVisited = async () => {
    await openApp('/DM-SHOP-UC01', { data: spacesWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    const user = userEvent.setup();
    expect(spaceLink('Notebook')).toHaveAttribute('href', '/NF');
    await user.click(spaceLink('Notebook'));
    expect(window.location.pathname).toBe('/NF');
    await user.click(within(panel()).getByRole('link', { name: 'Notes' }));
    expect(window.location.pathname).toBe('/NF-NOTE');
    return user;
  };

  it('LA-V90-R11-T02 The rail\'s link to a space names the last page opened in it', async () => {
    await twoSpacesVisited();
    expect(spaceLink('Demo shop')).toHaveAttribute('href', '/DM-SHOP-UC01');
    expect(spaceLink('Notebook')).toHaveAttribute('href', '/NF-NOTE');
  });

  it('LA-V90-R11-T01 Choosing a space opens the last page visited in it, or its product page', async () => {
    const user = await twoSpacesVisited();
    await user.click(spaceLink('Demo shop'));
    expect(window.location.pathname).toBe('/DM-SHOP-UC01');
    await user.click(spaceLink('Notebook'));
    expect(window.location.pathname).toBe('/NF-NOTE');
  });

  it('LA-EXP-INV04-T A space\'s last page is remembered for the session only', async () => {
    await twoSpacesVisited();
    // Remembered for the session, not for ever.
    expect(JSON.parse(window.sessionStorage.getItem('lathe:space-pages')!)).toMatchObject({ DM: '/DM-SHOP-UC01', NF: '/NF-NOTE' });
    expect(window.localStorage.getItem('lathe:space-pages')).toBeNull();
  });

  it('LA-EXP-DS01-T02 Alt+1 to Alt+9 switch spaces in rail order, and the palette has a Switch to command for each', async () => {
    await openApp('/', { data: spacesWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Products' });
    const press = (n: number) => fireEvent.keyDown(document.body, { key: String(n), code: `Digit${n}`, altKey: true });
    press(3);
    expect(window.location.pathname).toBe('/NF');
    await waitFor(() => expect(announcer()).toHaveTextContent('Switched to Notebook'));
    press(1);
    expect(window.location.pathname).toBe('/AB');
    // A number with no space does nothing.
    const event = new KeyboardEvent('keydown', { key: '4', code: 'Digit4', altKey: true, bubbles: true, cancelable: true });
    document.body.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(window.location.pathname).toBe('/AB');
  });

  it('LA-V90-R12-T01 Alt and a number leave every other shortcut working, and the palette has a Switch to command for each space', async () => {
    await openApp('/AB', { data: spacesWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Alpha beta' });
    // Every other shortcut still works: Ctrl+Shift+M opens the space's Checks.
    fireEvent.keyDown(document.body, { key: 'M', code: 'KeyM', ctrlKey: true, shiftKey: true });
    expect(window.location.pathname).toBe('/AB/checks');

    fireEvent.keyDown(document.body, { key: 'P', code: 'KeyP', ctrlKey: true, shiftKey: true });
    const palette = screen.getByRole('dialog', { name: 'Command palette' });
    await userEvent.setup().type(within(palette).getByRole('combobox'), 'switch to');
    expect(within(palette).getAllByRole('option').map((o) => [o.querySelector('.palette-title')!.textContent, o.querySelector('kbd')!.textContent])).toEqual([
      ['Switch to Alpha beta', 'Alt+1'],
      ['Switch to Demo shop', 'Alt+2'],
      ['Switch to Notebook', 'Alt+3'],
    ]);
    await userEvent.setup().keyboard('{ArrowDown}{Enter}');
    await waitFor(() => expect(window.location.pathname).toBe('/DM'));
  });

  it('LA-V90-R13-T01 Quick find searches the current space only', async () => {
    const index = indexOf(spacesWorkspace());
    const ranked = rankItems(findItems(spaceIndex(index, 'NF')), 'n', 50);
    expect(ranked.some((i) => i.id === 'NF-NOTE')).toBe(true);
    expect(ranked.filter((i) => /^[A-Z]/.test(i.id)).every((i) => i.id.startsWith('NF'))).toBe(true);

    await openApp('/DM', { data: spacesWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    const user = userEvent.setup();
    const find = within(nav()).getByRole('combobox', { name: 'Quick find' });
    await user.click(find);
    await user.type(find, 'note');
    let list = within(nav()).getByRole('listbox', { name: 'Quick find results' });
    // Notebook's records are another space's: nothing of them is found from Demo shop.
    expect(within(list).queryAllByRole('option').map((o) => o.querySelector('code')!.textContent)).not.toEqual(expect.arrayContaining(['NF-NOTE']));
    expect(within(list).queryAllByRole('group')).toHaveLength(0);

    await user.clear(find);
    await user.type(find, 'n');
    list = within(nav()).getByRole('listbox', { name: 'Quick find results' });
    const ids = within(list).getAllByRole('option').map((o) => o.querySelector('code')!.textContent!);
    expect(ids.filter((id) => /^[A-Z]/.test(id)).every((id) => id.startsWith('DM'))).toBe(true);
    // The arrow keys run through the results.
    expect(within(list).getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowUp}');
    expect(within(list).getAllByRole('option').at(-1)).toHaveAttribute('aria-selected', 'true');
  });

  it("LA-V41-R01-T02 Each space has its own Checks page: its product's problems, then the workspace's under Workspace", async () => {
    await openApp('/NF', { data: spacesWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Notebook' });
    await userEvent.setup().click(within(nav()).getByRole('link', { name: /^Checks \d+ (errors?|warnings?|problems)/ }));
    expect(window.location.pathname).toBe('/NF/checks');
    expect(within(main()).getByText('Notebook · checks')).toBeInTheDocument();
    // Notebook's one error and the workspace's one; none of Demo shop's.
    expect(within(main()).getByText('2 errors · 0 warnings')).toBeInTheDocument();
    expect(within(main()).queryByRole('group', { name: 'Show checks for' })).toBeNull();
    // The workspace's problem names no record, so its row opens its check (LA-PAT-APP-UX-R14).
    expect([...main().querySelectorAll('section li a')].map((a) => a.getAttribute('href'))).toEqual(['/NF-NOTE', '/format/checks/engine']);
    expect(within(main()).getByRole('heading', { level: 2, name: /^Workspace/ })).toBeInTheDocument();
    expect(within(main()).getByText('The checks could not read a file.')).toBeInTheDocument();
    expect(main().textContent).not.toMatch(/DM-/);
  });

  it("LA-V41-R03-T02 Each space has its own Checks page, and none lists every product's", async () => {
    await openApp('/NF/checks', { data: spacesWorkspace() });
    await screen.findByText('Notebook · checks');
    expect(within(main()).queryByRole('group', { name: 'Show checks for' })).toBeNull();
    await userEvent.setup().click(spaceLink('Demo shop'));
    await userEvent.setup().click(within(nav()).getByRole('link', { name: /^Checks \d+ (errors?|warnings?|problems)/ }));
    expect(window.location.pathname).toBe('/DM/checks');
    expect(within(main()).getByText('2 errors · 3 warnings')).toBeInTheDocument();
    expect(main().textContent).not.toMatch(/NF-/);
    expect(within(main()).getByText('The checks could not read a file.')).toBeInTheDocument();
  });

  it('LA-V90-R14-T01 On a narrow screen the rail stays visible inside the nav drawer', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {} }));
    await openApp('/DM', { data: spacesWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    fireEvent.click(screen.getByRole('button', { name: 'Open the navigation' }));
    expect(nav()).toHaveClass('is-drawer');
    expect(within(rail()).getAllByRole('link')).toHaveLength(3);
    await userEvent.setup().click(spaceLink('Notebook'));
    expect(window.location.pathname).toBe('/NF');
    await waitFor(() => expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull());
  });
});
