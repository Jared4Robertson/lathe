import './graph/setup';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { parseSpecRoute } from '../src/specs/data';
import { addressOf, parseStage, stageFromSearch, withStage } from '../src/views/address';
import { CARD_GAP, CARD_GAP_Y, frameInsets, openInsets, OPEN_GAP } from '../src/views/openSpace';
import { cardTop } from '../src/views/cardPlace';
import { NARROW_QUERY } from '../src/shell/useNarrow';
import { SETTINGS_KEY } from '../src/graph/settings';
import { colorOf } from '../src/theme/audit';
import { contrast, over } from '../src/theme/contrast';
import { BUILT_IN_THEMES } from '../src/theme/theme';
import { COLOR_TOKENS } from '../src/theme/tokens';
import { openApp } from './helpers';
import { addRows } from './fixtures/load';
import { modelWorkspace } from './fixtures/model';
import { testWorkspace } from './graph/workspace';
import { boxElement, boxElements, graphHost, isCenter } from './graph/scene';

// The focus page: one address per record or group, one stage behind the page (Graph, ERD or Trace),
// switched in the page bar and named in the address, and the panels floating over it: the tab
// panel with the header strip, the wiki card and the side bar.

const served = () => ({ data: testWorkspace() });
const node = (id: string) => boxElement(id);
const title = () => screen.getByRole('heading', { level: 1 }).textContent;
/** A button of the stage switch, in the page bar. */
const stageButton = (name: 'Graph' | 'ERD' | 'Trace') => within(screen.getByRole('group', { name: 'Stage' })).getByRole('button', { name });
const sideBar = () => screen.getByRole('complementary', { name: 'Side bar' });
const card = () => screen.getByRole('region', { name: 'Wiki card' });
const stageRegion = (name: string) => screen.getByRole('region', { name: `${name} stage` });
const graphShown = () => waitFor(() => expect(boxElements().length).toBeGreaterThan(0));
const settings = () => JSON.parse(window.sessionStorage.getItem(SETTINGS_KEY) ?? 'null');

async function back() {
  await act(async () => {
    window.history.back();
    await new Promise((resolve) => window.addEventListener('popstate', resolve, { once: true }));
  });
}

/** Pretends the screen is narrow (under 900 px) for the next render. */
export function narrowScreen() {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {} }));
}

describe('one address, one stage', () => {
  it('LA-VO90-C01-T A record is at its bare ID and a group at /<parent-id>/<kind>', () => {
    expect(parseSpecRoute('/P-D-UC01')).toEqual({ page: 'record', id: 'P-D-UC01' });
    expect(parseSpecRoute('/P-D/define/use-cases')).toEqual({ page: 'group', parent: 'P-D', kind: 'define/use-cases' });
    expect(addressOf('P-D-UC01')).toBe('/P-D-UC01');
    expect(addressOf('P-D/define/use-cases')).toBe('/P-D/define/use-cases');
    expect(addressOf('P-D')).toBe('/P-D');
  });

  it('LA-VO91-C01-T A stage is one of graph, erd and trace', () => {
    expect(['graph', 'erd', 'trace'].map(parseStage)).toEqual(['graph', 'erd', 'trace']);
    for (const other of ['wiki', 'model', 'split', 'nonsense', '', null, undefined]) expect(parseStage(other)).toBeNull();
    expect(stageFromSearch('?stage=erd')).toBe('erd');
    expect(stageFromSearch('?stage=wiki')).toBeNull();
    // The view query is gone: it names nothing.
    expect(stageFromSearch('?view=graph')).toBeNull();
  });

  it('LA-VO90-C02-T An address names its stage only in its stage query, never in its path', async () => {
    expect(withStage('/X', 'trace')).toBe('/X?stage=trace');
    await openApp('/P-D-UC01?stage=erd', served());
    expect(await screen.findByRole('region', { name: 'ERD stage' })).toBeInTheDocument();
    expect(window.location.pathname + window.location.search).toBe('/P-D-UC01?stage=erd');
  });

  it('LA-V96-R03-T01 A record and a group each have one address, whatever the stage', async () => {
    await openApp('/P-D-UC01?stage=graph', served());
    expect(await screen.findByRole('region', { name: 'Graph stage' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/P-D-UC01');
    await openApp('/P-D/domain-model/term', served());
    expect(await screen.findByRole('heading', { level: 1, name: 'Terms (1)' })).toBeInTheDocument();
  });

  it('LA-EXP-INV03-T The stage a link names opens and becomes the remembered one; an address without one opens the last', async () => {
    await openApp('/P-D-UC01?stage=trace', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    expect(window.localStorage.getItem('lathe:stage')).toBe('"trace"');
    // A new session's first tab opens the stage last named.
    window.sessionStorage.clear();
    await openApp('/P-V01', served());
    await screen.findByRole('heading', { level: 1, name: 'Loan desk' });
    expect(stageButton('Trace')).toHaveAttribute('aria-pressed', 'true');
    expect(stageButton('Graph')).toHaveAttribute('aria-pressed', 'false');
  });

  it('LA-V96-R04-T01 The stage switch shows one stage at a time, named in the link and remembered; the Graph is the default', async () => {
    await openApp('/P-D-UC01', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    expect(stageButton('Graph')).toHaveAttribute('aria-pressed', 'true');
    expect(stageRegion('Graph')).toBeInTheDocument();
    // No panes, no split, no full screen.
    expect(screen.queryByRole('button', { name: /beside|Split|Full screen|Close the .* pane/ })).toBeNull();
    expect(document.querySelector('.pane')).toBeNull();

    fireEvent.click(stageButton('ERD'));
    expect(window.location.search).toBe('?stage=erd');
    expect(stageButton('ERD')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('region').filter((r) => /stage$/.test(r.getAttribute('aria-label') ?? ''))).toHaveLength(1);
    expect(await screen.findByRole('region', { name: 'ERD stage' })).toBeInTheDocument();
    expect(window.localStorage.getItem('lathe:stage')).toBe('"erd"');

    // Remembered: another record opens on the ERD.
    await openApp('/P-V01', served());
    await screen.findByRole('heading', { level: 1, name: 'Loan desk' });
    expect(stageButton('ERD')).toHaveAttribute('aria-pressed', 'true');
    // The stage switch appears once, in the page bar.
    expect(screen.getAllByRole('group', { name: 'Stage' })).toHaveLength(1);
    expect(within(document.querySelector<HTMLElement>('.page-bar')!).getByRole('group', { name: 'Stage' })).toBeInTheDocument();
  });

  it('LA-V96-R05-T01 The stage frames the focus in the open space the floating panels leave, measured from their rectangles', async () => {
    const stage = { left: 0, top: 0, right: 1440, bottom: 900, width: 1440, height: 900 };
    const rect = (left: number, top: number, right: number, bottom: number) => ({ left, top, right, bottom, width: right - left, height: bottom - top });
    const panels = [
      { side: 'left', rect: rect(8, 8, 344, 892) }, // the nav
      { side: 'top', rect: rect(352, 8, 1432, 76) }, // the tab panel
      { side: 'right', rect: rect(732, 84, 1084, 892) }, // the wiki card, inside the side bar
      { side: 'right', rect: rect(1092, 84, 1432, 892) }, // the side bar
      { side: 'left', rect: rect(0, 0, 0, 0) }, // a collapsed panel leaves nothing
    ];
    const open = openInsets(stage, panels);
    expect(open).toEqual({ left: 344 + OPEN_GAP, top: 76 + OPEN_GAP, right: 1440 - 732 + OPEN_GAP, bottom: 0 });
    // The stage's own tools take room from the frame only, never from the open space.
    expect(frameInsets(open, [{ side: 'top', rect: rect(360, 84, 700, 120) }])).toEqual({ ...open, top: open.top + 36 + OPEN_GAP });

    // On the page the measure is written on the stage as CSS variables, which the stage's tools follow.
    await openApp('/P-D-UC01?stage=graph', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    const el = stageRegion('Graph');
    await waitFor(() => expect(el.style.getPropertyValue('--open-left')).toMatch(/^\d+px$/));
    for (const side of ['left', 'top', 'right', 'bottom']) expect(el.style.getPropertyValue(`--frame-${side}`)).toMatch(/^\d+px$/);
    await waitFor(() => expect(el.querySelector('[data-stage-tools="top"]')).not.toBeNull());
    const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    expect(css).toMatch(/\.stage-tools\[data-stage-tools="top"\] \{ top: var\(--open-top/);
    expect(css).toMatch(/\.trace-scroll \{[^}]*padding: calc\(var\(--frame-top/);
  });

  it('LA-V96-R05-T01 The measure follows the stage the page makes anew when it changes between the phone and the wide layout', async () => {
    // A screen that narrows and widens again: the page makes its stage anew each way.
    let narrow = false;
    const listeners = new Set<() => void>();
    vi.stubGlobal('matchMedia', (query: string) => ({
      get matches() { return query === NARROW_QUERY && narrow; },
      media: query,
      addEventListener: (_: string, l: () => void) => { if (query === NARROW_QUERY) listeners.add(l); },
      removeEventListener: (_: string, l: () => void) => { listeners.delete(l); },
    }));
    const flip = (to: boolean) => act(() => { narrow = to; for (const l of [...listeners]) l(); });
    await openApp('/P-D-UC01?stage=erd', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    const before = stageRegion('ERD');
    await waitFor(() => expect(before.style.getPropertyValue('--open-left')).toMatch(/^\d+px$/));
    flip(true);
    flip(false);
    const after = stageRegion('ERD');
    expect(after).not.toBe(before);
    // The new stage is measured at once, so its tools (the ERD's key) sit inside the open space, clear of the nav.
    await waitFor(() => expect(after.style.getPropertyValue('--open-left')).toMatch(/^\d+px$/));
  });

  it('LA-EXP-INV02-T Every part shows one focus: a node click moves the card, a card link moves the graph, Back moves them all, and graph settings survive', async () => {
    await openApp('/P-D-UC01?stage=graph', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    await waitFor(() => expect(isCenter('P-D-UC01')).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Links' }));

    // A link in the wiki card moves the graph and the header strip.
    await userEvent.setup().click(within(card()).getAllByRole('link', { name: /P-D-UC01-R01/ })[0]);
    expect(window.location.pathname).toBe('/P-D-UC01-R01');
    await waitFor(() => expect(title()).toBe('The loan is recorded'));
    await waitFor(() => expect(isCenter('P-D-UC01-R01')).toBe(true));
    await waitFor(() => expect(within(card()).getByText('The loan MUST be recorded.')).toBeInTheDocument());

    // A node on the stage moves the card: the flow step that fulfills it, reached by the Links switch.
    await waitFor(() => expect(node('P-D-UC01-FL01-S01')).not.toBeNull());
    fireEvent.click(node('P-D-UC01-FL01-S01')!);
    expect(window.location.pathname + window.location.search).toBe('/P-D-UC01-FL01-S01?stage=graph');
    await waitFor(() => expect(title()).toBe('Librarian lends the thing'));
    await waitFor(() => expect(card()).toHaveAttribute('data-page', 'P-D-UC01-FL01-S01'));
    await waitFor(() => expect(isCenter('P-D-UC01-FL01-S01')).toBe(true));
  });

  it('LA-V96-R06-T01 The stage, the header strip and the wiki card follow one focus; Back moves them all, and graph settings survive', async () => {
    await openApp('/P-D-UC01?stage=graph', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    await waitFor(() => expect(isCenter('P-D-UC01')).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Links' }));
    await userEvent.setup().click(within(card()).getAllByRole('link', { name: /P-D-UC01-R01/ })[0]);
    await waitFor(() => expect(isCenter('P-D-UC01-R01')).toBe(true));
    await waitFor(() => expect(node('P-D-UC01-FL01-S01')).not.toBeNull());
    fireEvent.click(node('P-D-UC01-FL01-S01')!);
    await waitFor(() => expect(title()).toBe('Librarian lends the thing'));

    // Back moves them all.
    await back();
    await waitFor(() => expect(title()).toBe('The loan is recorded'));
    await waitFor(() => expect(isCenter('P-D-UC01-R01')).toBe(true));
    await waitFor(() => expect(card()).toHaveAttribute('data-page', 'P-D-UC01-R01'));
    // The depth set earlier is kept, through page moves and a trip to another stage.
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(stageButton('Trace'));
    fireEvent.click(stageButton('Graph'));
    await graphShown();
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('LA-V96-R07-T01 A group page shows its parent, its kind, and its members with their coverage marks', async () => {
    // The aggregate holds entities, events and commands too, so its invariants are a group of their own in the tree.
    await openApp('/P-D-A3/invariant', served());
    await screen.findByRole('heading', { level: 1, name: 'Invariants (2)' });
    const wiki = within(card());
    expect(wiki.getByRole('link', { name: /P-D-A3\s*Loan/ })).toHaveAttribute('href', '/P-D-A3');
    expect(wiki.getByText(/A rule that holds for one aggregate on every change/)).toBeInTheDocument();
    const members = within(wiki.getByRole('list', { name: 'Invariants of P-D-A3/invariant' })).getAllByRole('listitem');
    expect(members.map((li) => li.querySelector('code')?.textContent)).toEqual(['P-D-INV01', 'P-D-INV02']);
    expect(within(members[0]).queryByText('not proved')).toBeNull();
    expect(within(members[1]).getByText('not proved')).toBeInTheDocument();
    expect(within(members[1]).getByText('1 warning')).toBeInTheDocument();
  });

  it('LA-V96-R08-T01 Product and domain pages have the same stages, their graph centered on the product or domain', async () => {
    for (const [path, id, name] of [['/P', 'P', 'Product'], ['/P-D', 'P-D', 'Domain']]) {
      await openApp(`${path}?stage=graph`, served());
      await screen.findByRole('heading', { level: 1, name });
      expect(within(card()).getAllByRole('heading').length).toBeGreaterThan(0);
      expect(within(screen.getByRole('group', { name: 'Stage' })).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Graph', 'ERD', 'Trace']);
      await waitFor(() => expect(isCenter(id)).toBe(true));
    }
  });

  it('LA-V92-R20-T01 Lists in the side bar, the graph part of the side bar and group pages stay at 10 rows and can be searched', async () => {
    const w = testWorkspace();
    for (let i = 3; i <= 13; i++) {
      const id = `P-D-INV${String(i).padStart(2, '0')}`;
      addRows(w, 'invariant', { id, title: `Rule ${i}`, aggregate_id: 'P-D-A3', statement: `Rule ${i} MUST hold.` });
    }
    await openApp('/P-D-A3/invariant?stage=graph', { data: w });
    await screen.findByRole('heading', { level: 1, name: 'Invariants (13)' });
    expect(within(card()).getByRole('searchbox', { name: 'Filter invariants of P-D-A3/invariant' })).toBeInTheDocument();
    await waitFor(() => expect(within(sideBar()).getByRole('searchbox', { name: 'Filter connected records' })).toBeInTheDocument());
    // The side bar's Outline: the graph's records by level, each list searchable past 10 rows.
    fireEvent.click(within(sideBar()).getByRole('button', { name: 'Outline' }));
    await waitFor(() => expect(within(sideBar()).getAllByRole('searchbox', { name: /^Filter level \d$/ }).length).toBeGreaterThan(0));
  });

  it('LA-V96-R04-T02 Switching the stage by keyboard keeps focus, and the switch shows a focus ring', async () => {
    await openApp('/P-D-UC01?stage=graph', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    // Focus inside the graph, then switch to the ERD with the keyboard: the graph goes, and focus lands on the ERD's button, not lost.
    const links = screen.getByRole('button', { name: 'Links' });
    links.focus();
    fireEvent.keyDown(links, { key: '2', code: 'Digit2', ctrlKey: true });
    expect(screen.queryByRole('region', { name: 'Graph stage' })).toBeNull();
    await waitFor(() => expect(stageButton('ERD')).toHaveFocus());
    expect(stageButton('ERD')).toHaveAttribute('aria-pressed', 'true');
    // Each button names its shortcut (off a Mac, Alt+G first).
    fireEvent.keyDown(document.body, { key: 'Tab', code: 'Tab' });
    fireEvent.focus(stageButton('Graph'));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Graph stage Alt+G');
    expect(stageButton('Graph')).toHaveAttribute('aria-keyshortcuts', 'Alt+G Control+1');
    const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    expect(css).toMatch(/:is\([^)]*\.icon-button[^)]*\):focus-visible/);
    expect(css).toMatch(/\.icon-button\.is-on\s*\{/);
  });

  it('LA-V96-R04-T01 The page bar holds the tabs at its left and the stage switch, a divider, the wiki card and side bar toggles at its right; the pressed stage and the shown panels share one on look', async () => {
    await openApp('/P-D-UC01', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    const page = document.querySelector<HTMLElement>('.page-bar')!;
    expect(within(page.querySelector<HTMLElement>('.page-bar-start')!).getByRole('tab', { selected: true })).toHaveTextContent('P-D-UC01 Lend a thing');
    const order = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('button, .pane-divider')].map((b) => b.classList.contains('pane-divider') ? '|' : b.getAttribute('aria-label'));
    // Every stage works on every focus: three buttons, none disabled or dimmed (LA-PAT-APP-UX-R17).
    expect(order(page.querySelector<HTMLElement>('.page-bar-actions')!)).toEqual(['Graph', 'ERD', 'Trace', '|', 'Collapse the wiki card', 'Hide the side bar']);
    expect(page.querySelector('[aria-disabled="true"], .is-unavailable')).toBeNull();
    expect(stageButton('Graph')).toHaveClass('icon-button', 'is-on');
    expect(stageButton('ERD')).not.toHaveClass('is-on');
    expect(within(page).getByRole('button', { name: 'Collapse the wiki card' })).toHaveClass('icon-button', 'is-on');
    expect(within(page).getByRole('button', { name: 'Hide the side bar' })).toHaveClass('icon-button', 'is-on');
    // The page's h1 is the header strip's, under the page bar, outside the card.
    expect(screen.getByRole('heading', { level: 1 }).closest('.header-strip')).not.toBeNull();
    expect(card().querySelector('h1')).toBeNull();
  });

  it('LA-V96-R09-T01 The header strip names the focus in one line under the active tab: its breadcrumb, kind, linked ID and title, whole in its tooltip, and the stage\'s counts', async () => {
    await openApp('/P-D-UC01?stage=graph', served());
    const h1 = await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    const strip = h1.closest<HTMLElement>('.header-strip')!;
    expect(strip).not.toBeNull();
    expect(within(strip).getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
    expect(within(strip).getByRole('link', { name: 'P-D-UC01' })).toHaveAttribute('href', '/P-D-UC01');
    expect(strip.querySelector('.kind-badge')).not.toBeNull();
    expect(h1.closest('[title]')).toHaveAttribute('title', 'Lend a thing (P-D-UC01)');
    await waitFor(() => expect(strip.querySelector('.header-strip-counts')!.textContent).toMatch(/^\d+ records? · .*\d+ links?$/));
    // One line: the title cut with an ellipsis, never wrapped.
    const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    expect(css).toMatch(/\.header-strip \{[^}]*height: var\(--strip-height\)[^}]*white-space: nowrap/);
    expect(css).toMatch(/\.header-strip-title \{[^}]*text-overflow: ellipsis/);
  });

  it('LA-V96-R19-T01 The wiki card shows the focus\'s page, follows it once it settles, collapses by w and its button, and keeps its width for the session', async () => {
    await openApp('/P-D-UC01?stage=graph', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    expect(card()).toHaveAttribute('data-page', 'P-D-UC01');
    expect(within(card()).getByRole('heading', { level: 2, name: 'Lend a thing' })).toBeInTheDocument();

    // Quick moves draw the card once, on the page they settle on: the strip follows each move at once.
    await waitFor(() => expect(isCenter('P-D-UC01')).toBe(true));
    const host = graphHost()!;
    await act(async () => { await new Promise((r) => setTimeout(r, 250)); });
    fireEvent.keyDown(host, { key: 'ArrowRight' });
    await waitFor(() => expect(window.location.pathname).not.toBe('/P-D-UC01'));
    const first = window.location.pathname.slice(1);
    fireEvent.keyDown(host, { key: 'ArrowDown' });
    await waitFor(() => expect(window.location.pathname.slice(1)).not.toBe(first));
    const settled = window.location.pathname.slice(1);
    // The card is on the first move or still on it; it lands on the settled page shortly after.
    expect(card().getAttribute('data-page')).not.toBe(settled);
    await waitFor(() => expect(card()).toHaveAttribute('data-page', settled));

    // w collapses it, and brings it back; so does its own button. Both are the session's setting.
    fireEvent.keyDown(document.body, { key: 'w' });
    expect(screen.queryByRole('region', { name: 'Wiki card' })).toBeNull();
    expect(settings()).toMatchObject({ card: false });
    fireEvent.keyDown(document.body, { key: 'w' });
    expect(card()).toBeInTheDocument();
    fireEvent.click(within(card()).getByRole('button', { name: 'Collapse the wiki card' }));
    expect(screen.queryByRole('region', { name: 'Wiki card' })).toBeNull();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Show the wiki card' })).toHaveFocus());
    fireEvent.click(screen.getByRole('button', { name: 'Show the wiki card' }));

    // Its width: its handle, kept for the session, and double-click resets it to a third of the open space.
    const handle = within(card()).getByRole('separator', { name: 'Resize the wiki card' });
    fireEvent.keyDown(handle, { key: 'End' });
    expect(settings()).toMatchObject({ card: true, cardWidth: 900 });
    expect(document.querySelector<HTMLElement>('.stage-layout')!.style.getPropertyValue('--card-width')).toBe('900px');
    await openApp('/P-V01?stage=graph', served());
    await screen.findByRole('heading', { level: 1, name: 'Loan desk' });
    expect(within(card()).getByRole('separator', { name: 'Resize the wiki card' })).toHaveAttribute('aria-valuenow', '900');
    fireEvent.doubleClick(within(card()).getByRole('separator', { name: 'Resize the wiki card' }));
    expect(settings()).toMatchObject({ cardWidth: null });
  });

  it('LA-V96-R22-T01 The wiki card opens as a summary, More shows the whole page in place and Less goes back, the session\'s setting', async () => {
    // The card's default, as a new session has it (the other tests start it expanded).
    window.sessionStorage.clear();
    await openApp('/P-D-UC01?stage=graph', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    // The summary: the box's kind line, the title, the lead text clamped, and at most three key facts, its parent first.
    expect(card()).not.toHaveClass('is-expanded');
    expect(card().querySelector('.wiki-panel-kind')).toHaveTextContent('Use case · P-D-UC01');
    expect(within(card()).getByRole('heading', { level: 2, name: 'Lend a thing' })).toBeInTheDocument();
    expect(card().querySelector('.wiki-panel-lead')).toHaveTextContent('A member takes a thing home.');
    const facts = [...card().querySelectorAll('.wiki-panel-summary .fields dt')].map((d) => d.textContent);
    expect(facts.length).toBeGreaterThan(0);
    expect(facts.length).toBeLessThanOrEqual(3);
    expect(facts[0]).toBe('Capability');
    // Edit stays in reach; the whole page's sections do not show yet.
    expect(within(card()).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(within(card()).queryByRole('heading', { name: /^Flows by interface/ })).toBeNull();
    // More: the whole page in place, saved for the session; Less: the summary again.
    const more = within(card()).getByRole('button', { name: 'More' });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(more);
    expect(card()).toHaveClass('is-expanded');
    expect(settings()).toMatchObject({ cardExpanded: true });
    expect(within(card()).getByRole('heading', { name: /^Flows by interface/ })).toBeInTheDocument();
    expect(within(card()).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    fireEvent.click(within(card()).getByRole('button', { name: 'Less' }));
    expect(card()).not.toHaveClass('is-expanded');
    expect(settings()).toMatchObject({ cardExpanded: false });
  });

  it('LA-V96-R23-T01 The wiki card settles level with the focused box, below the stage\'s tools and above the foot, and rests at the nearest edge for a focus off-screen', () => {
    // Its title row 60 px down the card, the card 300 px high, the room from 120 px to 880 px of a 900 px stage.
    const at = (anchorY: number | null) => cardTop({ anchorY, titleAt: 60, height: 300, minTop: 120, stageHeight: 900 });
    expect(at(400)).toBe(340);
    // Near the top or above it, near the foot or below it: the nearest edge of the room.
    expect(at(130)).toBe(120);
    expect(at(-500)).toBe(120);
    expect(at(850)).toBe(900 - CARD_GAP_Y - 300);
    expect(at(5000)).toBe(900 - CARD_GAP_Y - 300);
    // No box for the focus: the top of the room.
    expect(at(null)).toBe(120);
  });

  it('LA-V96-R19-T03 The wiki card reads as part of the graph: below the tools, inset, its height fitted, the boxes\' corners, a stripe in the box\'s color, a soft shadow, no border and a quiet cross-fade', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    // Every rule of exactly this selector, joined.
    const rule = (selector: string) => [...css.matchAll(new RegExp(`(?:^|\\n)${selector.replace(/[.[\]()]/g, '\\$&')} \\{([^}]*)\\}`, 'g'))].map((m) => m[1]).join(';');
    const panel = rule('.wiki-panel');
    expect(panel).toMatch(/top: calc\(var\(--below-strip\) - var\(--float-inset\) \+ var\(--card-gap-y\)\)/);
    expect(panel).toMatch(/right: calc\(var\(--side-space\) - var\(--float-inset\) \+ var\(--card-gap\)\)/);
    expect(panel).toMatch(/border-radius: var\(--node-radius\)/);
    expect(panel).not.toMatch(/bottom:|border:/);
    expect(panel).toMatch(/max-height: var\(--card-room/);
    expect(rule('.wiki-panel.is-expanded')).toMatch(/max-height: min\(70%, var\(--card-room, 70%\)\)/);
    expect(rule('.wiki-panel::before')).toMatch(/background: var\(--card-accent/);
    expect(css).toMatch(/\.wiki-panel \{ background: var\(--float-light\);[^}]*box-shadow: var\(--card-shadow\)/);
    expect(css).toMatch(/@media \(forced-colors: active\) \{ \.wiki-panel \{ border: 1px solid CanvasText; \} \}/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: no-preference\) \{ \.wiki-panel-page \{ animation: wiki-card-in/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{ \.wiki-panel\[data-placed\] \{ transition: none; \} \}/);
    // The card's gaps are wider than the panels' own, and 1440 px still holds it beside the chat (LA-PAT-APP-UX-R18).
    expect(CARD_GAP).toBeGreaterThan(8);
    expect(CARD_GAP_Y).toBeGreaterThan(8);
  });

  it('LA-V96-R20-T01 Panels float over the stage, frosted, and opaque under reduced transparency', async () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const root = css.match(/^:root \{([\s\S]*?)\n\}/m)![1];
    expect(root).toMatch(/--float-dense: color-mix\(in srgb, var\(--sheet\) 82%, transparent\)/);
    expect(root).toMatch(/--float-light: color-mix\(in srgb, var\(--sheet\) 72%, transparent\)/);
    expect(root).toMatch(/--float-blur: 22px/);
    const reduced = css.match(/@media \(prefers-reduced-transparency: reduce\) \{([\s\S]*?)\n\}/)![1];
    expect(reduced).toMatch(/--float-dense: var\(--sheet\)/);
    expect(reduced).toMatch(/--float-light: var\(--sheet\)/);
    expect(reduced).toMatch(/--float-blur: 0px/);
    // Every floating panel takes the frosted surface and blur, and says which side it floats on.
    expect(css).toMatch(/\.wiki-panel \{ background: var\(--float-light\); backdrop-filter: blur\(var\(--float-blur\)\)/);
    expect(css).toMatch(/background: var\(--float-dense\); backdrop-filter: blur\(var\(--float-blur\)\)/);
    await openApp('/P-D-UC01?stage=graph', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    const sides = [...document.querySelectorAll<HTMLElement>('[data-floating]')].map((p) => `${p.className.split(' ')[0]}:${p.dataset.floating}`);
    expect(sides).toEqual(expect.arrayContaining(['menu:left', 'page-bar:top', 'header-strip:top', 'wiki-panel:right', 'side-bar-column:right']));

    // Text on a panel keeps AA (4.5:1) in every built-in theme and mode, the panel laid over any fill the stage draws
    // (the paper, the sheet, the shell, every tint) and over dense content (about a quarter ink over the paper, once blurred).
    const share = (token: string) => Number(root.match(new RegExp(`${token}: color-mix\\(in srgb, var\\(--sheet\\) (\\d+)%`))![1]) / 100;
    const fills = ['--paper', '--sheet', '--shell', ...COLOR_TOKENS.map((t) => t.name).filter((n) => n.endsWith('-bg'))];
    const failing = BUILT_IN_THEMES.flatMap((theme) => (['light', 'dark'] as const).flatMap((mode) => {
      const color = (token: string) => colorOf(theme, mode, token);
      const sheet = color('--sheet')!;
      const ink = color('--ink')!;
      const behind = [...fills.map(color).filter((c) => c !== null), over([ink[0], ink[1], ink[2], 0.25], color('--paper')!)];
      return [share('--float-dense'), share('--float-light')].flatMap((alpha) => behind.flatMap((under) => ['--ink', '--muted', '--steel', '--warn'].flatMap((fg) => {
        const ratio = contrast(color(fg)!, over([sheet[0], sheet[1], sheet[2], alpha], under));
        return ratio >= 4.5 ? [] : [`${theme.id} ${mode} ${fg} at ${alpha}: ${ratio.toFixed(2)}`];
      })));
    }));
    expect(failing).toEqual([]);
  });
});

describe('every stage on every focus', () => {
  it('LA-PAT-APP-UX-R17-T01 Every stage works on every focus: the switch always holds three enabled stages, and each draws something', async () => {
    for (const id of ['P-D-UC01', 'P-D-UC01-R01-T01', 'P-D-TM01']) {
      for (const stage of ['graph', 'erd', 'trace'] as const) {
        await openApp(`/${id}?stage=${stage}`, { data: modelWorkspace() });
        await screen.findByRole('heading', { level: 1 });
        const buttons = within(screen.getByRole('group', { name: 'Stage' })).getAllByRole('button');
        expect(buttons.map((b) => [b.getAttribute('aria-label'), b.hasAttribute('disabled') || b.getAttribute('aria-disabled') === 'true'])).toEqual([['Graph', false], ['ERD', false], ['Trace', false]]);
        const region = screen.getByRole('region', { name: `${{ graph: 'Graph', erd: 'ERD', trace: 'Trace' }[stage]} stage` });
        await waitFor(() => expect(region.querySelector('.graph-page, .erd-page, .trace-page'), `${id} ${stage}`).not.toBeNull());
        expect(region.textContent?.trim().length ?? 0, `${id} ${stage}`).toBeGreaterThan(0);
        expect(region.querySelector('.erd-missing'), `${id} ${stage}`).toBeNull();
      }
    }
  });
});

describe('the side bar', () => {
  /** A use case on the Graph stage, where the side bar starts open. */
  const inGraph = async () => {
    await openApp('/P-D-UC01?stage=graph', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    return within(sideBar());
  };

  it('LA-V61-R05-T01 The side bar shows the focused record, its facts and what the graph connects', async () => {
    const facts = await inGraph();
    expect(facts.getByText('Lend a thing', { selector: '.side-bar-name' })).toBeInTheDocument();
    await waitFor(() => expect(facts.getByRole('heading', { name: /Connected in the graph/ })).toBeInTheDocument());
  });

  it('LA-V95-R03-T01 The side bar folds away with its toggle, giving its space to the stage, and comes back', async () => {
    const facts = await inGraph();
    expect(document.querySelector('.stage-layout')!.className).toContain('with-side-bar');
    fireEvent.click(facts.getByRole('button', { name: 'Hide the side bar' }));
    expect(screen.queryByRole('complementary', { name: 'Side bar' })).toBeNull();
    expect(document.querySelector('.stage-layout')!.className).not.toContain('with-side-bar');
    fireEvent.click(screen.getByRole('button', { name: 'Show the side bar' }));
    expect(screen.getAllByRole('complementary', { name: 'Side bar' })).toHaveLength(1);
  });

  it('LA-V95-R05-T01 The side bar keeps its open state per stage, in a new session too', async () => {
    const facts = await inGraph();
    fireEvent.click(facts.getByRole('button', { name: 'Hide the side bar' }));
    expect(JSON.parse(window.localStorage.getItem('lathe:side-bar')!)).toMatchObject({ graph: { open: false } });
    // Remembered on the Graph stage of another record, in a new session's first tab too.
    window.sessionStorage.clear();
    await openApp('/P-V01?stage=graph', served());
    await screen.findByRole('heading', { level: 1, name: 'Loan desk' });
    expect(screen.queryByRole('complementary', { name: 'Side bar' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show the side bar' }));
    expect(within(sideBar()).getByText('Loan desk', { selector: '.side-bar-name' })).toBeInTheDocument();
    expect(screen.getAllByRole('complementary', { name: 'Side bar' })).toHaveLength(1);

    // The Trace stage keeps its own choice: closed until opened there.
    await openApp('/P-V01?stage=trace', served());
    await screen.findByRole('heading', { level: 1, name: 'Loan desk' });
    expect(screen.queryByRole('complementary', { name: 'Side bar' })).toBeNull();
  });

  it('LA-V95-R03-T02 On a narrow screen the side bar is a drawer: focus moves in, and Escape closes it and gives focus back', async () => {
    narrowScreen();
    await openApp('/P-D-UC01', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    expect(screen.queryByRole('complementary', { name: 'Side bar' })).toBeNull();
    const toggle = screen.getByRole('button', { name: 'Show the side bar' });
    fireEvent.click(toggle);
    const drawer = sideBar();
    expect(drawer.className).toContain('is-drawer');
    expect(drawer.closest('[role="dialog"]')).toHaveClass('side-bar-drawer');
    await waitFor(() => expect(drawer).toHaveFocus());
    fireEvent.keyDown(drawer, { key: 'Escape' });
    expect(screen.queryByRole('complementary', { name: 'Side bar' })).toBeNull();
    await waitFor(() => expect(toggle).toHaveFocus());
    expect(screen.getByRole('main')).toBeInTheDocument();
  });
});

describe('the panels\' handles', () => {
  it('LA-V61-R02-T01 The edge of every resizable panel is a handle moved by keys, within its limits', async () => {
    await openApp('/P-D-UC01?stage=graph', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    const cardHandle = screen.getByRole('separator', { name: 'Resize the wiki card' });
    fireEvent.keyDown(cardHandle, { key: 'Home' });
    expect(cardHandle).toHaveAttribute('aria-valuenow', '360');
    // The wiki card sits after its handle too: Left grows it.
    fireEvent.keyDown(cardHandle, { key: 'ArrowLeft' });
    expect(cardHandle).toHaveAttribute('aria-valuenow', '376');
    fireEvent.keyDown(cardHandle, { key: 'End' });
    expect(cardHandle).toHaveAttribute('aria-valuenow', '900');
    // The side bar sits after its handle: Left grows it.
    const sideHandle = screen.getByRole('separator', { name: 'Resize the side bar' });
    const before = Number(sideHandle.getAttribute('aria-valuenow'));
    fireEvent.keyDown(sideHandle, { key: 'ArrowLeft' });
    expect(Number(sideHandle.getAttribute('aria-valuenow'))).toBe(before + 16);
    expect(screen.getByRole('separator', { name: 'Resize the navigation' })).toBeInTheDocument();
  });

  it('LA-V61-R03-T01 A panel size is remembered, and double-clicking its handle resets it', async () => {
    await openApp('/P-D-UC01?stage=graph', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    const sideHandle = screen.getByRole('separator', { name: 'Resize the side bar' });
    fireEvent.keyDown(sideHandle, { key: 'End' });
    expect(window.localStorage.getItem('lathe:side-bar-width')).toBe('640');
    fireEvent.doubleClick(sideHandle);
    expect(sideHandle).toHaveAttribute('aria-valuenow', '340');
    const cardHandle = screen.getByRole('separator', { name: 'Resize the wiki card' });
    fireEvent.keyDown(cardHandle, { key: 'End' });
    expect(settings()).toMatchObject({ cardWidth: 900 });
    fireEvent.doubleClick(cardHandle);
    expect(settings()).toMatchObject({ cardWidth: null });
  });
});
