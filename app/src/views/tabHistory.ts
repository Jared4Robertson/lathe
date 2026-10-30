import { browserHistory, rewriteHistory } from '../router';
import type { Tab } from '../exploring/tab-set/model';

// The window's history in the desktop app follows the active tab (LA-V96-R31). Each tab keeps its own history
// (place.ts); the window's entries are the active tab's, from its first entry (the base) up, each entry tagged with
// its space, tab and index. So the window's Back and Forward (the title bar's buttons, Ctrl+- and Ctrl+Shift+-,
// Cmd+[ and Cmd+]) step through the active tab's history only:
// - a move in the tab pushes one entry, as a browser does, and is tagged with the tab's new index;
// - Back and Forward land on a tagged entry of the active tab: the tab steps there;
// - activating, opening, duplicating or closing a tab rewrites the window's history from the base: it goes back to the
//   base, lays the newly active tab's entries over it and stands on its current one (router.tsx's rewriteHistory), so
//   the browser's buttons are enabled exactly when the tab has somewhere to go.
// Entries before the base (the products picker, another product's tab) are left as they are.

/** The key a window entry's tag is kept under in its state. */
const TAG = 'latheTab';

export interface EntryTag {
  space: string;
  tab: string;
  /** The entry's index in the tab's history, which is also how far it stands above the base. */
  at: number;
}

const isTag = (v: unknown): v is EntryTag => {
  const t = v as EntryTag;
  return !!t && typeof t === 'object' && typeof t.space === 'string' && typeof t.tab === 'string' && Number.isInteger(t.at) && t.at >= 0;
};

/** The tag of the window's current entry, if it is a tab's. */
export function currentTag(): EntryTag | null {
  const tag = browserHistory.state()[TAG];
  return isTag(tag) ? tag : null;
}

const sameTag = (a: EntryTag | null, b: EntryTag) => !!a && a.space === b.space && a.tab === b.tab && a.at === b.at;

/** Tags the window's current entry as a tab's, keeping what is noted in it. */
export function tagEntry(tag: EntryTag) {
  if (sameTag(currentTag(), tag)) return;
  try {
    browserHistory.replace({ ...browserHistory.state(), [TAG]: tag });
  } catch { /* too many history calls: the tag is skipped */ }
}

/** True while the window stands on the tab's current entry, tagged as it. */
export function inStep(space: string, tab: Tab, address: string): boolean {
  return sameTag(currentTag(), { space, tab: tab.key, at: tab.place.at }) && here() === address;
}

/** The window's address: path, query and hash. */
export const here = () => window.location.pathname + window.location.search + window.location.hash;

/**
 * Gives the window a tab's history, once the rewrites before are done and while `which` still names one: back to the
 * base (the first entry of the tab the window stands on, when it is this space's; else the entry it stands on), then
 * the tab's entries, standing on its current one; `done` hears the entry's tag before any page hears the move.
 */
export function giveHistory(which: () => { space: string; tab: Tab } | null, done: (tag: EntryTag) => void): Promise<void> {
  return rewriteHistory(() => {
    const w = which();
    if (!w) return null;
    const { space, tab } = w;
    const tag = currentTag();
    const back = tag && tag.space === space ? tag.at : 0;
    const entries = tab.place.history.map((e, at) => ({ address: e.address, state: { ...e.note, [TAG]: { space, tab: tab.key, at } } }));
    return { back, entries, at: tab.place.at, done: () => done({ space, tab: tab.key, at: tab.place.at }) };
  });
}
