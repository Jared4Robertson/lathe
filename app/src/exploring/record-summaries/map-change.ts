// A map's change from one state to the next, as its entries that differ: what the space's index worker sends the page
// (space-index.ts), so the page puts in only what changed and never rebuilds a lookup of a large product whole.

/** The entries of a map that differ from the map before: each key with its new value, or null where it is gone. */
export type MapChange<V> = [key: string, value: V | null][];

/** The entries of `next` that differ from `before` (by `same`), and the keys `before` has that `next` has not. */
export function mapChange<V, W = V>(before: ReadonlyMap<string, V>, next: ReadonlyMap<string, V>, same: (a: V, b: V) => boolean, wire: (value: V) => W): MapChange<W> {
  if (before === next) return [];
  const change: MapChange<W> = [];
  for (const [key, value] of next) {
    const was = before.get(key);
    if (was === undefined || !same(was, value)) change.push([key, wire(value)]);
  }
  for (const key of before.keys()) if (!next.has(key)) change.push([key, null]);
  return change;
}

/**
 * `before` with a change put in: the very map when nothing changed, else a copy with each changed entry set or deleted
 * (`unwire` turns a sent value back into the page's own). A new key goes at the end, so a map whose order is read must
 * be put in order again by its owner.
 */
export function patchMap<V, W = V>(before: ReadonlyMap<string, V>, change: MapChange<W>, unwire: (value: W) => V): ReadonlyMap<string, V> {
  if (change.length === 0) return before;
  const next = new Map(before);
  for (const [key, value] of change) {
    if (value === null) next.delete(key);
    else next.set(key, unwire(value));
  }
  return next;
}

/** Two lists with the same items in the same order (each the very same item). */
export const sameItems = <T>(a: readonly T[], b: readonly T[]): boolean => a === b || (a.length === b.length && a.every((x, i) => x === b[i]));
