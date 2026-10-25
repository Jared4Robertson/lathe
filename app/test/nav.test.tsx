import './graph/setup';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { rankItems, findItems } from '../src/shell/QuickFind';
import { indexWorkspace } from '../src/specs/data';
import { workspace } from './fixtures/workspace';
import { openApp } from './helpers';

// The side navigation: a rail when collapsed, a drawer on narrow screens, folding sections, the
// current place, quiet badges, a footer, and quick find.

const nav = () => screen.getByRole('navigation', { name: 'Main' });
const diagrams = [{ slug: 'people', title: 'People and tools with a long name that is cut short', description: null }];

describe('side navigation', () => {
  it('LA-BRW-T127 The nav collapses to a rail of icons with tooltips, is remembered, and expands again', async () => {
    await openApp('/DM', { diagrams });
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    fireEvent.click(within(nav()).getByRole('button', { name: 'Collapse the navigation' }));
    expect(nav().className).toContain('is-rail');
    expect(document.querySelector('.app')!.className).toContain('nav-collapsed');
    // Each rail item names itself in a tooltip on keyboard focus, with its keys.
    for (const [name, tip] of [['Lathe home', 'Lathe home g then h'], ['Diagrams', 'Diagrams g then d'], ['Expand the navigation', 'Expand the navigation Ctrl+B']]) {
      fireEvent.keyDown(document.body, { key: 'Tab', code: 'Tab' });
      fireEvent.focus(within(nav()).getByLabelText(name));
      expect(screen.getByRole('tooltip'), name).toHaveTextContent(tip);
      fireEvent.blur(within(nav()).getByLabelText(name));
    }
    fireEvent.keyDown(document.body, { key: 'Tab', code: 'Tab' });
    fireEvent.focus(within(nav()).getByRole('link', { name: /^Checks for all products: \d+ errors?, \d+ warning/ }));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Checks for all products Ctrl+Shift+M');
    expect(window.localStorage.getItem('lathe:nav-collapsed')).toBe('true');

    // Remembered on the next visit; the rail still lists the spaces, and expands again.
    await openApp('/checks');
    await screen.findByRole('heading', { level: 1, name: 'Checks' });
    expect(nav().className).toContain('is-rail');
    expect(within(within(nav()).getByRole('list', { name: 'Spaces' })).getAllByRole('link').map((a) => a.getAttribute('aria-label'))).toEqual(['Demo shop', 'Notebook']);
    fireEvent.click(within(nav()).getByRole('button', { name: 'Expand the navigation' }));
    expect(nav().className).not.toContain('is-rail');
    expect(within(nav().querySelector<HTMLElement>('.nav-space')!).getByRole('link', { name: 'Demo shop' })).toHaveAttribute('href', '/DM');
  });

  it('LA-BRW-T128 On a narrow screen the nav is a full-screen sheet opened from a menu button, closed by Escape, a click outside or choosing a page', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {} }));
    await openApp('/DM');
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();
    const menu = screen.getByRole('button', { name: 'Open the navigation' });
    fireEvent.click(menu);
    expect(nav().className).toContain('is-drawer');
    await waitFor(() => expect(within(nav()).getByRole('combobox', { name: 'Quick find' })).toHaveFocus());
    fireEvent.keyDown(within(nav()).getByRole('combobox', { name: 'Quick find' }), { key: 'Escape' });
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();
    await waitFor(() => expect(menu).toHaveFocus());

    fireEvent.click(menu);
    fireEvent.mouseDown(document.querySelector('.drawer-backdrop')!);
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();

    fireEvent.click(menu);
    await userEvent.setup().click(within(nav()).getByRole('link', { name: 'Shopping' }));
    expect(window.location.pathname).toBe('/DM-SHOP');
    await waitFor(() => expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull());
  });

  it('LA-BRW-T129 Sections fold on their own, the current place is marked and its section opens itself, counts are quiet badges, and the footer says where the specs come from', async () => {
    await openApp('/DM-SHOP', { diagrams });
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    const head = (name: RegExp) => within(nav()).getByRole('button', { name });
    for (const name of [/^Diagrams/, /^Tools/]) expect(head(name)).toHaveAttribute('aria-expanded', 'true');
    // The current space has no heading of its own: its overview is its first row.
    expect(within(nav()).queryByRole('button', { name: /^Demo shop/ })).toBeNull();
    expect(nav().querySelector('.nav-space a')).toHaveAttribute('href', '/DM');
    fireEvent.click(head(/^Diagrams/));
    expect(head(/^Diagrams/)).toHaveAttribute('aria-expanded', 'false');
    expect(within(nav()).queryByRole('link', { name: /People and tools/ })).toBeNull();

    // Opening a page in a folded section opens it, and marks the page.
    await openApp('/diagrams/people', { diagrams });
    expect(head(/^Diagrams/)).toHaveAttribute('aria-expanded', 'true');
    await openApp('/DM-PAY');
    await screen.findByRole('heading', { level: 1, name: 'Paying' });
    expect(within(nav()).getByRole('link', { name: 'Paying' })).toHaveAttribute('aria-current', 'page');

    // Long names are cut with a tooltip; checks show errors and warnings apart; the footer.
    await openApp('/diagrams/people', { diagrams });
    expect(within(nav()).getByRole('link', { name: /People and tools/ })).toHaveAttribute('title', diagrams[0].title);
    const checks = within(nav()).getByRole('link', { name: /^Checks:/ });
    expect(checks.querySelector('.nav-badge.error')).toHaveTextContent(String(workspace().problems.filter((p) => p.severity === 'error').length));
    expect(checks.querySelector('.nav-badge.warning')).not.toBeNull();
    const foot = nav().querySelector('footer')!;
    // The record format left the footer (LA-BRW-UC115): it is a command and a link in the shortcuts sheet.
    expect(within(foot).queryByRole('link', { name: 'Record format' })).toBeNull();
    expect(foot).toHaveTextContent('Specs read by the engine');
  });

  it('LA-BRW-T130 Quick find jumps to any record, domain, product or diagram by ID or title, with arrow keys and Enter', async () => {
    const index = indexWorkspace(workspace());
    const items = findItems(index, diagrams);
    expect(rankItems(items, 'dm-shop')[0].id).toBe('DM-SHOP');
    expect(rankItems(items, 'basket').map((i) => i.id)).toContain('DM-SHOP-A1');
    expect(rankItems(items, 'people')[0].to).toBe('/diagrams/people');
    expect(rankItems(items, 'shopping')[0].to).toBe('/DM-SHOP');

    await openApp('/checks', { diagrams });
    const user = userEvent.setup();
    const find = within(nav()).getByRole('combobox', { name: 'Quick find' });
    await user.click(find);
    await user.type(find, 'basket');
    const options = within(nav()).getAllByRole('option');
    expect(options.length).toBeGreaterThan(1);
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowDown}');
    expect(within(nav()).getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
    const second = within(nav()).getAllByRole('option')[1].querySelector('code')!.textContent!;
    await user.keyboard('{Enter}');
    expect(window.location.pathname).toContain(second);
    expect(find).toHaveValue('');
  });

  it('LA-BRW-T179 The nav has no Graph item, open or as a rail; the graph stays one view, Ctrl+2 or a palette command away, and /graph still redirects', async () => {
    await openApp('/DM-SHOP', { diagrams });
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    expect(within(nav()).queryByRole('link', { name: /Graph/ })).toBeNull();
    expect(within(nav()).queryByText('Graph')).toBeNull();
    fireEvent.click(within(nav()).getByRole('button', { name: 'Collapse the navigation' }));
    expect(within(nav()).queryByLabelText('Graph')).toBeNull();
    fireEvent.click(within(nav()).getByRole('button', { name: 'Expand the navigation' }));

    // The page's Graph view and Ctrl+2.
    expect(within(screen.getByRole('group', { name: 'View' })).getByRole('button', { name: 'Graph' })).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: '2', code: 'Digit2', ctrlKey: true });
    expect(window.location.search).toBe('?view=wiki,graph');

    // The command palette.
    fireEvent.keyDown(document.body, { key: 'P', code: 'KeyP', ctrlKey: true, shiftKey: true });
    const user = userEvent.setup();
    await user.type(within(screen.getByRole('dialog', { name: 'Command palette' })).getByRole('combobox'), 'graph view');
    expect(within(screen.getByRole('dialog')).getAllByRole('option')[0]).toHaveTextContent('Graph view');

    await openApp('/graph');
    await waitFor(() => expect(window.location.pathname + window.location.search).toBe('/DM?view=graph'));
  });

  it('LA-BRW-T471 A selected row is the whole row: the current page\'s nav row carries the selection over the panel\'s width, chevron included, with no inset bar', async () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    // A domain's page: its row (fold chevron and link) is the one selected element.
    await openApp('/DM-SHOP');
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    const selected = [...nav().querySelectorAll<HTMLElement>('.is-selected')];
    expect(selected).toHaveLength(1);
    const row = selected[0];
    expect(row).toHaveClass('nav-row');
    const link = within(row).getByRole('link', { name: 'Shopping' });
    expect(link).toHaveAttribute('aria-current', 'page');
    expect(within(row).getByRole('button', { name: /^(Fold|Unfold) Shopping$/ })).toBeInTheDocument();
    // Rows are indented by padding for their depth, the lists nested for screen readers with no margins of their own.
    expect(row.style.getPropertyValue('--depth')).toBe('0');
    expect(row.closest('ul')).not.toBeNull();
    // A record's row, deeper in: also one selected row, holding the link, indented deeper.
    await openApp('/DM-SHOP-UC01');
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    const deep = nav().querySelector<HTMLElement>('.nav-row.is-selected')!;
    expect(within(deep).getByRole('link')).toHaveAttribute('aria-current', 'page');
    expect(Number(deep.style.getPropertyValue('--depth'))).toBeGreaterThan(0);
    // The stylesheet: the row spans the panel and takes the selection tint and steel text; no inset bar; lists add no indent.
    expect(css).toMatch(/\.nav-row \{[^}]*width: 100%;[^}]*padding: 0 10px 0 calc\(var\(--nav-pad\) \+ var\(--depth\) \* var\(--nav-indent\)\)/);
    expect(css).toMatch(/\.nav-row\.is-selected, \.nav-row\.is-selected:hover \{[^}]*background-color: var\(--steel-bg\);[^}]*color: var\(--steel\)/);
    expect(css).toMatch(/\.nav-scroll \{[^}]*margin: 0 -10px/);
    expect(css).toMatch(/\.menu \.nav-tree \{ margin: 0; padding: 0; \}/);
    expect(css).not.toMatch(/aria-current="page"\][^{]*\{[^}]*inset 3px/);
    // Hover tints the whole row; keyboard focus outlines it with 1 px of steel.
    expect(css).toMatch(/\.nav-row:hover \{[^}]*background-color: var\(--hover-bg\)/);
    expect(css).toMatch(/\.menu\.is-keyboard:focus-within \.nav-row\.is-selected \{[^}]*outline: 1px solid var\(--steel\)/);
  });
});
