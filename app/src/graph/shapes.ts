import type { SpecIndex } from '../specs/data';

// A shape for each kind (LA-V93-R06): a secondary cue, after the label, that keeps a box's
// rectangular footprint so boxes still stack. In the Tree view (and a trace) a box's outline is its
// kind's shape; in the Nested and Voronoi views a box keeps its rectangle or cell and shows its
// shape as a small mark before its kind and ID line (shape-icons.tsx).
//
// Every outline here is drawn by the canvas (paint.ts) in one of three ways:
// - a polygon (`clipped`): filled, and its edge drawn inside it, so the border follows the outline
//   in every state (hover, focus and a tap's selection color the edge);
// - rounded corners (`radius`), its border, ring and focus outline following them;
// - a plain box with a drawing inside it (a second border, a top bar, stripes).
// Notches and corners grow with the box (its box scale), at most a fraction of its side. Each
// shape keeps its label in a safe area: `room`, at text scale 1, past the usual padding, which
// the map keeps when it wraps and sizes the label (text.ts) and the canvas pads by, so no line
// or badge meets a notch or a corner.
//
// Pure data and geometry, with no React, so the Voronoi worker can read it.

export type Shape =
  | 'box' | 'product' | 'hexagon' | 'folder' | 'slice'
  | 'double' | 'octagon' | 'flag' | 'parallelogram' | 'stadium' | 'page' | 'stack'
  | 'chevron-bar' | 'chevron' | 'window' | 'port' | 'stripes' | 'component' | 'shield'
  | 'diamond';

/** A small glyph a kind adds before its kind and ID line: a shape shared with another kind, told apart. */
export type Mark = 'value' | 'gear' | 'lens' | 'marker' | 'ruler' | 'port' | 'target' | 'data';

export interface KindShape { shape: Shape; mark?: Mark }

/** The room a shape keeps clear of its label, past the usual padding, at text scale 1: left, right, top and bottom. */
export interface Room { l: number; r: number; t: number; b: number }

const NO_ROOM: Room = { l: 0, r: 0, t: 0, b: 0 };

interface ShapeSpec {
  /** What the key calls it, and which kinds are drawn in it. */
  name: string;
  kinds: string;
  room: Room;
  /** How it is drawn: a polygon, rounded corners, or a box (with a drawing inside it). */
  draw: 'clipped' | 'radius' | 'box';
}

/** Every shape the graph draws, in the key's order: structure, then stage by stage, then open questions. */
export const SHAPES: Readonly<Record<Shape, ShapeSpec>> = {
  product: { name: 'a large rounded box', kinds: 'Product', room: { l: 0, r: 4, t: 0, b: 0 }, draw: 'radius' },
  hexagon: { name: 'a hexagon', kinds: 'Domain', room: { l: 12, r: 12, t: 0, b: 0 }, draw: 'clipped' },
  folder: { name: 'a folder with a tab', kinds: 'Stage, folder or group, with its count', room: { l: 0, r: 0, t: 8, b: 0 }, draw: 'clipped' },
  double: { name: 'a double border', kinds: 'Aggregate', room: { l: 2, r: 2, t: 2, b: 2 }, draw: 'box' },
  box: { name: 'a plain box', kinds: 'Entity (a business outcome, value object, read model, domain service, term, integration or test data set with its mark), and any kind a product adds', room: NO_ROOM, draw: 'box' },
  octagon: { name: 'an octagon', kinds: 'Constraint, invariant, specification, pattern rule (a policy with a gear, a standard rule with a ruler)', room: NO_ROOM, draw: 'clipped' },
  flag: { name: 'a flag, notched on the right', kinds: 'Domain event', room: { l: 0, r: 10, t: 0, b: 0 }, draw: 'clipped' },
  parallelogram: { name: 'a slanted box', kinds: 'Command (a query with a lens)', room: { l: 8, r: 8, t: 0, b: 0 }, draw: 'clipped' },
  slice: { name: 'a slice pointing right', kinds: 'Capability', room: { l: 0, r: 8, t: 0, b: 0 }, draw: 'clipped' },
  stadium: { name: 'a stadium', kinds: 'Use case', room: { l: 4, r: 8, t: 0, b: 0 }, draw: 'radius' },
  page: { name: 'a page with a folded corner', kinds: 'UC requirement, view requirement, API requirement', room: { l: 0, r: 10, t: 0, b: 0 }, draw: 'clipped' },
  stack: { name: 'stacked boxes', kinds: 'Pattern (a standard with a ruler)', room: { l: 0, r: 5, t: 5, b: 0 }, draw: 'clipped' },
  'chevron-bar': { name: 'a chevron bar', kinds: 'Flow', room: { l: 6, r: 16, t: 0, b: 0 }, draw: 'clipped' },
  chevron: { name: 'a chevron', kinds: 'Flow step', room: { l: 6, r: 6, t: 0, b: 0 }, draw: 'clipped' },
  window: { name: 'a window with a top bar', kinds: 'View', room: { l: 0, r: 0, t: 6, b: 0 }, draw: 'box' },
  port: { name: 'a box with a port notch on its left', kinds: 'Endpoint', room: { l: 2, r: 0, t: 0, b: 0 }, draw: 'clipped' },
  component: { name: 'a box with component tabs', kinds: 'Technical records: repository, data model, value type, predicate, event type, projection, handlers, service, UI component, adapter', room: { l: 4, r: 0, t: 0, b: 0 }, draw: 'clipped' },
  stripes: { name: 'a striped box', kinds: 'Table', room: { l: 0, r: 0, t: 5, b: 5 }, draw: 'box' },
  shield: { name: 'a shield', kinds: 'Every kind of test', room: { l: 0, r: 0, t: 0, b: 6 }, draw: 'clipped' },
  diamond: { name: 'a diamond', kinds: 'Open question', room: { l: 14, r: 14, t: 2, b: 2 }, draw: 'clipped' },
};

/** What each mark tells apart, for the key. */
export const MARKS: Readonly<Record<Mark, string>> = {
  value: 'a tag: a value object, drawn as a plain box',
  gear: 'a gear: a policy (drawn as a rule) or a domain service (a plain box), logic that runs on its own',
  lens: 'a lens: a query (drawn as a command) or a read model (a plain box), what is read',
  marker: 'a marker: a glossary term, drawn as a plain box',
  ruler: 'a ruler: a standard or a standard rule, drawn as a pattern or a pattern rule',
  port: 'a port: an integration, drawn as a plain box',
  target: 'a target: a business outcome, drawn as a plain box',
  data: 'a cylinder: a test data set, drawn as a plain box',
};

const TECHNICAL: KindShape = { shape: 'component' };
const TEST: KindShape = { shape: 'shield' };

const KIND_SHAPES: Readonly<Record<string, KindShape>> = {
  product: { shape: 'product' },
  business_outcome: { shape: 'box', mark: 'target' },
  domain: { shape: 'hexagon' },
  aggregate: { shape: 'double' },
  entity: { shape: 'box' },
  value_object: { shape: 'box', mark: 'value' },
  constraint: { shape: 'octagon' },
  invariant: { shape: 'octagon' },
  specification: { shape: 'octagon' },
  domain_event: { shape: 'flag' },
  command: { shape: 'parallelogram' },
  read_model: { shape: 'box', mark: 'lens' },
  query: { shape: 'parallelogram', mark: 'lens' },
  policy: { shape: 'octagon', mark: 'gear' },
  domain_service: { shape: 'box', mark: 'gear' },
  term: { shape: 'box', mark: 'marker' },
  capability: { shape: 'slice' },
  use_case: { shape: 'stadium' },
  uc_requirement: { shape: 'page' },
  pattern: { shape: 'stack' },
  pattern_rule: { shape: 'octagon' },
  flow: { shape: 'chevron-bar' },
  flow_step: { shape: 'chevron' },
  view: { shape: 'window' },
  view_requirement: { shape: 'page' },
  endpoint: { shape: 'port' },
  api_requirement: { shape: 'page' },
  integration: { shape: 'box', mark: 'port' },
  repository: TECHNICAL,
  data_model: TECHNICAL,
  table: { shape: 'stripes' },
  value_type: TECHNICAL,
  predicate: TECHNICAL,
  event_type: TECHNICAL,
  projection: TECHNICAL,
  command_handler: TECHNICAL,
  query_handler: TECHNICAL,
  event_handler: TECHNICAL,
  service: TECHNICAL,
  ui_component: TECHNICAL,
  endpoint_handler: TECHNICAL,
  adapter: TECHNICAL,
  standard: { shape: 'stack', mark: 'ruler' },
  standard_rule: { shape: 'octagon', mark: 'ruler' },
  test_data_set: { shape: 'box', mark: 'data' },
  constraint_test: TEST,
  invariant_test: TEST,
  specification_test: TEST,
  policy_test: TEST,
  domain_service_test: TEST,
  use_case_test: TEST,
  view_test: TEST,
  endpoint_test: TEST,
  flow_test: TEST,
  integration_test: TEST,
  pattern_rule_test: TEST,
  standard_rule_test: TEST,
  question: { shape: 'diamond' },
};

const PLAIN: KindShape = { shape: 'box' };
const FOLDER: KindShape = { shape: 'folder' };

/** A kind's shape and mark; a group (a stage or a folder) is a folder, and a kind a product adds is a plain box. */
export const shapeOf = (kind: string, group = false): KindShape => (group ? FOLDER : KIND_SHAPES[kind] ?? PLAIN);

/** A node's shape by its ID: a record's kind's, a group's folder, a file's plain box. */
export function nodeShape(index: SpecIndex, id: string): KindShape {
  const record = index.byId.get(id);
  if (record) return shapeOf(record.kind);
  return id.startsWith('file:') ? PLAIN : FOLDER;
}

/** A point of an outline: `fx` of the width plus `dx`, `fy` of the height plus `dy`. */
type Pt = readonly [fx: number, dx: number, fy: number, dy: number];

/** A notch or corner: `px` at box scale 1, grown with the box, at most `cap` of its side. */
const notch = (px: number, scale: number, side: number, cap: number) => Math.min(px * scale, side * cap);

/** The polygon of a clipped shape, for a box `w` by `h` at a box scale, as points relative to its edges. */
function polygonOf(shape: Shape, w: number, h: number, scale: number): Pt[] | null {
  switch (shape) {
    case 'hexagon': {
      const c = notch(12, scale, w, 0.25);
      return [[0, c, 0, 0], [1, -c, 0, 0], [1, 0, 0.5, 0], [1, -c, 1, 0], [0, c, 1, 0], [0, 0, 0.5, 0]];
    }
    case 'folder': {
      const t = notch(8, scale, h, 0.25);
      const x = notch(64, scale, w, 0.4);
      return [[0, 0, 0, 0], [0, x, 0, 0], [0, x + t, 0, t], [1, 0, 0, t], [1, 0, 1, 0], [0, 0, 1, 0]];
    }
    case 'slice': {
      const p = notch(16, scale, w, 0.25);
      return [[0, 0, 0, 0], [1, -p, 0, 0], [1, 0, 0.5, 0], [1, -p, 1, 0], [0, 0, 1, 0]];
    }
    case 'octagon': {
      const c = Math.min(notch(8, scale, w, 0.25), notch(8, scale, h, 0.25));
      return [[0, c, 0, 0], [1, -c, 0, 0], [1, 0, 0, c], [1, 0, 1, -c], [1, -c, 1, 0], [0, c, 1, 0], [0, 0, 1, -c], [0, 0, 0, c]];
    }
    case 'flag': {
      const n = notch(14, scale, w, 0.25);
      return [[0, 0, 0, 0], [1, 0, 0, 0], [1, -n, 0.5, 0], [1, 0, 1, 0], [0, 0, 1, 0]];
    }
    case 'parallelogram': {
      const s = notch(10, scale, w, 0.2);
      return [[0, s, 0, 0], [1, 0, 0, 0], [1, -s, 1, 0], [0, 0, 1, 0]];
    }
    case 'page': {
      const f = Math.min(notch(11, scale, w, 0.25), notch(11, scale, h, 0.34));
      return [[0, 0, 0, 0], [1, -f, 0, 0], [1, 0, 0, f], [1, 0, 1, 0], [0, 0, 1, 0]];
    }
    case 'stack': {
      const k = Math.min(notch(5, scale, h, 0.17), notch(5, scale, w, 0.1));
      return [[0, 0, 0, k], [0, k, 0, k], [0, k, 0, 0], [1, 0, 0, 0], [1, 0, 1, -k], [1, -k, 1, -k], [1, -k, 1, 0], [0, 0, 1, 0]];
    }
    case 'chevron-bar':
    case 'chevron': {
      const c = notch(12, scale, w, 0.25);
      return [[0, 0, 0, 0], [1, -c, 0, 0], [1, 0, 0.5, 0], [1, -c, 1, 0], [0, 0, 1, 0], [0, c, 0.5, 0]];
    }
    case 'port': {
      const d = notch(6, scale, w, 0.12);
      const p = notch(5, scale, h, 0.25);
      return [[0, 0, 0, 0], [1, 0, 0, 0], [1, 0, 1, 0], [0, 0, 1, 0], [0, 0, 0.5, p], [0, d, 0.5, p], [0, d, 0.5, -p], [0, 0, 0.5, -p]];
    }
    case 'component': {
      const t = notch(6, scale, w, 0.12);
      const half = notch(3.5, scale, h, 0.08);
      const tab = (fy: number): Pt[] => [[0, t, fy, half], [0, 0, fy, half], [0, 0, fy, -half], [0, t, fy, -half]];
      return [[0, t, 0, 0], [1, 0, 0, 0], [1, 0, 1, 0], [0, t, 1, 0], ...tab(0.7), ...tab(0.3)];
    }
    case 'shield': {
      const b = notch(12, scale, h, 0.34);
      return [[0, 0, 0, 0], [1, 0, 0, 0], [1, 0, 1, -b], [0.5, 0, 1, 0], [0, 0, 1, -b]];
    }
    case 'diamond': {
      const d = notch(22, scale, w, 0.25);
      const e = notch(4, scale, h, 0.1);
      return [[0, 0, 0.5, 0], [0, d, 0, e], [0.5, 0, 0, 0], [1, -d, 0, e], [1, 0, 0.5, 0], [1, -d, 1, -e], [0.5, 0, 1, 0], [0, d, 1, -e]];
    }
    default:
      return null;
  }
}

/** A rounded shape's corner radii, for a box `w` by `h` at a box scale: rx, ry. */
function radiiOf(shape: Shape, w: number, h: number, scale: number): [number, number] | null {
  const r = (px: number) => Math.min(px * scale, w / 2, h / 2);
  if (shape === 'product') return [r(18), r(18)];
  if (shape === 'stadium') return [r(24), r(24)];
  return null;
}

/** The notch a decoration inside a shape lines up with (a page's fold, a stack's front sheet, a flow's inner chevron), in map units. */
export function notchOf(shape: Shape, w: number, h: number, scale: number): number {
  const points = polygonOf(shape, w, h, scale);
  if (shape === 'page') return points![1][1] * -1;
  if (shape === 'stack') return points![1][1];
  if (shape === 'chevron-bar') return points![1][1] * -1;
  return 0;
}

/**
 * A node's outline as the canvas draws it, in map units: a polygon's corners, a rounded box's
 * radii (an ellipse's are half its sides), or a box with the shared corner radius.
 */
export type Outline =
  | { kind: 'polygon'; points: [number, number][] }
  | { kind: 'round'; rx: number; ry: number };

/** The shared corner radius of a plain box, in map units. */
export const BOX_RADIUS = 4;

/** A shape's outline for a box at a box scale (LA-V93-R06). */
export function outlineOf(shape: Shape, r: Rect, scale: number): Outline {
  const points = polygonOf(shape, r.w, r.h, scale);
  if (points) return { kind: 'polygon', points: points.map(([fx, dx, fy, dy]) => [r.x + fx * r.w + dx, r.y + fy * r.h + dy]) };
  const radii = radiiOf(shape, r.w, r.h, scale);
  return radii ? { kind: 'round', rx: radii[0], ry: radii[1] } : { kind: 'round', rx: Math.min(BOX_RADIUS, r.w / 2, r.h / 2), ry: Math.min(BOX_RADIUS, r.w / 2, r.h / 2) };
}

type Rect = { x: number; y: number; w: number; h: number };

/**
 * How far in from its box a node's outline is on one side at a height in it (map units): 0 for a
 * box's straight side; a polygon's edge where it crosses that height; a rounded corner's curve.
 */
export function outlineInset(r: Rect, shape: Shape, scale: number, y: number, side: 'left' | 'right'): number {
  const at = Math.min(r.h, Math.max(0, y - r.y));
  const points = polygonOf(shape, r.w, r.h, scale);
  if (points) {
    const xy = points.map(([fx, dx, fy, dy]) => [fx * r.w + dx, fy * r.h + dy] as const);
    const xs: number[] = [];
    for (let i = 0; i < xy.length; i++) {
      const [x1, y1] = xy[i];
      const [x2, y2] = xy[(i + 1) % xy.length];
      if (y1 === y2) { if (y1 === at) xs.push(x1, x2); continue; }
      const t = (at - y1) / (y2 - y1);
      if (t >= 0 && t <= 1) xs.push(x1 + t * (x2 - x1));
    }
    if (xs.length === 0) return 0;
    return side === 'left' ? Math.min(...xs) : r.w - Math.max(...xs);
  }
  const radii = radiiOf(shape, r.w, r.h, scale);
  if (!radii) return 0;
  const [rx, ry] = radii;
  const dy = Math.min(at, r.h - at);
  if (dy >= ry || ry === 0) return 0;
  const k = (ry - dy) / ry;
  return rx * (1 - Math.sqrt(Math.max(0, 1 - k * k)));
}
