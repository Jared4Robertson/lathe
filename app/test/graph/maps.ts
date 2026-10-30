import type { RecordIndex } from '../../src/exploring/record-summaries/record-index';
import { assembleTree, placeTree, treeShape, type GraphMap } from '../../src/graph/map';
import { assembleNested, placeNested, type NestedMap } from '../../src/graph/nested';
import { mapLabel, textMeasure, treeLabel, type MapLabel } from '../../src/graph/text';
import { treeChildren } from '../../src/graph/tree';
import { assembleGround, groundChildren, groundTree, placeGround, type GroundMap } from '../../src/graph/ground';

// The maps the app lays out in the layout's worker (app/src/graph/layout.ts), laid out on the test's thread by the same
// placeTree and placeNested: a tree given by its roots, children and labels, and a product's map from its index.

const plain = (id: string): MapLabel => ({ title: id, meta: '' });

/** A tree as an icicle (the Tree map), each node's label its ID unless given. */
export function layoutTree(roots: readonly string[], childrenOf: (id: string) => readonly string[], labelOf: (id: string) => MapLabel = plain): GraphMap {
  const shape = treeShape(roots, childrenOf);
  const labels = shape.ids.map((id) => labelOf(id));
  return assembleTree(shape, (i) => labels[i], placeTree(shape, (i) => labels[i]));
}

/** A tree as nested squares (the Nested map), each node's label its ID unless given. */
export function layoutNested(roots: readonly string[], childrenOf: (id: string) => readonly string[], labelOf: (id: string) => MapLabel = plain): NestedMap {
  const shape = treeShape(roots, childrenOf);
  const labels = shape.ids.map((id) => labelOf(id));
  return assembleNested(shape, (i) => labels[i], placeNested(shape, (i) => labels[i]));
}

/** Each index's maps, by view, text measure and root: as the app keeps a layout for one input, one per index here. */
const made = new WeakMap<RecordIndex, Map<string, GraphMap | NestedMap | GroundMap>>();
function once<M extends GraphMap | NestedMap | GroundMap>(index: RecordIndex, key: string, make: () => M): M {
  let maps = made.get(index);
  if (!maps) { maps = new Map(); made.set(index, maps); }
  const full = `${key}|${textMeasure().key}`;
  if (!maps.has(full)) maps.set(full, make());
  return maps.get(full) as M;
}

/** A product's Tree map (or a tree's no product reaches), from its root, as the Graph lays it out. */
export const graphMap = (index: RecordIndex, root: string): GraphMap =>
  once(index, `tree|${root}`, () => layoutTree([root], (id) => treeChildren(index, id), (id) => treeLabel(index, id)));

/** A product's Nested map, from its root, as the Graph lays it out. */
export const nestedMap = (index: RecordIndex, root: string): NestedMap =>
  once(index, `nested|${root}`, () => layoutNested([root], (id) => treeChildren(index, id), (id) => mapLabel(index, id)));

/** A product's Map (its ground), as the Graph lays it out. */
export const groundMap = (index: RecordIndex): GroundMap =>
  once(index, 'map', () => {
    const tree = groundTree(index);
    const shape = treeShape(tree.root ? [tree.root] : [], (id) => groundChildren(index, id));
    const labels = shape.ids.map((id) => mapLabel(index, id));
    const roles = shape.ids.map((id) => tree.role.get(id) ?? 'record');
    return assembleGround(shape, (i) => labels[i], (i) => roles[i], placeGround(shape, (i) => labels[i], (i) => roles[i]));
  });
