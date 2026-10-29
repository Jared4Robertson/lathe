import './graph/setup';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { settle } from '../src/shell/BottomSheet';
import { useThemeColor } from '../src/shell/themeColor';
import { isTap } from '../src/graph/touch';
import { desktopBridgeStub, openApp } from './helpers';
import { navigate } from '../src/router';
import { testWorkspace } from './graph/workspace';
import { boxElement, drawnBox, pointOn, tapAt, tapEmpty } from './graph/scene';

// Lathe on a phone (notes/mobile-design.md): a compact top bar, the page bar compact under it, the
// stage full screen, sheets for the nav, the wiki card, the open pages and quick find, and taps that
// select before they open on the graph and the ERD. Proves LA-V61-R17 to R07 and R09, LA-V61-R18,
// LA-V93-R02 and LA-V61-R42.

const served = () => ({ data: testWorkspace() });

/** A phone: narrow, with a finger for a pointer (every media query matches, reduced motion included). */
function phone() {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {} }));
}

const topbar = () => document.querySelector<HTMLElement>('.topbar')!;
const pageBar = () => document.querySelector<HTMLElement>('.page-bar')!;
const segment = (name: string) => within(within(pageBar()).getByRole('group', { name: 'Stage' })).getByRole('button', { name });

describe('Lathe on a phone', () => {
  const proveLaV61R17T01 = async () => {
    phone();
    window.localStorage.setItem('lathe:stage', '"trace"');
    await openApp('/P-D-UC01?stage=graph', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    // The top bar: the menu, the title on one line under a link one step up, and quick find.
    expect(within(topbar()).getByRole('button', { name: 'Open the navigation' })).toBeInTheDocument();
    expect(topbar().querySelector('.topbar-title')).toHaveTextContent('Lend a thing');
    expect(within(topbar()).getByRole('link', { name: 'Up to Lending' })).toHaveAttribute('href', '/P-D-CAP01?stage=graph');
    expect(within(topbar()).getByRole('button', { name: 'Quick find' })).toBeInTheDocument();
    // Under it the compact page bar and the header strip; the stage fills the rest. No panels float, no handles.
    expect(document.querySelector('.stage-layout.is-phone > .header-strip')).not.toBeNull();
    expect(screen.getByRole('region', { name: 'Graph stage' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Wiki card' })).toBeNull();
    expect(screen.queryAllByRole('separator').filter((s) => s.hasAttribute('aria-valuenow'))).toEqual([]);
    expect(within(within(pageBar()).getByRole('group', { name: 'Stage' })).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Graph', 'ERD', 'Trace']);
    expect(segment('Graph')).toHaveAttribute('aria-pressed', 'true');
    // Switching shows the ERD and says so in the address; the wide screen's remembered stage stays.
    fireEvent.click(segment('ERD'));
    expect(window.location.search).toBe('?stage=erd');
    expect(await screen.findByRole('region', { name: 'ERD stage' })).toBeInTheDocument();
    expect(segment('ERD')).toHaveAttribute('aria-pressed', 'true');
    expect(window.localStorage.getItem('lathe:stage')).toBe('"trace"');
    // The wiki card is a bottom sheet, opened from the page bar, over the stage.
    fireEvent.click(within(pageBar()).getByRole('button', { name: 'Show the wiki card' }));
    const sheet = screen.getByRole('dialog', { name: 'Wiki card' });
    expect(sheet).toHaveClass('bottom-sheet', 'is-half');
    expect(within(sheet).getByRole('region', { name: 'Wiki card' })).toHaveAttribute('data-page', 'P-D-UC01');
    fireEvent.keyDown(sheet, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Wiki card' })).toBeNull();
    // A page that names no product parent goes up to all products; a domain up to its product.
    await openApp('/P-D?stage=graph', served());
    await waitFor(() => expect(topbar().querySelector('.topbar-title')).toHaveTextContent('Domain'));
    expect(within(topbar()).getByRole('link', { name: 'Up to Product' })).toHaveAttribute('href', '/P?stage=graph');
  };
  it('LA-V61-R17-T01 A phone shows a compact top bar with the title and a step up, the header strip, and the stage full screen switched from the page bar, leaving the stage remembered for a wide screen alone', proveLaV61R17T01);
  it('LA-V61-R18-T01 A phone shows the stage full screen, the wiki card a bottom sheet from the page bar', proveLaV61R17T01);

  it('LA-V61-R20-T01 The wiki card is a bottom sheet: it opens at half height with focus inside, its handle takes it to full height and back, Escape closes it and focus returns', async () => {
    phone();
    await openApp('/P-D-UC01', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    const toggle = within(pageBar()).getByRole('button', { name: 'Show the wiki card' });
    toggle.focus();
    fireEvent.click(toggle);
    const sheet = screen.getByRole('dialog', { name: 'Wiki card' });
    expect(sheet).toHaveClass('bottom-sheet', 'is-half');
    expect(sheet).toHaveAttribute('aria-modal', 'true');
    await waitFor(() => expect(document.activeElement && sheet.contains(document.activeElement)).toBe(true));
    // Its handle takes it to full height and back.
    fireEvent.click(within(sheet).getByRole('button', { name: 'Expand the wiki card to full height' }));
    expect(sheet).toHaveClass('is-full');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Shrink the wiki card to half height' }));
    expect(sheet).toHaveClass('is-half');
    // Tab stays inside the sheet.
    const buttons = within(sheet).getAllByRole('button');
    buttons[buttons.length - 1].focus();
    fireEvent.keyDown(buttons[buttons.length - 1], { key: 'Tab' });
    expect(document.activeElement && sheet.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(sheet, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Wiki card' })).toBeNull();
    await waitFor(() => expect(within(pageBar()).getByRole('button', { name: 'Show the wiki card' })).toHaveFocus());
  });

  it('LA-V61-R20-T02 A drag on a sheet\'s handle settles by distance and speed: up to full height, down to half, down from half away', () => {
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

  it('LA-V61-R21-T01 In the desktop app, the open pages are a sheet from the page bar: each tab a row, the active one marked; choosing one goes there, and a row\'s close button closes its tab', async () => {
    phone();
    // On the web a browser tab is one place: no Open pages button.
    await openApp('/P-D-UC01', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    expect(within(pageBar()).queryByRole('button', { name: /^Open pages/ })).toBeNull();
    const host = window as unknown as { latheDesktop?: LatheDesktop };
    host.latheDesktop = desktopBridgeStub();
    try {
      await openApp('/P-D-UC01', served());
      await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
      const pagesButton = () => within(pageBar()).getByRole('button', { name: /^Open pages: \d+$/ });
      expect(pagesButton()).toHaveAccessibleName('Open pages: 1');
      fireEvent.click(pagesButton());
      let sheet = screen.getByRole('dialog', { name: 'Open pages' });
      await waitFor(() => expect(within(sheet).getByRole('button', { current: 'page' })).toHaveFocus());
      expect(within(sheet).queryByRole('button', { name: /^Keep/ })).toBeNull();
      fireEvent.keyDown(sheet, { key: 'Escape' });
      expect(screen.queryByRole('dialog', { name: 'Open pages' })).toBeNull();
      await waitFor(() => expect(pagesButton()).toHaveFocus());
      // A new tab, moved to another page.
      fireEvent.keyDown(document.body, { key: 'T', code: 'KeyT', altKey: true, shiftKey: true });
      await waitFor(() => expect(pagesButton()).toHaveAccessibleName('Open pages: 2'));
      act(() => navigate('/P-V01'));
      await screen.findByRole('heading', { level: 1, name: 'Loan desk' });
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
    } finally {
      delete host.latheDesktop;
    }
  });

  it('LA-V61-R22-T01 Quick find on a phone is a full-width sheet at the top: the results list under the box, choosing one goes there, Close or Escape closes it and focus returns', async () => {
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
    expect(within(sheet).getByRole('button', { name: 'Close' })).toBeInTheDocument();
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

  it('LA-V61-R19-T01 The nav is a full-screen sheet that keeps Tab inside it', async () => {
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

  const proveLaV61R23T01 = async () => {
    phone();
    window.sessionStorage.setItem('lathe:place', JSON.stringify({ depth: 1, hiddenKinds: [], card: { open: true, expanded: true } }));
    await openApp('/P-D-UC01-R01?stage=graph', served());
    // The requirement's use case, its parent, is drawn beside it.
    await waitFor(() => expect(boxElement('P-D-UC01')).not.toBeNull());
    const node = () => boxElement('P-D-UC01')!;
    // A finger's tap on the box drawn on the canvas.
    tapAt(pointOn('P-D-UC01'));
    expect(window.location.pathname).toBe('/P-D-UC01-R01');
    const card = await waitFor(() => { const c = document.querySelector<HTMLElement>('.card[role="status"]'); expect(c).not.toBeNull(); return c!; });
    expect(card).toHaveTextContent('Lend a thing');
    // The card is one button, its title, named for what it does.
    const [title, letGo] = within(card).getAllByRole('button');
    expect(title).toHaveAccessibleName(/^Open .*Lend a thing$/);
    expect(letGo).toHaveAccessibleName('Let go of the selection');
    expect(node()).toHaveClass('is-armed');
    expect(drawnBox('P-D-UC01')!.armed).toBe(true);
    // A tap on the canvas lets go.
    tapEmpty();
    await waitFor(() => expect(document.querySelector('.card[role="status"]')).toBeNull());
    // A tap on the card opens it (selected again, here by the box in the keyboard's layer).
    fireEvent.click(node());
    fireEvent.click(screen.getByRole('button', { name: /^Open .*Lend a thing$/ }));
    expect(window.location.pathname).toBe('/P-D-UC01');
    // A click that says it came from a mouse opens at once; a finger's or a pen's selects first.
    expect(isTap({ pointerType: 'mouse' } as unknown as Event, true)).toBe(false);
    expect(isTap({ pointerType: 'touch' } as unknown as Event, false)).toBe(true);
    expect(isTap({ pointerType: 'pen' } as unknown as Event, false)).toBe(true);
    expect(isTap({ pointerType: '' } as unknown as Event, true)).toBe(true);
    expect(isTap({ pointerType: '' } as unknown as Event, false)).toBe(false);
  };
  it('LA-V61-R23-T01 By touch, a first tap on a graph node selects it and a second tap or a tap on its card opens it', proveLaV61R23T01);
  it('LA-V93-R02-T01 By touch, a first tap on a graph node selects it and a second tap or a tap on its card opens it', proveLaV61R23T01);

  it('LA-V61-R25-T01 The theme-color meta follows the theme\'s --sheet token', async () => {
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
