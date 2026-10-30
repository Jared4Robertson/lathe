import { useMemo } from 'react';
import type { RecordIndex } from '../exploring/record-summaries/record-index';
import { useAnnounce, useCommand } from '../shell/commands';
import { CHANGE_LABEL } from './ChangeDetails';
import { useChanges } from './changes';
import { useLiveVersion } from './marks';

// Next change and Previous change (LA-EXP-UC15-R06): `]` and `[` walk the stage's focus through the product's new and
// changed records in reading order, which is ID order (the order the nav, the lists and the panel keep, numbers
// compared by value), from the focus on: the next one after it, the previous one before it, around at the ends. Each
// step is announced with where it is in the walk. A removed record has no box to focus, so the walk skips it.

const collator = new Intl.Collator('en', { numeric: true });

/** The records to walk, in reading order. */
export function changedInReadingOrder(ids: Iterable<string>): string[] {
  return [...new Set(ids)].sort((a, b) => collator.compare(a, b));
}

/** The record a step from `focus` reaches in a walk: the next one after it (or the first), the previous one before it (or the last); null for an empty walk. */
export function stepChange(walk: readonly string[], focus: string, step: 1 | -1): { id: string; at: number } | null {
  if (walk.length === 0) return null;
  const here = walk.indexOf(focus);
  let at: number;
  if (here >= 0) at = (here + step + walk.length) % walk.length;
  else {
    // The focus is no change: the walk goes on from where it would stand in the order.
    const after = walk.findIndex((id) => collator.compare(id, focus) > 0);
    at = step === 1 ? (after >= 0 ? after : 0) : (after > 0 ? after - 1 : walk.length - 1);
  }
  return { id: walk[at]!, at };
}

/** The Next change and Previous change commands, for the stage in view: they move the focus the way the stage's own moves do. */
export function useJumpChanges(index: RecordIndex, focus: string, onNavigate: (id: string) => void) {
  const { byId, live, product } = useChanges();
  const version = useLiveVersion();
  const announce = useAnnounce();
  const walk = useMemo(() => {
    const ids: string[] = [];
    for (const c of byId.values()) if (c.change !== 'removed') ids.push(c.id);
    for (const m of live.all()) if (m.product === product && m.change !== 'removed') ids.push(m.id);
    return changedInReadingOrder(ids.filter((id) => index.byId.has(id)));
  }, [byId, live, product, index, version]);
  const jump = (step: 1 | -1) => {
    const to = stepChange(walk, focus, step);
    if (!to) { announce('No new or changed records to go to'); return; }
    onNavigate(to.id);
    const change = byId.get(to.id)?.change ?? live.get(to.id)?.change;
    announce(`${step === 1 ? 'Next' : 'Previous'} change: ${index.byId.get(to.id)?.title ?? to.id}${change ? `, ${CHANGE_LABEL[change].toLowerCase()}` : ''}, ${to.at + 1} of ${walk.length}`);
  };
  useCommand('nextChange', () => jump(1), product !== null);
  useCommand('previousChange', () => jump(-1), product !== null);
}
