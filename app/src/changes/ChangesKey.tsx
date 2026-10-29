import { useEffect, useMemo, useState } from 'react';
import type { KeyEntry } from '../views/StageChrome';
import { useChanges } from './changes';
import { GHOST_MS, useLiveVersion } from './marks';

// The live marks in a stage's key (LA-V93-R12, LA-V94-R05, LA-V98): what a new record's glow and dot, a changed record's
// pulse and dot, and a removed record's ghost mean, and what the Changes lens does. Every stage's key bar ends with them,
// each only while the stage draws it: a live mark while the product has one, the lens's dimming while it is on.

export type ChangeMark = 'is-added' | 'is-changed' | 'is-removed' | 'is-lens';

const ENTRIES: readonly { mark: ChangeMark; words: string; meaning: string }[] = [
  { mark: 'is-added', words: 'New', meaning: 'New as the data reloaded: a soft glow, then a dot' },
  { mark: 'is-changed', words: 'Changed', meaning: 'Changed as the data reloaded: a pulse in its own color, then a dot' },
  { mark: 'is-removed', words: 'Removed', meaning: 'Removed as the data reloaded: a ghost of its outline, fading' },
  { mark: 'is-lens', words: 'Unchanged', meaning: 'With the Changes lens on, everything unchanged is dimmed' },
];

/** The key's entries for the given live marks and lens: each mark the stage can draw now, in a fixed order. */
export function changesKeyEntries(drawn: ReadonlySet<ChangeMark>): KeyEntry[] {
  return ENTRIES.filter((e) => drawn.has(e.mark)).map((e) => ({
    id: `change-${e.mark}`, group: 'changes', sample: <span className={`change-swatch ${e.mark}`} />, words: e.words, meaning: e.meaning,
  }));
}

/** The live marks the stage draws now, for the product in view, and the lens's dimming while it is on. A removed record's ghost counts while it fades. */
export function useChangesKey(): KeyEntry[] {
  const { live, lens, product } = useChanges();
  const version = useLiveVersion();
  const [tick, setTick] = useState(0);
  const { entries, ghostEnds } = useMemo(() => {
    const drawn = new Set<ChangeMark>();
    const now = performance.now();
    let ends = Infinity;
    for (const m of live.all()) {
      if (product !== null && m.product !== product) continue;
      if (m.change === 'removed') {
        if (now - m.t >= GHOST_MS) continue;
        ends = Math.min(ends, m.t + GHOST_MS - now);
      }
      drawn.add(m.change === 'added' ? 'is-added' : m.change === 'changed' ? 'is-changed' : 'is-removed');
    }
    if (lens) drawn.add('is-lens');
    return { entries: changesKeyEntries(drawn), ghostEnds: ends };
  }, [live, lens, product, version, tick]);
  // The last ghost faded: the Removed entry leaves the key.
  useEffect(() => {
    if (ghostEnds === Infinity) return;
    const timer = setTimeout(() => setTick((t) => t + 1), ghostEnds + 50);
    return () => clearTimeout(timer);
  }, [ghostEnds]);
  return entries;
}
