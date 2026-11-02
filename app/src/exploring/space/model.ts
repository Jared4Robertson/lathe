import type { BrowserStorage, StoredParts } from '../../shell/storage';
import { isFocusPath } from '../../views/address';

// The Space aggregate (LA-EXP-A2) as the app keeps it: the space chosen last, each space's last page this session, and
// whether two or more spaces were listed last time (so the nav's space rail is drawn where it will stay before the
// products are read). Which products are spaces is the Product aggregate's (list-products), not kept here.

export interface SpaceMemory {
  /** The product ID of the space chosen last, kept from one launch to the next; '' before any. */
  chosen: string;
  /** Each space's last page this session (path and query), by product ID. */
  pages: Readonly<Record<string, string>>;
  /** Whether two or more spaces were listed last time. */
  several: boolean;
}

export const NO_SPACE_MEMORY: SpaceMemory = { chosen: '', pages: {}, several: true };

/** Whether an address is a page of a space: a focus page, by its path. */
export const isSpacePage = (address: string) => isFocusPath(address.split('?')[0]);

const isString = (v: unknown): v is string => typeof v === 'string';

/**
 * Where the Space is kept: the space chosen last in local storage (from one launch to the next), each space's last page
 * in session storage, and whether two or more spaces were listed last time in local storage. Its repository is
 * generated from it.
 */
export const SPACE_STORAGE = {
  chosen: { key: 'lathe:space', store: 'local' },
  pages: { key: 'lathe:space-pages', store: 'session' },
  several: { key: 'lathe:space-rail', store: 'local' },
} as const satisfies BrowserStorage;

/** Stored last pages, keeping only pages of a space. */
function readPages(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((e): e is [string, string] => isString(e[1]) && isSpacePage(e[1])));
}

/** The Space from its stored parts; a part of another form reads as none. */
export function spaceFrom(stored: StoredParts<typeof SPACE_STORAGE>): SpaceMemory {
  return {
    chosen: isString(stored.chosen) ? stored.chosen : NO_SPACE_MEMORY.chosen,
    pages: readPages(stored.pages),
    several: typeof stored.several === 'boolean' ? stored.several : NO_SPACE_MEMORY.several,
  };
}
