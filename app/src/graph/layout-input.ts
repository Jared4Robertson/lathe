import type { FaceSource, GraphFonts } from './fonts';
import { treeShape, type TreeShape } from './map';
import type { Shape } from './shapes';
import { mapLabel, treeLabel, type Face, type MapLabel, type TextMeasure } from './text';
import { treeChildren } from './tree';
import { groundChildren, groundTree, roleCode, roleOfCode, type GroundRole } from './ground';
import type { RecordIndex } from '../exploring/record-summaries/record-index';

// What a map's layout reads (layout.ts), packed into one string: each node's parent and label, in its shape's order, with
// the text measure's key. It is both the layout's key (two inputs with the same string lay out the same) and what the
// layout's worker is sent, so a map is laid out again only when something it reads has changed, whatever reloaded.

/** A map's layout input: its view, its shape, its labels (and in the Map, what each node is), and its packed form. */
export interface MapInput {
  view: 'tree' | 'nested' | 'map';
  shape: TreeShape;
  labels: readonly MapLabel[];
  /** Each node's role in the Map layout (ground.ts), in its shape's order; empty in the other layouts. */
  roles: readonly GroundRole[];
  /** The packed input with the view and measure: the layout's key, and what the worker unpacks. */
  packed: string;
}

const FIELD = '\u0000';
const NODE = '\u0001';

/** A map's input from its roots, children and labels (each given its parent: and in the Map, each node's role), measured by `measure`. */
export function mapInput(view: MapInput['view'], roots: readonly string[], childrenOf: (id: string) => readonly string[], labelOf: (id: string, parent: string | null) => MapLabel, measure: string, roleOf?: (id: string) => GroundRole): MapInput {
  const shape = treeShape(roots, childrenOf);
  const labels = shape.ids.map((id, i) => labelOf(id, shape.parents[i] < 0 ? null : shape.ids[shape.parents[i]]));
  const roles = roleOf ? shape.ids.map((id) => roleOf(id)) : [];
  const parts: string[] = [`${view}${FIELD}${measure}`];
  labels.forEach((l, i) => parts.push(`${shape.parents[i]}${FIELD}${l.title}${FIELD}${l.meta}${FIELD}${l.shape ?? ''}${FIELD}${l.marks ?? 0}${FIELD}${roles.length > 0 ? roleCode(roles[i]) : ''}`));
  return { view, shape, labels, roles, packed: parts.join(NODE) };
}

// Kept by the records, tree answer and meta model it was made from, as the tree is (tree.ts): the problems and coverage
// that answer after the records on a reload change no label, so the map is not made again for them.
const products = new WeakMap<RecordIndex['folders'], { byId: RecordIndex['byId']; meta: RecordIndex['meta']; inputs: Map<string, MapInput> }>();
/**
 * A product's map's input (or a tree's no product reaches), from its root, in the Graph's Tree or Nested view, or the
 * product's Map (its ground, whatever the root): made once per records, tree answer and meta model.
 */
export function productInput(index: RecordIndex, root: string, view: MapInput['view'], measure: string): MapInput {
  let kept = products.get(index.folders);
  if (!kept || kept.byId !== index.byId || kept.meta !== index.meta) { kept = { byId: index.byId, meta: index.meta, inputs: new Map() }; products.set(index.folders, kept); }
  const known = kept.inputs;
  const key = `${view}|${measure}|${root}`;
  let input = known.get(key);
  if (!input) {
    if (view === 'map') {
      const ground = groundTree(index);
      input = mapInput(view, ground.root ? [ground.root] : [], (id) => groundChildren(index, id), (id, parent) => mapLabel(index, id, parent), measure, (id) => ground.role.get(id) ?? 'record');
    } else {
      input = mapInput(view, [root], (id) => treeChildren(index, id), (id, parent) => (view === 'tree' ? treeLabel(index, id) : mapLabel(index, id, parent)), measure);
    }
    known.set(key, input);
  }
  return input;
}

/** The shape, labels and roles a packed input holds (the worker's side): its nodes named by their places. */
export function unpackInput(packed: string, roots: readonly number[]): { shape: TreeShape; labels: MapLabel[]; roles: GroundRole[] } {
  const nodes = packed.split(NODE).slice(1);
  const parents = new Int32Array(nodes.length);
  const levels = new Int32Array(nodes.length);
  const children: number[][] = nodes.map(() => []);
  const roles: GroundRole[] = [];
  const labels: MapLabel[] = nodes.map((node, i) => {
    const [parent, title, meta, shape, marks, role] = node.split(FIELD);
    if (role) roles.push(roleOfCode(role));
    const up = Number(parent);
    parents[i] = up;
    if (up >= 0) { children[up].push(i); levels[i] = levels[up] + 1; }
    return { title, meta, ...(shape ? { shape: shape as Shape } : {}), marks: Number(marks) };
  });
  const ids = nodes.map((_, i) => String(i));
  return { shape: { roots: roots.map(String), ids, parents, levels, children }, labels, roles };
}

/** Strings whose widths, in each face, tell two measures apart: the page's and the worker's must agree on them. */
const PROBES = ['Hamburgefontsiv', 'Use case · LA-EXP-UC03', 'MW@% il1 0123456789', 'Data files changed'];
export const probeOf = (m: TextMeasure): number[] => (['title', 'eyebrow', 'mono', 'badge'] as Face[]).flatMap((face) => PROBES.map((p) => m.em(p, face)));

/** What the page sends the worker, and what it answers. */
export type LayoutRequest =
  | { type: 'fonts'; fonts: GraphFonts; faces: FaceSource[] }
  | { type: 'layout'; id: number; view: MapInput['view']; packed: string; roots: number[]; kept: Float64Array | null };
export type LayoutReply =
  | { type: 'ready'; measure: string; probe: number[] }
  | { type: 'laid'; id: number; boxes: Float64Array; width: number; height: number; ms: number };
