import { useCallback, useSyncExternalStore } from 'react';
import type { ChangeReach } from './reads';

// The Graph's Change reach light (LA-V93-R78): while it is on, the Graph lights the focus and every record a change of
// it would touch with the hover spotlight's own light, dimming the rest a step. Whether it is on is the window's, for
// as long as the page is open: the record page's "Light on the Graph" turns it on, the Graph's Picture switch turns it
// on or off. Nothing keeps it.

let on = false;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

/** Turns the light on or off. */
export function setReachLight(next: boolean): void {
  if (next === on) return;
  on = next;
  for (const l of listeners) l();
}

/** Whether the light is on, and a way to turn it on or off. */
export function useReachLight(): [boolean, (next: boolean) => void] {
  const shown = useSyncExternalStore(subscribe, () => on, () => false);
  return [shown, useCallback((next: boolean) => setReachLight(next), [])];
}

/** The records the light lights: the changed records and every record the change touches. */
export const reachLit = (reach: ChangeReach): Set<string> => new Set([...reach.changed, ...reach.groups.flatMap((g) => g.records.map((r) => r.id))]);

/** The lines the light lights: those whose two ends it lights. */
export const reachLitLines = (lit: ReadonlySet<string>, lines: readonly { id: string; source: string; target: string }[]): Set<string> =>
  new Set(lines.filter((l) => lit.has(l.source) && lit.has(l.target)).map((l) => l.id));
