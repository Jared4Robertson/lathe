import { type RecordIndex } from '../exploring/record-summaries/record-index';

// Every stage is one map (LA-PAT-APP-UX-R19): the Graph (map.ts), the Trace stage (trace/all.ts)
// and the ERD each lay a product out as one map, off the main thread and again only when what it reads
// changes (layout.ts, erd/layout.ts), and every box keeps its
// place whatever is focused or filtered and however deep the depth shows. One way for each move:
// - focusing moves the camera only, framing the focus with the shared glide (gestures.ts) and the
//   shared framing (camera.ts frameRect, the graph's frameOnMap);
// - a filter, the depth or a focus that shows part of the map fades the rest (fade.ts keptFade),
//   never takes it out or lays the map out again;
// - a stage switch keeps the focus and lands the camera on it at once;
// - each frame draws only what is in view.
//
// What a stage works out of the data before it lays it out (the Trace stage's tree of chains) is cached
// by the spec's index, which is built anew on every data change: the index's identity is the data's
// version, so it is worked out once for each. The layout itself is keyed by what it reads (layout.ts).

/** What a stage works out of one product's data, built on first use for each index (each data change) and then read. */
export function onePerData<T>(build: (index: RecordIndex, product: string) => T): (index: RecordIndex, product: string) => T {
  const cache = new WeakMap<RecordIndex, Map<string, T>>();
  return (index, product) => {
    let maps = cache.get(index);
    if (!maps) { maps = new Map(); cache.set(index, maps); }
    if (maps.has(product)) return maps.get(product)!;
    const map = build(index, product);
    maps.set(product, map);
    return map;
  };
}
