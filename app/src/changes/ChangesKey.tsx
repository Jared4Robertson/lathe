import { useEffect, useMemo, useState } from 'react';
import type { KeyEntry } from '../views/StageChrome';
import { useChanges } from './changes';
import { GHOST_MS, useLiveVersion } from './marks';

// The live marks in a stage's key (LA-V93-R12, LA-V94-R05, LA-V98): what a new record's glow and dot, a changed record's
// pulse and dot, and a removed record's ghost mean, and what Highlight changes does. Every stage's key bar ends with them,
// each only while the stage draws it: a live mark while the product has one, Highlight changes' dimming while it is on.

export type ChangeMark = 'is-added' | 'is-changed' | 'is-removed' | 'is-dimmed';

const ENTRIES: readonly { mark: ChangeMark; words: string; meaning: string }[] = [
  { mark: 'is-added', words: 'New', meaning: 'A new record: a green New pill, a thick outline and a tint (a soft glow as it lands)' },
  { mark: 'is-changed', words: 'Changed', meaning: 'A changed record: an amber Changed pill, a thick outline and a tint (a pulse as it lands)' },
  { mark: 'is-removed', words: 'Removed', meaning: 'A removed record: a red dashed ghost where it was, with a Removed pill' },
  { mark: 'is-dimmed', words: 'Unchanged', meaning: 'With Highlight changes on, everything unchanged is dimmed to a fifth' },
];

/** The key's entries for the given live marks and Highlight changes: each mark the stage can draw now, in a fixed order. */
export function changesKeyEntries(drawn: ReadonlySet<ChangeMark>): KeyEntry[] {
  return ENTRIES.filter((e) => drawn.has(e.mark)).map((e) => ({
    id: `change-${e.mark}`, group: 'changes', sample: <span className={`change-swatch ${e.mark}`} />, words: e.words, meaning: e.meaning,
  }));
}

/** The live marks the stage draws now, for the product in view, and Highlight changes' dimming while it is on. A removed record's ghost counts while it fades. */
export function useChangesKey(): KeyEntry[] {
  const { live, highlight, product, byId } = useChanges();
  const version = useLiveVersion();
  const [tick, setTick] = useState(0);
  const { entries, ghostEnds } = useMemo(() => {
    const drawn = new Set<ChangeMark>();
    const now = performance.now();
    let ends = Infinity;
    for (const m of live.all()) {
      if (product !== null && m.product !== product) continue;
      if (m.change === 'removed' && !highlight) {
        if (now - m.t >= GHOST_MS) continue;
        ends = Math.min(ends, m.t + GHOST_MS - now);
      }
      drawn.add(m.change === 'added' ? 'is-added' : m.change === 'changed' ? 'is-changed' : 'is-removed');
    }
    if (highlight) {
      // The baseline's new and changed records are drawn too (its removed ones have no box); a ghost lasts while Highlight changes is on.
      for (const c of byId.values()) if (c.change !== 'removed') drawn.add(c.change === 'added' ? 'is-added' : 'is-changed');
      drawn.add('is-dimmed');
    }
    return { entries: changesKeyEntries(drawn), ghostEnds: ends };
  }, [live, highlight, product, byId, version, tick]);
  // The last ghost faded: the Removed entry leaves the key.
  useEffect(() => {
    if (ghostEnds === Infinity) return;
    const timer = setTimeout(() => setTick((t) => t + 1), ghostEnds + 50);
    return () => clearTimeout(timer);
  }, [ghostEnds]);
  return entries;
}
