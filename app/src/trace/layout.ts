import { useCallback, useSyncExternalStore } from 'react';
import { readPref, writePref } from '../shell/prefs';

// How the Reader likes the Trace stage drawn (LA-V98-R13): as the tree or as columns. A preference, the window's
// session's like the Graph's layout (graph/settings.ts), shared by every tab and page, never the place's; only the
// person changing it (the Tree | Columns control, the v key) sets it. Kept on its own while the two layouts are compared.

export type TraceLayout = 'tree' | 'columns';
export const TRACE_LAYOUTS: readonly { layout: TraceLayout; label: string; tip: string }[] = [
  { layout: 'tree', label: 'Tree', tip: 'Tree: the product\'s whole tree, each parent beside its children' },
  { layout: 'columns', label: 'Columns', tip: 'Columns: the path to the focus as columns, every box the same size' },
];
export const DEFAULT_TRACE_LAYOUT: TraceLayout = 'columns';
export const TRACE_LAYOUT_KEY = 'lathe:trace-layout';

const isLayout = (v: unknown): v is TraceLayout => v === 'tree' || v === 'columns';
const listeners = new Set<() => void>();
const read = () => readPref<TraceLayout>(TRACE_LAYOUT_KEY, DEFAULT_TRACE_LAYOUT, isLayout, 'session');
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

/** The Trace stage's layout, and its setter for the person's own change. */
export function useTraceLayout(): [TraceLayout, (layout: TraceLayout) => void] {
  const layout = useSyncExternalStore(subscribe, read, read);
  const set = useCallback((next: TraceLayout) => {
    if (next === read()) return;
    writePref(TRACE_LAYOUT_KEY, next, 'session');
    for (const listener of listeners) listener();
  }, []);
  return [layout, set];
}
