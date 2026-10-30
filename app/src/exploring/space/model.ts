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

/** Stored last pages, keeping only pages of a space. */
export function readPages(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((e): e is [string, string] => isString(e[1]) && isSpacePage(e[1])));
}
