import { useCallback, useState } from 'react';
import { isNumber, readPref, writePref } from '../shell/prefs';
import type { GraphLayout, GraphSettings } from './GraphPage';
import { NO_FILTERS } from './model';

// How the graph is drawn (its layout, depth, filters, Links switch and minimap) is one
// reader setting for the browser session, shared by every tab and every page (LA-V93-R72). Moving
// through the graph (an arrow step, a click or Enter on a box, a link, a tab, Back or Forward)
// never changes it; only the person changing a setting does: the toolbar, and the v and +/- keys.
// Kept apart from GraphPage.tsx, which is loaded with import() when the graph is first shown.

export const GRAPH_KEY = 'lathe:graph-settings';
export const DEFAULT_GRAPH_SETTINGS: GraphSettings = { layout: 'tree', depth: 1, filters: NO_FILTERS, links: false, minimap: false };

interface StoredSettings { layout: GraphLayout; depth: number; hiddenKinds: string[]; hiddenRelations: string[]; links: boolean; minimap: boolean }
/** Stored settings in today's form; anything else (an older form included) is dropped for the defaults. */
const isStored = (v: unknown): v is StoredSettings => {
  if (!v || typeof v !== 'object') return false;
  const s = v as StoredSettings;
  return (s.layout === 'tree' || s.layout === 'nested' || s.layout === 'voronoi') && isNumber(s.depth) && Array.isArray(s.hiddenKinds) && Array.isArray(s.hiddenRelations)
    && typeof s.links === 'boolean' && typeof s.minimap === 'boolean';
};
const isAny = (_v: unknown): _v is unknown => true;

/** The session's graph settings, or the defaults when none are stored. */
export function graphSettings(): GraphSettings {
  const s = readPref<unknown>(GRAPH_KEY, null, isAny, 'session');
  if (!isStored(s)) return DEFAULT_GRAPH_SETTINGS;
  return {
    layout: s.layout,
    depth: [1, 2, 3].includes(s.depth) ? s.depth : 1,
    filters: { hiddenKinds: new Set(s.hiddenKinds), hiddenRelations: new Set(s.hiddenRelations) },
    links: s.links,
    minimap: s.minimap,
  };
}

/** Sets the session's graph settings: only the person changing a setting calls this. */
export function saveGraphSettings(s: GraphSettings) {
  const stored: StoredSettings = { layout: s.layout, depth: s.depth, hiddenKinds: [...s.filters.hiddenKinds], hiddenRelations: [...s.filters.hiddenRelations], links: s.links, minimap: s.minimap };
  writePref(GRAPH_KEY, stored, 'session');
}

/** The session's graph settings, and the setter for the person's own changes. */
export function useGraphSettings() {
  const [settings, setState] = useState(graphSettings);
  const set = useCallback((s: GraphSettings) => { saveGraphSettings(s); setState(s); }, []);
  return [settings, set] as const;
}
