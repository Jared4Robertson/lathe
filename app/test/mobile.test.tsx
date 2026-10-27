import './graph/setup';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { settle } from '../src/shell/BottomSheet';
import { useThemeColor } from '../src/shell/themeColor';
import { isTap } from '../src/graph/touch';
import { openApp } from './helpers';
import { testWorkspace } from './graph/workspace';
import { boxElement, drawnBox, pointOn, tapAt, tapEmpty } from './graph/scene';

// Lathe on a phone (notes/mobile-design.md): a compact top bar, the page bar compact under it, one
// view at a time, sheets for the nav, the side bar, the open pages and quick find, and taps that
// select before they open on the graph and the ERD. Proves LA-PLT-UC08-R01 to R07 and R09, LA-PLT-DR16,
// LA-EXP-DR42 and LA-PLT-DR17, and the side bar sheet of LA-EXP-UC05-R11.

const served = () => ({ data: testWorkspace() });

/** A phone: narrow, with a finger for a pointer (every media query matches, reduced motion included). */
function phone() {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {} }));
}

const topbar = () => document.querySelector<HTMLElement>('.topbar')!;
const pageBar = () => document.querySelector<HTMLElement>('.page-bar')!;
const segment = (name: string) => within(within(pageBar()).getByRole('group', { name: 'View' })).getByRole('button', { name });

describe('Lathe on a phone', () => {
  it('LA-PLT-T61 A phone shows a compact top bar with the title and a step up, and one view at a time switched from the page bar, leaving the views remembered for a wide screen alone', async () => {
    phone();
    window.localStorage.setItem('lathe:view', '"wiki,graph"');
    await openApp('/P-D-UC01?view=wiki,graph', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    // The top bar: the menu, the title on one line under a link one step up, and quick find.
    expect(within(topbar()).getByRole('button', { name: 'Open the navigation' })).toBeInTheDocument();
    expect(topbar().querySelector('.topbar-title')).toHaveTextContent('Lend a thing');
    expect(within(topbar()).getByRole('link', { name: 'Up to Lending' })).toHaveAttribute('href', '/P-D-CAP01?view=wiki,graph');
    expect(within(topbar()).getByRole('button', { name: 'Quick find' })).toBeInTheDocument();
    // One view: the first the address names; no pane headers and no handles.
    expect([...document.querySelectorAll('.pane')].map((p) => p.getAttribute('aria-label'))).toEqual(['Wiki pane']);
    expect(document.querySelector('.pane-bar')).toBeNull();
    expect(screen.queryAllByRole('separator').filter((s) => s.hasAttribute('aria-valuenow'))).toEqual([]);
    expect(segment('Wiki')).toHaveAttribute('aria-pressed', 'true');
    expect(segment('Graph')).toHaveAttribute('aria-pressed', 'false');
    // Switching shows the graph alone and says so in the address; the wide screen's views stay remembered.
    fireEvent.click(segment('Graph'));
    expect(window.location.search).toBe('?view=graph');
    await waitFor(() => expect([...document.querySelectorAll('.pane')].map((p) => p.getAttribute('aria-label'))).toEqual(['Graph pane']));
    expect(segment('Graph')).toHaveAttribute('aria-pressed', 'true');
    expect(window.localStorage.getItem('lathe:view')).toBe('"wiki,graph"');
    // A page that names no product parent goes up to all products; a domain up to its product.
    await openApp('/P-D?view=wiki', served());
    await waitFor(() => expect(topbar().querySelector('.topbar-title')).toHaveTextContent('Domain'));
    expect(within(topbar()).getByRole('link', { name: 'Up to Product' })).toHaveAttribute('href', '/P?view=wiki');
  });

  it('LA-PLT-T62 The side bar is a bottom sheet: it opens at half height with focus inside, its handle takes it to full height and back, Escape closes it and focus returns', async () => {
    phone();
    await openApp('/P-D-UC01', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    const toggle = within(pageBar()).getByRole('button', { name: 'Show the side bar' });
    fireEvent.click(toggle);
    const sheet = screen.getByRole('dialog', { name: 'Side bar' });
    expect(sheet).toHaveClass('bottom-sheet', 'is-half');
    expect(sheet).toHaveAttribute('aria-modal', 'true');
    await waitFor(() => expect(screen.getByRole('complementary', { name: 'Side bar' })).toHaveFocus());
    fireEvent.click(within(sheet).getByRole('button', { name: 'Expand the side bar to full height' }));
    expect(sheet).toHaveClass('is-full');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Shrink the side bar to half height' }));
    expect(sheet).toHaveClass('is-half');
    // Tab stays inside the sheet.
    const buttons = within(sheet).getAllByRole('button');
    buttons[buttons.length - 1].focus();
    fireEvent.keyDown(buttons[buttons.length - 1], { key: 'Tab' });
    expect(document.activeElement && sheet.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(sheet, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Side bar' })).toBeNull();
    await waitFor(() => expect(within(pageBar()).getByRole('button', { name: 'Show the side bar' })).toHaveFocus());
  });

  it('LA-PLT-T63 A drag on a sheet\'s handle settles by distance and speed: up to full height, down to half, down from half away', () => {
    expect(settle('half', -50, 0.1)).toBe('full');
    expect(settle('half', -10, 0.1)).toBe('half');
    expect(settle('half', -10, -1)).toBe('full');
    expect(settle('half', 40, 0.1)).toBe('half');
    expect(settle('half', 120, 0.1)).toBeNull();
    expect(settle('half', 30, 1)).toBeNull();
    expect(settle('full', 30, 0.1)).toBe('full');
    expect(settle('full', 100, 0.1)).toBe('half');
    expect(settle('full', 300, 0.1)).toBeNull();
  });

  it('LA-PLT-T64 The open pages are a sheet from the page bar: each tab a row, the active one marked, the preview one kept from its row; choosing one goes there, and a row closes its tab', async () => {
    phone();
    await openApp('/P-D-UC01', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    const pagesButton = () => within(pageBar()).getByRole('button', { name: /^Open pages: \d+$/ });
    expect(pagesButton()).toHaveAccessibleName('Open pages: 1');
    // The first page opens as the preview; keep it from its row.
    fireEvent.click(pagesButton());
    let sheet = screen.getByRole('dialog', { name: 'Open pages' });
    await waitFor(() => expect(within(sheet).getByRole('button', { current: 'page' })).toHaveFocus());
    fireEvent.click(within(sheet).getByRole('button', { name: 'Keep P-D-UC01 Lend a thing open' }));
    fireEvent.keyDown(sheet, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Open pages' })).toBeNull();
    await waitFor(() => expect(pagesButton()).toHaveFocus());
    // Another page opens in a second tab.
    await openApp('/P-V01', served());
    await screen.findByRole('heading', { level: 1, name: 'Loan desk' });
    expect(pagesButton()).toHaveAccessibleName('Open pages: 2');
    fireEvent.click(pagesButton());
    sheet = screen.getByRole('dialog', { name: 'Open pages' });
    const rows = within(within(sheet).getByRole('list', { name: 'Open pages' })).getAllByRole('listitem');
    expect(rows.map((r) => r.querySelector('.tab-title')!.textContent)).toEqual(['Lend a thing', 'Loan desk']);
    expect(within(sheet).getByRole('button', { current: 'page' })).toHaveTextContent('Loan desk');
    // Choosing a page goes there and closes the sheet.
    fireEvent.click(within(sheet).getByRole('button', { name: 'P-D-UC01 Lend a thing' }));
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    expect(screen.queryByRole('dialog', { name: 'Open pages' })).toBeNull();
    // A row's close button closes its tab.
    fireEvent.click(pagesButton());
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Open pages' })).getByRole('button', { name: /^Close P-V01 Loan desk/ }));
    await waitFor(() => expect(pagesButton()).toHaveAccessibleName('Open pages: 1'));
  });

  it('LA-PLT-T65 Quick find on a phone is a full-screen sheet: the results list under the box, choosing one goes there, Escape closes it and focus returns', async () => {
    phone();
    await openApp('/P-D-UC01', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    const open = within(topbar()).getByRole('button', { name: 'Quick find' });
    open.focus();
    fireEvent.click(open);
    const sheet = screen.getByRole('dialog', { name: 'Quick find' });
    const box = within(sheet).getByRole('combobox', { name: 'Quick find' });
    await waitFor(() => expect(box).toHaveFocus());
    fireEvent.change(box, { target: { value: 'loan desk' } });
    const results = within(sheet).getByRole('listbox', { name: 'Quick find results' });
    expect(results).toHaveClass('is-inline');
    fireEvent.mouseDown(within(results).getByRole('option', { name: /Loan desk/ }));
    expect(window.location.pathname).toBe('/P-V01');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Quick find' })).toBeNull());
    // Escape closes it, and focus goes back to the button.
    const again = within(topbar()).getByRole('button', { name: 'Quick find' });
    again.focus();
    fireEvent.click(again);
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Quick find' }), { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Quick find' })).toBeNull();
    await waitFor(() => expect(within(topbar()).getByRole('button', { name: 'Quick find' })).toHaveFocus());
  });

  it('LA-PLT-T66 The nav is a full-screen sheet that keeps Tab inside it', async () => {
    phone();
    await openApp('/P-D-UC01', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    fireEvent.click(within(topbar()).getByRole('button', { name: 'Open the navigation' }));
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(nav).toHaveClass('is-drawer');
    const focusable = [...nav.querySelectorAll<HTMLElement>('a[href], button, input')];
    focusable[focusable.length - 1].focus();
    fireEvent.keyDown(focusable[focusable.length - 1], { key: 'Tab' });
    expect(focusable[0]).toHaveFocus();
    fireEvent.keyDown(focusable[0], { key: 'Tab', shiftKey: true });
    expect(focusable[focusable.length - 1]).toHaveFocus();
  });

  it('LA-EXP-T133 By touch, a first tap on a graph node selects it and shows its name with an Open chip; a second tap or the chip opens it, and a tap on the canvas lets go', async () => {
    phone();
    window.sessionStorage.setItem('lathe:graph-settings', JSON.stringify({ layout: 'tree', depth: 1, trace: false, hiddenKinds: [], hiddenRelations: [], links: false, minimap: false }));
    await openApp('/P-D-UC01-R01?view=graph', served());
    // Links on, so the flow step that fulfills the UC requirement is drawn.
    fireEvent.click(await screen.findByRole('button', { name: 'Links' }));
    await waitFor(() => expect(boxElement('P-D-UC01-FL-S01')).not.toBeNull());
    const node = () => boxElement('P-D-UC01-FL-S01')!;
    // A finger's tap on the box drawn on the canvas.
    tapAt(pointOn('P-D-UC01-FL-S01'));
    expect(window.location.pathname).toBe('/P-D-UC01-R01');
    const card = await waitFor(() => { const c = document.querySelector<HTMLElement>('.tap-card'); expect(c).not.toBeNull(); return c!; });
    expect(card).toHaveAttribute('role', 'status');
    expect(card).toHaveTextContent('Librarian lends the thing');
    expect(node()).toHaveClass('is-armed');
    expect(drawnBox('P-D-UC01-FL-S01')!.armed).toBe(true);
    // A tap on the canvas lets go.
    tapEmpty();
    await waitFor(() => expect(document.querySelector('.tap-card')).toBeNull());
    // The chip opens it (selected again, here by the box in the keyboard's layer).
    fireEvent.click(node());
    fireEvent.click(screen.getByRole('button', { name: 'Open Librarian lends the thing' }));
    expect(window.location.pathname).toBe('/P-D-UC01-FL-S01');
    // A click that says it came from a mouse opens at once; a finger's or a pen's selects first.
    expect(isTap({ pointerType: 'mouse' } as unknown as Event, true)).toBe(false);
    expect(isTap({ pointerType: 'touch' } as unknown as Event, false)).toBe(true);
    expect(isTap({ pointerType: 'pen' } as unknown as Event, false)).toBe(true);
    expect(isTap({ pointerType: '' } as unknown as Event, true)).toBe(true);
    expect(isTap({ pointerType: '' } as unknown as Event, false)).toBe(false);
  });

  it('LA-PLT-T67 The theme-color meta follows the theme\'s --sheet token', async () => {
    function Host() { useThemeColor(); const r = useRef(null); return <div ref={r} />; }
    document.documentElement.style.setProperty('--sheet', '#123456');
    render(<Host />);
    const meta = () => document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')!;
    expect(meta().content).toBe('#123456');
    await act(async () => {
      document.documentElement.style.setProperty('--sheet', '#abcdef');
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(meta().content).toBe('#abcdef');
    document.documentElement.style.removeProperty('--sheet');
  });
});
