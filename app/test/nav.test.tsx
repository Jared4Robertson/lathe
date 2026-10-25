import './graph/setup';
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
    await openApp('/specs/DM', { diagrams });
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    fireEvent.click(within(nav()).getByRole('button', { name: 'Collapse the navigation' }));
    expect(nav().className).toContain('is-rail');
    expect(document.querySelector('.app')!.className).toContain('nav-collapsed');
    // Each rail item names itself in a tooltip on keyboard focus, with its keys.
    for (const [name, tip] of [['Lathe home', 'Lathe home g then h'], ['Diagrams', 'Diagrams g then d'], ['Record format', 'Record format g then f'], ['Expand the navigation', 'Expand the navigation Ctrl+B']]) {
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
    expect(within(nav().querySelector<HTMLElement>('.nav-space')!).getByRole('link', { name: 'Demo shop' })).toHaveAttribute('href', '/specs/DM');
  });

  it('LA-BRW-T128 On a narrow screen the nav is a drawer opened from a menu button, closed by Escape, a click outside or choosing a page', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {} }));
    await openApp('/specs/DM');
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
    expect(window.location.pathname).toBe('/specs/DM/DM-SHOP');
    await waitFor(() => expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull());
  });

  it('LA-BRW-T129 Sections fold on their own, the current place is marked and its section opens itself, counts are quiet badges, and the footer links the format', async () => {
    await openApp('/specs/DM/DM-SHOP', { diagrams });
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    const head = (name: RegExp) => within(nav()).getByRole('button', { name });
    for (const name of [/^Diagrams/, /^Tools/]) expect(head(name)).toHaveAttribute('aria-expanded', 'true');
    // The current space has no heading of its own: its overview is its first row.
    expect(within(nav()).queryByRole('button', { name: /^Demo shop/ })).toBeNull();
    expect(nav().querySelector('.nav-space a')).toHaveAttribute('href', '/specs/DM');
    fireEvent.click(head(/^Diagrams/));
    expect(head(/^Diagrams/)).toHaveAttribute('aria-expanded', 'false');
    expect(within(nav()).queryByRole('link', { name: /People and tools/ })).toBeNull();

    // Opening a page in a folded section opens it, and marks the page.
    await openApp('/diagrams/people', { diagrams });
    expect(head(/^Diagrams/)).toHaveAttribute('aria-expanded', 'true');
    await openApp('/specs/DM/DM-PAY');
    await screen.findByRole('heading', { level: 1, name: 'Paying' });
    expect(within(nav()).getByRole('link', { name: 'Paying' })).toHaveAttribute('aria-current', 'page');

    // Long names are cut with a tooltip; checks show errors and warnings apart; the footer.
    await openApp('/diagrams/people', { diagrams });
    expect(within(nav()).getByRole('link', { name: /People and tools/ })).toHaveAttribute('title', diagrams[0].title);
    const checks = within(nav()).getByRole('link', { name: /^Checks:/ });
    expect(checks.querySelector('.nav-badge.error')).toHaveTextContent(String(workspace().problems.filter((p) => p.severity === 'error').length));
    expect(checks.querySelector('.nav-badge.warning')).not.toBeNull();
    const foot = nav().querySelector('footer')!;
    expect(within(foot).getByRole('link', { name: 'Record format' })).toHaveAttribute('href', '/format');
    expect(foot).toHaveTextContent('Specs read by the engine');
  });

  it('LA-BRW-T130 Quick find jumps to any record, domain, product or diagram by ID or title, with arrow keys and Enter', async () => {
    const index = indexWorkspace(workspace());
    const items = findItems(index, diagrams);
    expect(rankItems(items, 'dm-shop')[0].id).toBe('DM-SHOP');
    expect(rankItems(items, 'basket').map((i) => i.id)).toContain('DM-SHOP-A1');
    expect(rankItems(items, 'people')[0].to).toBe('/diagrams/people');
    expect(rankItems(items, 'shopping')[0].to).toBe('/specs/DM/DM-SHOP');

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
    await openApp('/specs/DM/DM-SHOP', { diagrams });
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    expect(within(nav()).queryByRole('link', { name: /Graph/ })).toBeNull();
    expect(within(nav()).queryByText('Graph')).toBeNull();
    fireEvent.click(within(nav()).getByRole('button', { name: 'Collapse the navigation' }));
    expect(within(nav()).queryByLabelText('Graph')).toBeNull();
    fireEvent.click(within(nav()).getByRole('button', { name: 'Expand the navigation' }));

    // The page's Graph view and Ctrl+2.
    expect(within(screen.getByRole('group', { name: 'View' })).getByRole('button', { name: /Graph/ })).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: '2', code: 'Digit2', ctrlKey: true });
    expect(window.location.search).toBe('?view=graph');

    // The command palette.
    fireEvent.keyDown(document.body, { key: 'P', code: 'KeyP', ctrlKey: true, shiftKey: true });
    const user = userEvent.setup();
    await user.type(within(screen.getByRole('dialog', { name: 'Command palette' })).getByRole('combobox'), 'graph view');
    expect(within(screen.getByRole('dialog')).getAllByRole('option')[0]).toHaveTextContent('Graph view');

    await openApp('/graph');
    await waitFor(() => expect(window.location.pathname + window.location.search).toBe('/specs/DM?view=graph'));
  });
});
