import { isBool } from '../../shell/prefs';
import type { BrowserStorage, StoredParts } from '../../shell/storage';

// The Nav row aggregate (LA-EXP-A3) as the app keeps it: which rows of the nav the Reader has open or folded, its
// folders (a domain, a stage, a kind group, by row key), kept for the browser session. A folder not named is folded.

export interface NavRows {
  /** Each folder row's state by row key: true open, false folded. */
  folders: Readonly<Record<string, boolean>>;
}

/** Where the Nav rows are kept: the folders in session storage. Its repository is generated from it. */
export const NAV_ROW_STORAGE = {
  folders: { key: 'lathe:nav-folders', store: 'session' },
} as const satisfies BrowserStorage;

/** A stored map of rows, or none for anything of another form. */
function readOpenMap(value: unknown): Record<string, boolean> {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.values(value).every(isBool) ? (value as Record<string, boolean>) : {};
}

/** The Nav rows from their stored parts. */
export const navRowFrom = (stored: StoredParts<typeof NAV_ROW_STORAGE>): NavRows => ({ folders: readOpenMap(stored.folders) });

/** Whether a folder row is open. */
export const isFolderOpen = (rows: NavRows, key: string) => rows.folders[key] === true;
