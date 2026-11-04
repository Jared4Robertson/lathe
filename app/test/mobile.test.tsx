import './graph/setup';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { settle } from '../src/shell/BottomSheet';
import { LANDSCAPE_QUERY } from '../src/shell/useNarrow';
import { useThemeColor } from '../src/shell/themeColor';
import { checksPanel, desktopBridgeStub, openApp } from './helpers';
import { navigate } from '../src/router';
import { testWorkspace } from './graph/workspace';
import { boxElement, cameraOf, canvasOf, pointOn, tapEmpty } from './graph/scene';
import { erdDrawn, erdHost, erdScene } from './erd-scene';
import type { LatheDesktop } from '../src/shell/desktop-bridge';

// Lathe on a phone (notes/mobile-design.md): a compact top bar, the page bar compact under it, the
// stage full screen, sheets for the nav, the wiki card, the open pages and quick find, and a tap that
// opens a node at once on the graph and the ERD, as a click does. Proves LA-V61-R17 to R07 and R09, LA-V61-R18,
// LA-V93-R02 and LA-V61-R42.

const served = () => ({ data: testWorkspace() });

/** A phone: narrow, with a finger for a pointer (every media query matches, reduced motion included), upright unless on its side. */
function phone({ landscape = false } = {}) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === LANDSCAPE_QUERY ? landscape : true, media: query, addEventListener: () => {}, removeEventListener: () => {} }));
  // The place starts as the app's does, its card a summary (Less), so its sheet opens at half height (test/setup.ts expands it).
  window.sessionStorage.setItem('lathe:place', JSON.stringify({ depth: 1, hiddenKinds: [], card: { open: true, expanded: false } }));
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

  it('LA-V61-R20-T03 More takes the wiki card\'s sheet to full height under the top bar and Less back to half; a tap on the backdrop goes to half, then closes it', async () => {
    phone();
    await openApp('/P-D-UC01', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    // The top bar and the compact page bar mark where a full sheet stops, so they stay in reach.
    expect(topbar()).toHaveAttribute('data-top-bar');
    expect(pageBar()).toHaveAttribute('data-top-bar');
    fireEvent.click(within(pageBar()).getByRole('button', { name: 'Show the wiki card' }));
    const sheet = screen.getByRole('dialog', { name: 'Wiki card' });
    expect(sheet).toHaveClass('is-half');
    expect(sheet.style.getPropertyValue('--sheet-top')).toMatch(/^\d+px$/);
    const backdrop = document.querySelector<HTMLElement>('.sheet-backdrop')!;
    expect(backdrop.style.getPropertyValue('--sheet-top')).toBe(sheet.style.getPropertyValue('--sheet-top'));
    // More: the whole page, at full height; Less: the summary, at half.
    fireEvent.click(within(sheet).getByRole('button', { name: 'More' }));
    expect(sheet).toHaveClass('is-full');
    expect(within(sheet).getByRole('button', { name: 'Less' })).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Less' }));
    expect(sheet).toHaveClass('is-half');
    // The handle moves between the two, and More and Less follow it.
    fireEvent.click(within(sheet).getByRole('button', { name: 'Expand the wiki card to full height' }));
    expect(sheet).toHaveClass('is-full');
    expect(within(sheet).getByRole('button', { name: 'Less' })).toBeInTheDocument();
    // A tap on the backdrop: back to half, then away.
    fireEvent.click(backdrop);
    expect(sheet).toHaveClass('is-half');
    expect(within(sheet).getByRole('button', { name: 'More' })).toBeInTheDocument();
    fireEvent.click(document.querySelector('.sheet-backdrop')!);
    expect(screen.queryByRole('dialog', { name: 'Wiki card' })).toBeNull();
    // The backdrop starts at the top bar's foot, a full sheet a touch target below it, so a tap above the sheet still reaches the backdrop; both sit under the nav drawer.
    const css = readFileSync(join(__dirname, '..', 'src', 'styles.css'), 'utf8');
    expect(css).toMatch(/\.sheet-backdrop \{[^}]*inset: var\(--sheet-top, 0px\) 0 0;[^}]*z-index: 60;/);
    expect(css).toMatch(/\.bottom-sheet \{ --sheet-full: calc\(100dvh - max\(var\(--sheet-top, 0px\) \+ var\(--touch-target\)[^}]*z-index: 65;/);
    expect(css).toMatch(/\.bottom-sheet\.is-full \{ height: var\(--sheet-full\); \}/);
    expect(css).toMatch(/\.menu\.is-drawer \{[^}]*z-index: 80;/);
  });

  it('LA-V61-R20-T04 On a phone on its side the wiki card\'s sheet opens at full height, and a tap on the backdrop closes it', async () => {
    phone({ landscape: true });
    await openApp('/P-D-UC01', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    fireEvent.click(within(pageBar()).getByRole('button', { name: 'Show the wiki card' }));
    const sheet = screen.getByRole('dialog', { name: 'Wiki card' });
    expect(sheet).toHaveClass('is-full');
    // Its summary still opens first, at full height; the handle has nothing to toggle, so it is no button.
    expect(within(sheet).getByRole('button', { name: 'More' })).toBeInTheDocument();
    expect(within(sheet).queryByRole('button', { name: /to (full|half) height$/ })).toBeNull();
    // On its side the full sheet reaches right up to the top bar, its grip slim, so the text starts on the first screen.
    const css = readFileSync(join(__dirname, '..', 'src', 'styles.css'), 'utf8');
    expect(css).toMatch(/@media \(orientation: landscape\) \{\s*\.bottom-sheet \{ --sheet-full: calc\(100dvh - max\(var\(--sheet-top, 0px\), env\(safe-area-inset-top\) \+ 8px\)\); \}\s*\.sheet-grab > span\.sheet-handle \{ min-height: 20px; \}/);
    // A tap on the backdrop closes it at once: it has no half.
    fireEvent.click(document.querySelector('.sheet-backdrop')!);
    expect(screen.queryByRole('dialog', { name: 'Wiki card' })).toBeNull();
  });

  it('LA-V90-R76-T01 On a phone the nav sheet shows Checks and Changes in its footer, each opening its tool and closing the drawer', async () => {
    phone();
    await openApp('/P-D-UC01', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    // The card's sheet is open; a tool opened from the nav takes its place, one sheet at a time.
    fireEvent.click(within(pageBar()).getByRole('button', { name: 'Show the wiki card' }));
    expect(screen.getByRole('dialog', { name: 'Wiki card' })).toBeInTheDocument();
    fireEvent.click(within(topbar()).getByRole('button', { name: 'Open the navigation' }));
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const foot = nav.querySelector<HTMLElement>('.nav-foot')!;
    // In the footer, always in sight, before Appearance; not in a Tools section scrolled away below the rows.
    expect(within(foot).getAllByRole('link').map((a) => a.querySelector('.nav-label')?.textContent)).toEqual(['Checks', 'Changes', 'Appearance']);
    expect(within(nav).queryByRole('button', { name: /^Tools/ })).toBeNull();
    expect(within(foot).getByRole('link', { name: /^Changes \d+ records? changed$/ })).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(within(foot).getByRole('link', { name: /^Changes/ }));
    expect(window.location.search).toBe('?panel=changes');
    expect(await screen.findByRole('dialog', { name: 'Changes' })).toBeInTheDocument();
    // The tool opens under where the drawer was, so choosing it closes the drawer.
    await waitFor(() => expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull());
    expect(screen.queryByRole('dialog', { name: 'Wiki card' })).toBeNull();
  });

  it('LA-V61-R56-T01 On a phone a problem chosen in the Checks sheet shows its record in the wiki card\'s sheet, the Checks sheet closed; Back brings it back', async () => {
    phone();
    await openApp('/DM?panel=checks');
    await waitFor(() => expect(checksPanel()).toBeInTheDocument());
    expect(screen.getByRole('dialog', { name: 'Checks' })).toBeInTheDocument();
    fireEvent.click(await within(checksPanel()).findByRole('link', { name: 'DM-SHOP-INV01' }));
    expect(window.location.pathname + window.location.search).toBe('/DM-SHOP-INV01');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Checks' })).toBeNull());
    const sheet = await screen.findByRole('dialog', { name: 'Wiki card' });
    await waitFor(() => expect(within(sheet).getByRole('region', { name: 'Wiki card' })).toHaveAttribute('data-page', 'DM-SHOP-INV01'));
    // Back: the Checks sheet again, on the record.
    act(() => window.history.back());
    await waitFor(() => expect(window.location.search).toBe('?panel=checks'));
    expect(await screen.findByRole('dialog', { name: 'Checks' })).toBeInTheDocument();
  });

  it('LA-V102-R07-T01 The ID in the wiki card\'s kind line is styled as the app\'s record links, not the browser\'s default link', () => {
    const css = readFileSync(join(__dirname, '..', 'src', 'styles.css'), 'utf8');
    expect(css).toMatch(/\.spec-body a\.record-link, \.wiki-panel-kind a\.record-link \{[^}]*color: var\(--ink\); text-decoration: none; \}/);
    expect(css).toMatch(/\.spec-body a\.record-link code, \.wiki-panel-kind a\.record-link code \{ color: var\(--steel\);/);
    expect(css).toMatch(/\.wiki-panel-kind a\.record-link:hover code \{ text-decoration: underline; \}/);
    expect(readFileSync(join(__dirname, '..', 'src', 'views', 'WikiCard.tsx'), 'utf8')).toMatch(/<p className="wiki-panel-kind">[\s\S]*?<Link to=\{addressOf\(focus\)\} className="record-link"><code>/);
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

  it('LA-V61-R19-T01 The nav is a full-screen modal sheet: Tab stays inside, the page behind is inert, and Escape or its backdrop closes it', async () => {
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
    // It is modal: the page behind is inert while it is open, and only the drawer and its backdrop are not.
    const behind = [topbar(), document.querySelector<HTMLElement>('#main')!];
    for (const el of behind) expect(el.closest('[inert]')).not.toBeNull();
    expect(nav.closest('[inert]')).toBeNull();
    expect(document.querySelector('.drawer-backdrop')!.closest('[inert]')).toBeNull();
    // Escape closes it and wakes the page; so does a tap on the backdrop.
    fireEvent.keyDown(focusable[0], { key: 'Escape' });
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();
    for (const el of behind) expect(el.closest('[inert]')).toBeNull();
    fireEvent.click(within(topbar()).getByRole('button', { name: 'Open the navigation' }));
    expect(topbar().closest('[inert]')).not.toBeNull();
    fireEvent.mouseDown(document.querySelector('.drawer-backdrop')!);
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();
    expect(topbar().closest('[inert]')).toBeNull();
  });

  it('LA-V61-R57-T01 On a phone a trail shows the … button and its parent, the button opening every place above it', async () => {
    phone();
    await openApp('/P-D-UC01-R01', served());
    await screen.findByRole('heading', { level: 1 });
    const trail = within(document.querySelector<HTMLElement>('.header-strip-trail')!);
    expect(trail.getAllByRole('link').map((a) => a.textContent)).toEqual(['UC requirements']);
    const more = trail.getByRole('button', { name: /hidden levels?$/ });
    fireEvent.click(more);
    const hidden = within(screen.getByRole('list', { name: 'Hidden levels' })).getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hidden[0]).toBe('/P');
    expect(hidden.length).toBeGreaterThan(1);
  });

  it('LA-V61-R57-T02 On a phone the trail\'s parent gives way with an ellipsis before the kind badge, which keeps its width', () => {
    const css = readFileSync(join(__dirname, '..', 'src', 'styles.css'), 'utf8');
    expect(css).toMatch(/\.app\.is-narrow \.breadcrumb:not\(\.topbar-trail\) \{ min-width: calc\(var\(--touch-target\) \+ 6em \+ 20px\); \}/);
    expect(css).toMatch(/\.breadcrumb:not\(\.topbar-trail\) :is\(ol, \.crumb:last-child\) \{ min-width: 0; \}/);
    expect(css).not.toMatch(/\.breadcrumb:not\(\.topbar-trail\)[^{]*\{ min-width: auto; \}/);
    expect(css).toMatch(/\.header-strip-focus \.kind-badge \{ flex: none;/);
    expect(css).toMatch(/\.crumb-link \{ min-width: 0;[^}]*overflow: hidden; text-overflow: ellipsis;/);
  });

  const proveLaV61R23T01 = async () => {
    phone();
    window.sessionStorage.setItem('lathe:place', JSON.stringify({ depth: 1, hiddenKinds: [], card: { open: true, expanded: true } }));
    await openApp('/P-D-UC01?stage=graph', served());
    // The use case's capability, its parent, is drawn beside it.
    await waitFor(() => expect(boxElement('P-D-CAP01')).not.toBeNull());
    const at = pointOn('P-D-CAP01');
    const canvas = canvasOf();
    // A drag that starts on the box pans: it opens nothing. So does a pinch.
    const finger = (id: number, x: number, y: number) => ({ clientX: x, clientY: y, pointerType: 'touch', pointerId: id, button: 0 });
    fireEvent.pointerDown(canvas, finger(7, at.x, at.y));
    fireEvent.pointerMove(canvas, finger(7, at.x + 30, at.y));
    fireEvent.pointerUp(canvas, finger(7, at.x + 30, at.y));
    fireEvent.pointerDown(canvas, finger(7, at.x, at.y));
    fireEvent.pointerDown(canvas, finger(8, at.x + 40, at.y));
    fireEvent.pointerUp(canvas, finger(8, at.x + 40, at.y));
    fireEvent.pointerUp(canvas, finger(7, at.x, at.y));
    // A tap on the canvas away from every box does nothing.
    tapEmpty();
    expect(window.location.pathname).toBe('/P-D-UC01');
    // A finger's tap on the box drawn on the canvas, wavering a little as it lands, opens it at once.
    const pan = cameraOf();
    fireEvent.pointerDown(canvas, finger(7, at.x, at.y));
    fireEvent.pointerMove(canvas, finger(7, at.x + 4, at.y + 3));
    expect(cameraOf()).toBe(pan);
    fireEvent.pointerUp(canvas, finger(7, at.x + 4, at.y + 3));
    await waitFor(() => expect(window.location.pathname).toBe('/P-D-CAP01'));
    // No card stands in for the record sheet: nothing is left selected.
    expect(document.querySelector('.card[role="status"]')).toBeNull();
    // On the ERD a tap opens a box at once too.
    await openApp('/P-D?stage=erd', served());
    await waitFor(() => expect(erdDrawn()).toBe(true));
    const box = await waitFor(() => { const b = erdScene().boxes.find((x) => !x.focus && x.kind !== 'domain'); expect(b).toBeDefined(); return b!; });
    const erdCanvas = erdHost()!.querySelector('canvas')!;
    const middle = { x: box.rect.left + box.rect.width / 2, y: box.rect.top + Math.min(12, box.rect.height / 2) };
    fireEvent.pointerDown(erdCanvas, finger(7, middle.x, middle.y));
    fireEvent.pointerUp(erdCanvas, finger(7, middle.x, middle.y));
    await waitFor(() => expect(window.location.pathname).toBe(`/${box.id}`));
  };
  it('LA-V61-R23-T01 By touch, one tap on a node opens it, on the Graph and the ERD; a drag or a pinch opens nothing', proveLaV61R23T01);
  it('LA-V93-R02-T01 By touch, one tap on a node opens it, as a click does; a drag or a pinch opens nothing', proveLaV61R23T01);

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
