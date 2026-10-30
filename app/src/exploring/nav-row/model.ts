import { isBool } from '../../shell/prefs';

// The Nav row aggregate (LA-EXP-A3) as the app keeps it: which rows of the nav the Reader has open or folded. Its
// folders (a domain, a stage, a kind group, by row key) are kept for the browser session; its own sections (Tools)
// from one launch to the next. A folder not named is folded; a section not named is open.

export interface NavRows {
  /** Each folder row's state by row key: true open, false folded. */
  folders: Readonly<Record<string, boolean>>;
  /** Each section's state by section ID: false folded. */
  sections: Readonly<Record<string, boolean>>;
}

/** A stored map of rows, or none for anything of another form. */
export function readOpenMap(value: unknown): Record<string, boolean> {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.values(value).every(isBool) ? (value as Record<string, boolean>) : {};
}

/** Whether a folder row is open. */
export const isFolderOpen = (rows: NavRows, key: string) => rows.folders[key] === true;
/** Whether a section is open. */
export const isSectionOpen = (rows: NavRows, id: string) => rows.sections[id] !== false;
