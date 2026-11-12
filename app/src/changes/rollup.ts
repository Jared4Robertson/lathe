import type { RecordChange } from './changes';

// Roll-ups of the changes (LA-EXP-UC15-R07): every container (a domain, a stage, a folder, an aggregate) says how many
// records under it are new, changed or removed, on its box and in the nav, so changes are findable zoomed out. A record
// no longer in the data has no box, so a removed record counts under the nearest container its ID names (its ID,
// without its last parts, until one is a record), as the IDs nest: LA-EXP-UC15-R03-T01 under LA-EXP-UC15-R03.

export type Change = RecordChange['change'];

/** How many records are new, changed and removed. */
export interface ChangeCounts { added: number; changed: number; removed: number }

const hasChanges = (c: ChangeCounts | undefined): c is ChangeCounts => !!c && c.added + c.changed + c.removed > 0;
export const totalChanges = (c: ChangeCounts) => c.added + c.changed + c.removed;

/** "3 new · 5 changed · 1 removed", leaving out what is zero; empty for no changes. */
export function rollupText(c: ChangeCounts): string {
  return [c.added && `${c.added} new`, c.changed && `${c.changed} changed`, c.removed && `${c.removed} removed`].filter(Boolean).join(' · ');
}

/** The same in the fewest characters, for the nav: "+3 ~5 −1" (a mark and a count, so it reads without color). */
export function rollupShort(c: ChangeCounts): string {
  return [c.added && `+${c.added}`, c.changed && `~${c.changed}`, c.removed && `−${c.removed}`].filter(Boolean).join(' ');
}

/** The nearest record that holds an ID by name: the ID without its last dash-separated parts, until one `has`; null for none. */
export function anchorOf(id: string, has: (id: string) => boolean): string | null {
  for (let at = id.lastIndexOf('-'); at > 0; at = id.lastIndexOf('-', at - 1)) {
    const up = id.slice(0, at);
    if (has(up)) return up;
  }
  return null;
}

/**
 * Each container's counts: for every place of the map, the changes strictly under it. `change` says a place's own change
 * (undefined for none); `removed` lists the places the removed records are counted under (each also counts under that
 * place's own containers). A place with nothing under it has no entry.
 */
export function rollUps(
  nodes: ReadonlyMap<string, { parent: string | null }>,
  change: (place: string) => Change | undefined,
  removed: Iterable<string | null> = [],
): Map<string, ChangeCounts> {
  const out = new Map<string, ChangeCounts>();
  const add = (from: string | null, kind: Change) => {
    for (let at = from; at !== null; at = nodes.get(at)?.parent ?? null) {
      let c = out.get(at);
      if (!c) { c = { added: 0, changed: 0, removed: 0 }; out.set(at, c); }
      c[kind]++;
    }
  };
  for (const place of nodes.keys()) {
    const c = change(place);
    if (c && c !== 'removed') add(nodes.get(place)?.parent ?? null, c);
  }
  for (const place of removed) if (place !== null && nodes.has(place)) add(place, 'removed');
  return out;
}

/** The changes the nav counts beside its folders: by the records a folder lists, and by domain. */
export interface NavChanges {
  /** The counts for the records a row lists (a removed record counts with the row of the record its ID names); undefined for none. */
  ofRecords: (ids: Iterable<string>) => ChangeCounts | undefined;
  /** The counts for a domain's records; undefined for none. */
  ofDomain: (domain: string) => ChangeCounts | undefined;
}

export function navChanges(index: { byId: ReadonlyMap<string, { domain: string | null }> }, changes: ReadonlyMap<string, { change: Change }>): NavChanges {
  const removedUnder = new Map<string, number>();
  const byDomain = new Map<string, ChangeCounts>();
  const bump = (domain: string | null, kind: Change) => {
    if (domain === null) return;
    let c = byDomain.get(domain);
    if (!c) { c = { added: 0, changed: 0, removed: 0 }; byDomain.set(domain, c); }
    c[kind]++;
  };
  for (const [id, { change }] of changes) {
    if (change === 'removed') {
      const up = anchorOf(id, (x) => index.byId.has(x));
      if (up !== null) { removedUnder.set(up, (removedUnder.get(up) ?? 0) + 1); bump(index.byId.get(up)?.domain ?? up, 'removed'); }
    } else bump(index.byId.get(id)?.domain ?? null, change);
  }
  return {
    ofRecords(ids) {
      const n: ChangeCounts = { added: 0, changed: 0, removed: 0 };
      for (const id of ids) {
        const c = changes.get(id)?.change;
        if (c && c !== 'removed') n[c]++;
        n.removed += removedUnder.get(id) ?? 0;
      }
      return hasChanges(n) ? n : undefined;
    },
    ofDomain: (domain) => byDomain.get(domain),
  };
}
