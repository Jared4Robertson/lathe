import { createElement } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_VIEW, freshPlace, hereOf, MAX_HISTORY, movePlace, notePlace, readPlace, replacePlace, stepPlace, type PlaceView } from '../src/views/place';
import { activateTab as activate } from '../src/exploring/tab-set/commands/activate-tab';
import { closeTab as close } from '../src/exploring/tab-set/commands/close-tab';
import { cycleTab as cycle } from '../src/exploring/tab-set/commands/cycle-tab';
import { duplicateTab as duplicate } from '../src/exploring/tab-set/commands/duplicate-tab';
import { moveInTab as move } from '../src/exploring/tab-set/commands/move-in-tab';
import { newTab as open } from '../src/exploring/tab-set/commands/new-tab';
import { replaceInTab as replace } from '../src/exploring/tab-set/commands/replace-in-tab';
import { stepTab as step } from '../src/exploring/tab-set/commands/step-tab';
import { updateView as changeView } from '../src/exploring/tab-set/commands/update-view';
import { activeTab, emptyTabs, NO_TABS, parseTabSet, type TabSet, type TabSets } from '../src/exploring/tab-set/model';
import { RuleBroken, useAggregate } from '../src/shell/prefs';
import { keepCamera } from '../src/exploring/tab-set/commands/keep-camera';
import { rememberStage } from '../src/exploring/tab-set/commands/remember-stage';
import { arrive, onPageOpenedMoveActiveTab } from '../src/exploring/tab-set/policies';
import { keptCamera } from '../src/exploring/tab-set/reads';
import { tabSetRepository } from '../src/exploring/tab-set/repository';
import { holdToRules } from '../src/exploring/tab-set/rules';
import { runTabSetCommand } from '../src/exploring/tab-set/run';

// The desktop app's tabs as a browser's (tabs.ts) over places (place.ts): a move never leaves its tab, a page may be
// open in several tabs, a new tab opens only when asked for, and each tab has its own history.

// The Tab set's commands run on one space's set here: each takes the whole tab sets and gives them back.
const S = 'S';
const on = <I,>(set: TabSet, command: (tabs: TabSets, input: I & { space: string }) => TabSets, input: I): TabSet =>
  command({ ...NO_TABS, sets: { [S]: set } }, { ...input, space: S }).sets[S] ?? set;
const moveInTab = (set: TabSet, address: string, v: PlaceView) => on(set, move, { address, view: v });
const replaceInTab = (set: TabSet, address: string) => on(set, replace, { address });
const newTab = (set: TabSet, address: string, v: PlaceView, opts: { background?: boolean } = {}) => on(set, open, { address, view: v, ...opts });
const closeTab = (set: TabSet, key: string, home: string) => on(set, close, { key, home });
const activateTab = (set: TabSet, key: string) => on(set, activate, { key });
const cycleTab = (set: TabSet, by: number) => on(set, cycle, { step: by });
const stepTab = (set: TabSet, key: string, to: number) => on(set, step, { key, to });
const duplicateTab = (set: TabSet, key: string) => on(set, duplicate, { key });
const updateView = (set: TabSet, _key: string, change: (v: PlaceView) => PlaceView) => on(set, changeView, { change });

const view: PlaceView = { depth: 2, hiddenKinds: ['term'], card: { open: false, expanded: true } };
const at = (set: TabSet) => set.tabs.map((t) => `${hereOf(t.place).address}${t.key === set.active ? '<' : ''}`);
/** Two tabs, A and B, B active. */
const two = () => newTab(newTab(emptyTabs(), '/A?stage=graph', DEFAULT_VIEW), '/B?stage=erd', view);

describe('the tab model', () => {
  it('LA-V96-R10-T03 A move never leaves its tab, and a page may be open in several tabs, each its own', () => {
    let set = two();
    // B moves onto A's page: still B, and now two tabs hold /A.
    set = moveInTab(set, '/A?stage=graph', DEFAULT_VIEW);
    expect(at(set)).toEqual(['/A?stage=graph', '/A?stage=graph<']);
    expect(set.tabs[1].place.view).toEqual(view);
    // Each is its own: a move in one leaves the other where it was.
    set = moveInTab(set, '/C?stage=graph', DEFAULT_VIEW);
    expect(at(set)).toEqual(['/A?stage=graph', '/C?stage=graph<']);
    set = updateView(set, set.active!, (v) => ({ ...v, depth: 3 }));
    expect(set.tabs.map((t) => t.place.view.depth)).toEqual([1, 3]);
    // The first move of an empty set opens its first tab.
    expect(at(moveInTab(emptyTabs(), '/A', view))).toEqual(['/A<']);
  });

  it('LA-V96-R10-T01 Opening in the same tab never switches tabs, even onto a page another tab holds', () => {
    const set = two();
    for (const to of ['/A?stage=graph', '/A?stage=erd', '/B?stage=erd', '/D']) {
      const next = moveInTab(set, to, DEFAULT_VIEW);
      expect(next.active).toBe(set.active);
      expect(next.tabs).toHaveLength(2);
      expect(hereOf(activeTab(next)!.place).address).toBe(to);
    }
    // A stage switched in place changes the entry, not the history.
    const switched = replaceInTab(set, '/B?stage=trace');
    expect(activeTab(switched)!.place.history.map((e) => e.address)).toEqual(['/B?stage=trace']);
  });

  it('LA-V96-R11-T01 A new tab copies the stage, depth and filters, with a fresh history, after the active tab; in the background it leaves the active tab', () => {
    let set = moveInTab(two(), '/B2?stage=erd', DEFAULT_VIEW);
    set = activateTab(set, set.tabs[0].key);
    // From A (first), a new tab opens after it, not at the end, and is active, with the view given and one entry.
    set = newTab(set, '/N?stage=graph', activeTab(set)!.place.view);
    expect(at(set)).toEqual(['/A?stage=graph', '/N?stage=graph<', '/B2?stage=erd']);
    expect(activeTab(set)!.place.history).toHaveLength(1);
    expect(activeTab(set)!.place.view).toEqual(DEFAULT_VIEW);
    // In the background: after the active tab, which stays active.
    const back = newTab(set, '/M?stage=graph', view, { background: true });
    expect(at(back)).toEqual(['/A?stage=graph', '/N?stage=graph<', '/M?stage=graph', '/B2?stage=erd']);
    expect(back.tabs[2].place).toEqual(freshPlace('/M?stage=graph', view));
    // Keys stay unique.
    expect(new Set(back.tabs.map((t) => t.key)).size).toBe(4);
  });

  const proveLaExpInv07T = () => {
    const three = newTab(two(), '/C', DEFAULT_VIEW);
    const [a, b, c] = three.tabs.map((t) => t.key);
    // Closing the active middle tab activates its right neighbor; the rightmost, its left.
    const middle = closeTab(activateTab(three, b), b, '/P');
    expect(at(middle)).toEqual(['/A?stage=graph', '/C<']);
    expect(at(closeTab(three, c, '/P'))).toEqual(['/A?stage=graph', '/B?stage=erd<']);
    // Closing a tab that is not active keeps the active one.
    expect(closeTab(three, a, '/P').active).toBe(c);
    // The last tab leaves one tab at the product, with its view and a fresh history.
    const one = closeTab(closeTab(two(), a, '/P'), b, '/P');
    expect(at(one)).toEqual(['/P<']);
    expect(one.tabs[0].place).toEqual(freshPlace('/P', view));
    // Cycling wraps both ways; an unknown key changes nothing.
    expect(activeTab(cycleTab(three, 1))!.key).toBe(a);
    expect(activeTab(cycleTab(activateTab(three, a), -1))!.key).toBe(c);
    expect(closeTab(three, 'nope', '/P')).toBe(three);
  };
  it('LA-EXP-INV07-T There is always a tab: closing activates the right neighbor, else the left, and closing the last leaves one tab on the product', proveLaExpInv07T);
  it('LA-V96-R12-T01 Closing the active tab activates its right neighbor, or else the left; closing the last leaves one on the product; cycling wraps', proveLaExpInv07T);

  it('LA-V96-R31-T01 Each tab has its own Back and Forward: a move drops the forward entries, Back and Forward step within the tab', () => {
    let set = two();
    const [a, b] = set.tabs.map((t) => t.key);
    set = moveInTab(set, '/B1', DEFAULT_VIEW);
    set = moveInTab(set, '/B2', DEFAULT_VIEW);
    // Back twice, Forward once: within B; A is untouched.
    set = stepTab(set, b, 0);
    expect(hereOf(activeTab(set)!.place).address).toBe('/B?stage=erd');
    set = stepTab(set, b, 1);
    expect(hereOf(activeTab(set)!.place).address).toBe('/B1');
    expect(set.tabs[0].place.history.map((e) => e.address)).toEqual(['/A?stage=graph']);
    // A move drops what was ahead.
    set = moveInTab(set, '/X', DEFAULT_VIEW);
    expect(activeTab(set)!.place.history.map((e) => e.address)).toEqual(['/B?stage=erd', '/B1', '/X']);
    // Out of range, nothing; A's history is A's.
    expect(stepTab(set, b, 7)).toBe(set);
    expect(stepTab(set, a, -1)).toBe(set);
    // A place notes the card's scroll in its entry, and a move to the same address is no move.
    let place = notePlace(freshPlace('/A', DEFAULT_VIEW), { cardScroll: 40 });
    expect(movePlace(place, '/A')).toBe(place);
    place = movePlace(place, '/B');
    expect(hereOf(place).note).toEqual({});
    expect(hereOf(stepPlace(place, 0)).note).toEqual({ cardScroll: 40 });
    expect(hereOf(replacePlace(stepPlace(place, 0), '/A?stage=erd')).note).toEqual({ cardScroll: 40 });
    // The history keeps the newest entries.
    for (let i = 0; i < MAX_HISTORY + 5; i++) place = movePlace(place, `/P${i}`);
    expect(place.history).toHaveLength(MAX_HISTORY);
    expect(place.at).toBe(MAX_HISTORY - 1);
  });

  it('LA-EXP-INV08-T Each tab\'s place is its own, duplicating copies it with its history, and a stored set is read back with anything malformed dropped', () => {
    let set = moveInTab(two(), '/B1', DEFAULT_VIEW);
    set = stepTab(set, set.active!, 0);
    const dup = duplicateTab(set, set.active!);
    // The copy sits after its tab, active, with the same history, position and view.
    expect(dup.tabs).toHaveLength(3);
    expect(dup.tabs[2].key).toBe(dup.active);
    expect(dup.tabs[2].place).toEqual(dup.tabs[1].place);
    expect(duplicateTab(set, 'nope')).toBe(set);
    // Then each goes its own way.
    const moved = moveInTab(dup, '/Y', DEFAULT_VIEW);
    expect(hereOf(moved.tabs[1].place).address).toBe('/B?stage=erd');
    expect(hereOf(moved.tabs[2].place).address).toBe('/Y');

    // Stored and read back.
    const isPage = (a: string) => a.startsWith('/') && !a.startsWith('/bad');
    expect(parseTabSet(JSON.parse(JSON.stringify(moved)), isPage)).toEqual(moved);
    const stored = {
      active: 't9',
      tabs: [
        { key: 't1', place: { history: [{ address: '/A', note: { cardScroll: 12 } }, { address: '/bad' }, { address: '/C', note: [] }], at: 2, view: { depth: 7, hiddenKinds: ['x', 3], card: { open: false } } } },
        { key: 't1', place: { history: [{ address: '/dup' }], at: 0 } },
        { key: 't2', place: { history: [{ address: '/bad' }], at: 0 } },
        { key: 't3', place: 'nope' },
        'nope',
      ] };
    expect(parseTabSet(stored, isPage)).toEqual({
      active: 't1',
      tabs: [{ key: 't1', place: { history: [{ address: '/A', note: { cardScroll: 12 } }, { address: '/C', note: {} }], at: 1, view: { depth: 1, hiddenKinds: ['x'], card: { open: false, expanded: false } } } }] });
    expect(parseTabSet({ tabs: [] }, isPage)).toBeNull();
    expect(parseTabSet('x', isPage)).toBeNull();
    expect(readPlace({ history: [{ address: '/bad' }], at: 0 }, isPage)).toBeNull();
  });
});

// The Tab set's commands (LA-EXP-CMD04–08, CMD10, CMD23–28), run by runTabSetCommand through TabSetRepository.

const sets = () => JSON.parse(window.sessionStorage.getItem('lathe:tabs') ?? 'null');

describe('LA-EXP-INV08-T the Tab set commands keep the tabs through TabSetRepository', () => {
  it('keeps each space\'s set and the view last set for the session, and the stage from one launch to the next', () => {
    runTabSetCommand(move, { space: 'P', address: '/P-A?stage=graph', view: DEFAULT_VIEW });
    runTabSetCommand(open, { space: 'P', address: '/P-B?stage=erd', view: DEFAULT_VIEW });
    expect(sets().P.tabs.map((t: { key: string }) => t.key)).toEqual(['t1', 't2']);
    runTabSetCommand(changeView, { space: 'P', change: (v) => ({ ...v, depth: 3 }) });
    expect(JSON.parse(window.sessionStorage.getItem('lathe:place')!).depth).toBe(3);
    runTabSetCommand(changeView, { space: null, change: (v) => ({ ...v, depth: 2 }) });
    expect(tabSetRepository.load().view.depth).toBe(2);
    runTabSetCommand(rememberStage, { stage: 'trace' });
    expect(window.localStorage.getItem('lathe:stage')).toBe('"trace"');
    expect(tabSetRepository.load().stage).toBe('trace');
  });

  it('keeps a place\'s cameras in memory: a duplicate gets them, a closed tab forgets them', () => {
    runTabSetCommand(move, { space: 'P', address: '/P-A', view: DEFAULT_VIEW });
    runTabSetCommand(keepCamera, { place: 'P/t1', stage: 'graph', camera: { framed: 'f', view: { x: 1 } } });
    expect(keptCamera('P/t1', 'graph', 'f')).toEqual({ x: 1 });
    expect(keptCamera('P/t1', 'graph', 'other')).toBeNull();
    runTabSetCommand(duplicate, { space: 'P', key: 't1' });
    expect(keptCamera('P/t2', 'graph', 'f')).toEqual({ x: 1 });
    runTabSetCommand(close, { space: 'P', key: 't1', home: '/P' });
    expect(keptCamera('P/t1', 'graph', 'f')).toBeNull();
    expect(window.sessionStorage.getItem('lathe:tabs')).not.toContain('camera');
  });

  it('works out a page opened while the page renders, and saves it once', () => {
    const arrival = arrive(NO_TABS.sets.P ?? { tabs: [], active: null }, 'P', '/P-A?stage=graph', 'load', null, DEFAULT_VIEW);
    expect(arrival.set.tabs).toHaveLength(1);
    expect(sets()).toBeNull();
    onPageOpenedMoveActiveTab(arrival);
    onPageOpenedMoveActiveTab(arrival);
    expect(sets().P.tabs).toHaveLength(1);
  });
});

describe('LA-PAT-APP-CODE-R25-T01 the Tab set as a stable snapshot', () => {
  it('reads a stale stored set once: the drop from storage does not make each load a new value, so React never warns', () => {
    // A set of another form: the read drops it from storage too, which changes the stored text it is cached by.
    window.sessionStorage.setItem('lathe:tabs', JSON.stringify({ P: { stale: true } }));
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const first = tabSetRepository.load();
      expect(tabSetRepository.load()).toBe(first);
      function Reader() { return createElement('span', null, String(Object.keys(useAggregate(tabSetRepository).sets).length)); }
      render(createElement(Reader));
      expect(errors.mock.calls.flat().join('\n')).not.toMatch(/getSnapshot/);
    } finally {
      errors.mockRestore();
    }
  });
});

describe('LA-EXP-INV07-T The Tab set refuses a set with no active tab', () => {
  it('refuses it with its reason, and nothing is saved', () => {
    const place = { history: [{ address: '/A', note: {} }], at: 0, view: DEFAULT_VIEW };
    expect(() => holdToRules({ ...NO_TABS, sets: { P: { tabs: [{ key: 't1', place }], active: null } } })).toThrow(RuleBroken);
    expect(() => holdToRules({ ...NO_TABS, sets: { P: { tabs: [{ key: 't1', place }], active: null } } })).toThrow('The tab set of P has no active tab.');
    expect(() => runTabSetCommand(() => ({ ...NO_TABS, sets: { P: { tabs: [{ key: 't1', place }], active: 'x' } } }), {})).toThrow(RuleBroken);
    expect(window.sessionStorage.getItem('lathe:tabs')).toBeNull();
  });
});

describe('LA-EXP-INV08-T The Tab set refuses a place whose current entry is not in its history', () => {
  it('refuses each with its reason', () => {
    const place = { history: [{ address: '/A', note: {} }], at: 0, view: DEFAULT_VIEW };
    expect(() => holdToRules({ ...NO_TABS, sets: { P: { tabs: [{ key: 't1', place: { ...place, at: 4 } }], active: 't1' } } })).toThrow('Tab t1 of P stands on entry 4, which its history does not have.');
    expect(() => holdToRules({ ...NO_TABS, sets: { P: { tabs: [{ key: 't1', place: { ...place, history: [] } }], active: 't1' } } })).toThrow('Tab t1 of P has 0 history entries; a place keeps 1 to 50.');
  });
});
