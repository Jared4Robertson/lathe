import './graph/setup';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { SpecRecord, Workspace } from '../../lathe/src/types';
import { findItems, rankScoped } from '../src/shell/QuickFind';
import { colorField, colorOf, iconField, monogramOf, productOfPath, spaceOf } from '../src/shell/spaces';
import { indexWorkspace } from '../src/specs/data';
import { workspace } from './fixtures/workspace';
import { main, openApp } from './helpers';

// Product spaces: the rail at the far left of the nav, one icon per product; the nav, quick find
// and Checks follow the current space; Alt+1 to Alt+9 switch spaces.

const nav = () => screen.getByRole('navigation', { name: 'Main' });
const rail = () => within(nav()).getByRole('list', { name: 'Spaces' });
const spaceLink = (name: string) => within(rail()).getByRole('link', { name });
const panel = () => nav().querySelector<HTMLElement>('.space-items')!;
const announcer = () => screen.getByTestId('announcer');

const rec = (id: string, kind: string, title: string, parent: string, fields: Record<string, string> = {}): SpecRecord => ({
  id, kind, title, parent, product: id.split('-')[0], domain: id.split('-').slice(0, 2).join('-'), fields, body: '', path: `specs/${id}.md`, mentions: [],
});

/** The fixture with an icon on Notebook, capabilities in Shopping, and a third product. */
function spacesWorkspace(): Workspace {
  const ws = workspace();
  const records = ws.records.map((r) => (r.id === 'NF' ? { ...r, fields: { ...r.fields, icon: '📓', color: '#335577' } } : r));
  records.push(
    rec('DM-SHOP-CAP02', 'capability', 'Paying for the basket', 'DM-SHOP', { order: '2' }),
    rec('DM-SHOP-CAP01', 'capability', 'Filling the basket', 'DM-SHOP', { order: '1' }),
    { ...rec('AB', 'product', 'Alpha beta', ''), parent: null, product: 'AB', domain: null, fields: { icon: 'far too long' } },
    rec('AB-ONE', 'domain', 'First things', 'AB'),
  );
  return { ...ws, records };
}

describe('product spaces', () => {
  it('LA-BRW-T220 The rail lists the products in order, each with its icon or its monogram on a stable color', async () => {
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

    await openApp('/DM', { workspace: spacesWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    const items = within(rail()).getAllByRole('link');
    expect(items.map((a) => a.getAttribute('aria-label'))).toEqual(['Alpha beta', 'Demo shop', 'Notebook']);
    expect(items.map((a) => a.querySelector('.space-mark')!.textContent)).toEqual(['AB', 'DM', '📓']);
    expect(items[0].querySelector('.space-mark')).toHaveClass('is-monogram');
    expect(items[2].querySelector('.space-mark')).toHaveClass('is-icon');
    const index = indexWorkspace(spacesWorkspace());
    expect(spaceOf(index.byId.get('NF')!).color).toBe('#335577');
    expect(spaceOf(index.byId.get('DM')!).color).toBe(colorOf('DM'));
    // After the spaces, a separator and the items above every product.
    expect(nav().querySelector('.space-rail hr')).not.toBeNull();
    expect(within(nav().querySelector<HTMLElement>('.space-rail')!).getByRole('link', { name: 'Diagrams' })).toBeInTheDocument();
    expect(within(nav().querySelector<HTMLElement>('.space-rail')!).getByRole('link', { name: /^Checks for all products/ })).toHaveAttribute('href', '/checks');
  });

  it('LA-BRW-T221 The current space is the product of the page, marked with aria-current and an accent bar, and stays on pages above every product', async () => {
    const index = indexWorkspace(spacesWorkspace());
    expect(productOfPath(index, '/NF-NOTE')).toBe('NF');
    expect(productOfPath(index, '/DM-SHOP-UC01-R01')).toBe('DM');
    expect(productOfPath(index, '/DM-SHOP/use_case')).toBe('DM');
    expect(productOfPath(index, '/checks')).toBeNull();

    await openApp('/NF-NOTE', { workspace: spacesWorkspace() });
    await waitFor(() => expect(spaceLink('Notebook')).toHaveAttribute('aria-current', 'true'));
    expect(spaceLink('Demo shop')).not.toHaveAttribute('aria-current');
    expect(spaceLink('Notebook')).toHaveClass('is-current');
    const css = (await import('node:fs')).readFileSync((await import('node:path')).resolve(process.cwd(), 'src/styles.css'), 'utf8');
    expect(css).toMatch(/\.space-item\[aria-current\]::before/);

    // Checks belongs to no product: the space stays Notebook.
    await userEvent.setup().click(within(nav()).getByRole('link', { name: /^Checks:/ }));
    expect(window.location.pathname).toBe('/checks');
    expect(spaceLink('Notebook')).toHaveAttribute('aria-current', 'true');
    expect(within(panel()).getByRole('link', { name: 'Notes' })).toBeInTheDocument();
  });

  it('LA-BRW-T222 Choosing a space scopes the nav to its domains, capabilities and groups', async () => {
    await openApp('/DM', { workspace: spacesWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    expect(within(nav().querySelector<HTMLElement>('.nav-space')!).getByRole('link', { name: 'Demo shop' })).toHaveAttribute('href', '/DM');
    expect(within(within(panel()).getByRole('list', { name: 'Domains of Demo shop' })).getAllByRole('link', { name: /^(Paying|Shopping)$/ }).map((a) => a.textContent)).toEqual(['Paying', 'Shopping']);
    // Capabilities in their order, in their domain's Define › Use cases folder, before the use cases outside any capability.
    const user = userEvent.setup();
    await user.click(within(panel()).getByRole('button', { name: 'Unfold Shopping' }));
    await user.click(within(within(panel()).getByRole('list', { name: 'Folders of Shopping' })).getByRole('button', { name: /^Define/ }));
    await user.click(within(within(panel()).getByRole('list', { name: 'Define of Shopping' })).getByRole('button', { name: /^Capabilities/ }));
    expect(within(panel()).getByRole('list', { name: 'Capabilities of Shopping' }).textContent).toBe('Filling the basketPaying for the basketAdd an item to the basket');
    // The product's groups (its open questions and fitness records), in the meta-model's order.
    const groups = within(panel()).getByRole('list', { name: 'Groups of Demo shop' });
    expect(within(groups).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/DM/question', '/DM/fitness']);
    expect(within(nav()).queryByRole('link', { name: 'Notes' })).toBeNull();

    await userEvent.setup().click(spaceLink('Notebook'));
    expect(window.location.pathname).toBe('/NF');
    expect(within(nav().querySelector<HTMLElement>('.nav-space')!).getByRole('link', { name: 'Notebook' })).toHaveAttribute('href', '/NF');
    expect(within(panel()).getByRole('link', { name: 'Notes' })).toBeInTheDocument();
    expect(within(nav()).queryByRole('link', { name: 'Shopping' })).toBeNull();
    expect(within(nav()).queryByRole('list', { name: 'Groups of Demo shop' })).toBeNull();
  });

  it('LA-BRW-T223 Choosing a space opens the last page visited in it this session, or its product page', async () => {
    await openApp('/DM-SHOP-UC01', { workspace: spacesWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    const user = userEvent.setup();
    expect(spaceLink('Notebook')).toHaveAttribute('href', '/NF');
    await user.click(spaceLink('Notebook'));
    expect(window.location.pathname).toBe('/NF');
    await user.click(within(panel()).getByRole('link', { name: 'Notes' }));
    expect(window.location.pathname).toBe('/NF-NOTE');
    expect(spaceLink('Demo shop')).toHaveAttribute('href', '/DM-SHOP-UC01');
    await user.click(spaceLink('Demo shop'));
    expect(window.location.pathname).toBe('/DM-SHOP-UC01');
    await user.click(spaceLink('Notebook'));
    expect(window.location.pathname).toBe('/NF-NOTE');
    // Remembered for the session, not for ever.
    expect(JSON.parse(window.sessionStorage.getItem('lathe:space-pages')!)).toMatchObject({ DM: '/DM-SHOP-UC01', NF: '/NF-NOTE' });
    expect(window.localStorage.getItem('lathe:space-pages')).toBeNull();
  });

  it('LA-BRW-T224 Alt+1 to Alt+9 switch spaces in rail order, and the palette has a Switch to command for each', async () => {
    await openApp('/checks', { workspace: spacesWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Checks' });
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
    // Every other shortcut still works: Ctrl+Shift+M opens Checks.
    fireEvent.keyDown(document.body, { key: 'M', code: 'KeyM', ctrlKey: true, shiftKey: true });
    expect(window.location.pathname).toBe('/checks');

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

  it('LA-BRW-T225 Quick find lists the current space first, then everything else under a divider', async () => {
    const items = findItems(indexWorkspace(spacesWorkspace()), [{ slug: 'notes-diagram', title: 'Notes diagram', description: null }]);
    const scoped = rankScoped(items, 'not', 'NF');
    expect(scoped.here.map((i) => i.id)).toEqual(['NF', 'NF-NOTE']);
    expect(scoped.elsewhere.map((i) => i.id)).toContain('notes-diagram');
    expect(rankScoped(items, 'not', null).here).toEqual([]);

    await openApp('/DM', { workspace: spacesWorkspace(), diagrams: [{ slug: 'notes-diagram', title: 'Notes diagram', description: null }] });
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    const user = userEvent.setup();
    const find = within(nav()).getByRole('combobox', { name: 'Quick find' });
    await user.click(find);
    await user.type(find, 'basket');
    let list = within(nav()).getByRole('listbox', { name: 'Quick find results' });
    const groups = within(list).getAllByRole('group');
    expect(groups.map((g) => g.getAttribute('aria-label'))).toEqual(['In Demo shop']);

    await user.clear(find);
    await user.type(find, 'n');
    list = within(nav()).getByRole('listbox', { name: 'Quick find results' });
    const named = within(list).getAllByRole('group').map((g) => g.getAttribute('aria-label'));
    expect(named).toEqual(['In Demo shop', 'Everything else']);
    const [here, elsewhere] = within(list).getAllByRole('group');
    expect(within(here).getAllByRole('option').every((o) => o.querySelector('code')!.textContent!.startsWith('DM'))).toBe(true);
    expect(within(elsewhere).getAllByRole('option').map((o) => o.querySelector('code')!.textContent)).toEqual(expect.arrayContaining(['NF-NOTE', 'notes-diagram']));
    expect(elsewhere.closest('li')).toHaveClass('is-divided');
    // The arrow keys run through both groups as one list.
    const options = within(list).getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowUp}');
    expect(within(list).getAllByRole('option').at(-1)).toHaveAttribute('aria-selected', 'true');
  });

  it('LA-BRW-T226 Checks can be filtered to the current space', async () => {
    await openApp('/NF', { workspace: spacesWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Notebook' });
    await userEvent.setup().click(within(nav()).getByRole('link', { name: /^Checks:/ }));
    const scope = within(main()).getByRole('group', { name: 'Show checks for' });
    expect(within(scope).getByRole('link', { name: 'All products' })).toHaveAttribute('aria-current', 'true');
    expect(within(main()).getByText('3 errors · 3 warnings')).toBeInTheDocument();
    await userEvent.setup().click(within(scope).getByRole('link', { name: 'Notebook' }));
    expect(window.location.pathname + window.location.search).toBe('/checks?product=NF');
    expect(within(main()).getByText('1 error · 0 warnings')).toBeInTheDocument();
    expect(within(main()).getByText('Specs · checks in Notebook')).toBeInTheDocument();
    expect([...main().querySelectorAll('section li a')].map((a) => a.getAttribute('href'))).toEqual(['/NF-NOTE']);
    expect(within(main()).getByRole('link', { name: 'Notebook' })).toHaveAttribute('aria-current', 'true');
  });

  it('LA-BRW-T227 On a narrow screen the rail stays visible inside the nav drawer', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {} }));
    await openApp('/DM', { workspace: spacesWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    fireEvent.click(screen.getByRole('button', { name: 'Open the navigation' }));
    expect(nav()).toHaveClass('is-drawer');
    expect(within(rail()).getAllByRole('link')).toHaveLength(3);
    await userEvent.setup().click(spaceLink('Notebook'));
    expect(window.location.pathname).toBe('/NF');
    await waitFor(() => expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull());
  });
});
