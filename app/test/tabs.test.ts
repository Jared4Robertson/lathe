import { describe, expect, it } from 'vitest';
import { activateTab, closeTab, cycleTab, emptyTabs, keepTab, openTab, parseTabSet, updateTab, type TabSet } from '../src/views/tabs';

// The tab model on its own: pure functions over a set of tabs (app/src/views/tabs.ts).

type S = { n: number };
const from = (t: { state: S } | undefined): S => ({ n: (t?.state.n ?? 0) + 1 });
const pages = (set: TabSet<S>) => set.tabs.map((t) => `${t.page}${t.preview ? '*' : ''}${t.key === set.active ? '<' : ''}`);
const open = (set: TabSet<S>, page: string, keep = false) => openTab(set, page, from, { keep });

describe('the tab model', () => {
  it('LA-BRW-T320 A plain open replaces the one preview tab in place, a page open in a tab activates it, and keeping makes a tab lasting', () => {
    let set = open(emptyTabs<S>(), '/a');
    expect(pages(set)).toEqual(['/a*<']);
    // A plain open replaces the preview, keeping its key.
    const key = set.tabs[0].key;
    set = open(set, '/b');
    expect(pages(set)).toEqual(['/b*<']);
    expect(set.tabs[0].key).toBe(key);
    // The new page's state comes from the tab that was active.
    expect(set.tabs[0].state.n).toBe(2);
    // Kept, the next plain open adds a preview after it.
    set = keepTab(set, key);
    set = open(set, '/c');
    expect(pages(set)).toEqual(['/b', '/c*<']);
    // A page already open activates its tab: no second tab, no change to the preview.
    set = open(set, '/b');
    expect(pages(set)).toEqual(['/b<', '/c*']);
    // From /b, a plain open replaces the preview where it sits.
    set = open(set, '/d');
    expect(pages(set)).toEqual(['/b', '/d*<']);
    // A kept open adds a lasting tab after the active one, and the preview stays.
    set = activateTab(set, set.tabs[0].key);
    set = open(set, '/e', true);
    expect(pages(set)).toEqual(['/b', '/e<', '/d*']);
    // Opening an open preview's page with keep keeps it.
    set = open(set, '/d', true);
    expect(pages(set)).toEqual(['/b', '/e', '/d<']);
    expect(set.tabs.filter((t) => t.preview)).toHaveLength(0);
    // Keys stay unique.
    expect(new Set(set.tabs.map((t) => t.key)).size).toBe(3);
  });

  it('LA-BRW-T321 Closing the active tab activates its right neighbor, or else the left; closing the last leaves it as a preview; cycling wraps', () => {
    let set = open(open(open(emptyTabs<S>(), '/a', true), '/b', true), '/c', true);
    expect(pages(set)).toEqual(['/a', '/b', '/c<']);
    set = cycleTab(set, 1);
    expect(pages(set)).toEqual(['/a<', '/b', '/c']);
    set = cycleTab(set, -1);
    expect(pages(set)).toEqual(['/a', '/b', '/c<']);
    set = cycleTab(set, -2);
    expect(pages(set)).toEqual(['/a<', '/b', '/c']);
    // The active /a closes: its right neighbor /b is active.
    set = closeTab(set, set.tabs[0].key);
    expect(pages(set)).toEqual(['/b<', '/c']);
    // An inactive tab closes: the active one stays.
    set = closeTab(set, set.tabs[1].key);
    expect(pages(set)).toEqual(['/b<']);
    // The rightmost active tab closes: the left neighbor is active.
    set = open(set, '/x', true);
    set = closeTab(set, set.tabs[1].key);
    expect(pages(set)).toEqual(['/b<']);
    // The last tab stays, as the preview.
    set = closeTab(set, set.tabs[0].key);
    expect(pages(set)).toEqual(['/b*<']);
    // Unknown keys change nothing.
    expect(closeTab(set, 'nope')).toBe(set);
    expect(activateTab(set, 'nope')).toBe(set);
    expect(cycleTab(set, 1)).toBe(set);
    expect(keepTab(set, 'nope')).toBe(set);
  });

  it('LA-BRW-T322 Each tab keeps its own state, and a stored set is read back with anything malformed dropped', () => {
    let set = open(open(emptyTabs<S>(), '/a', true), '/b', true);
    set = updateTab(set, set.tabs[0].key, () => ({ n: 42 }));
    expect(set.tabs.map((t) => t.state.n)).toEqual([42, 2]);
    expect(updateTab(set, set.tabs[0].key, (s) => s)).toBe(set);

    const read = (v: unknown) => (v && typeof v === 'object' && typeof (v as S).n === 'number' ? (v as S) : null);
    const isPage = (page: string) => page.startsWith('/');
    const stored = JSON.parse(JSON.stringify({ ...set, tabs: [...set.tabs, { key: 'x', page: 'not a path', preview: false, state: { n: 1 } }, { key: 'y', page: '/c', preview: true, state: 'bad' }] }));
    expect(parseTabSet(stored, read, isPage)).toEqual(set);
    // Two previews: the last one stored wins. An unknown active tab falls back to the first.
    const two = { active: 'gone', tabs: [{ key: 't1', page: '/a', preview: true, state: { n: 1 } }, { key: 't2', page: '/b', preview: true, state: { n: 1 } }] };
    const back = parseTabSet(two, read, isPage)!;
    expect(back.tabs.map((t) => t.preview)).toEqual([false, true]);
    expect(back.active).toBe('t1');
    expect(parseTabSet({ tabs: [] }, read, isPage)).toBeNull();
    expect(parseTabSet('nonsense', read, isPage)).toBeNull();
    // A page the reader does not accept as an address is dropped, never converted.
    expect(parseTabSet(two, read, (page) => page === '/b')!.tabs.map((t) => t.page)).toEqual(['/b']);
  });
});
