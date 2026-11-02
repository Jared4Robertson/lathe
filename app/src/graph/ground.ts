import { type RecordIndex, type RecordSummary } from '../exploring/record-summaries/record-index';
import { foldedChildren, ownerFolders, sharedKey, type Folder } from '../exploring/folder-tree/folders';
import { composes } from './composition';
import { composedOrder } from './sequence';
import type { MapNode, PlacedMap, TreeGeometry, TreeShape } from './map';
import { keepPlaces, type Was } from './keep-places';
import { LINE_HEIGHT, linesIn, META_FONT, TITLE_FONT, LABEL_PAD_BLOCK, BORDER, type MapLabel, type WrappedLabel } from './text';

// The Graph's Map layout (LA-EXP-DS12), the third beside Tree and Nested, read as people read a map: the product is the
// ground; each domain a district on it (a labeled area, not a box), the product's shared records a district of their
// own; in a district its stages are neighborhoods, left to right in stage order, and in a stage its folders are areas,
// one under another. Records stand on the areas, every leaf record one size, readable at street level (zoom 1, the
// default); a record nests in its parent only when it is its composition (composition.ts), and a container is exactly
// as big as what it holds, packed in reading order. Everything else a record is joined to is a link, drawn as a line
// when it is relevant (GraphPage.tsx).
//
// Sizes go bottom-up. A change moves only what it changed (LA-PAT-APP-UX-R22), as on the ERD: laid out after the
// product's Map before (`kept`, keptGround), every container keeps its children where they were (keep-places.ts): a
// new record goes in free room in its container, growing it only when there is none; a removed one leaves its room;
// a container never shrinks; and one that grew pushes only the siblings it now overlaps. Only Tidy up lays the Map out
// afresh, packed in reading order. Text is the same size everywhere at a given zoom: every record's text scale is 1,
// and the areas' labels keep one size on screen (paint.ts).
//
// Pure: the same tree, and the same Map before, always give the same map. Laid out in the layout's worker (layout.ts).

/** What a node of the Map is: the product's ground, a district, a stage's neighborhood, a folder's area, or a record. */
export type GroundRole = 'ground' | 'district' | 'neighborhood' | 'area' | 'record';
const ROLE_CODES: Readonly<Record<GroundRole, string>> = { ground: 'g', district: 'd', neighborhood: 'n', area: 'a', record: 'r' };
export const roleCode = (role: GroundRole) => ROLE_CODES[role];
export const roleOfCode = (code: string): GroundRole => (Object.keys(ROLE_CODES) as GroundRole[]).find((r) => ROLE_CODES[r] === code) ?? 'record';

/** Every leaf record's box, in map units at text scale 1 (street level): room for its kind and ID line and three title lines. */
export const LEAF_W = 240;
export const LEAF_H = 84;
/** The most title lines a box shows: a longer title ends in an ellipsis (its whole title is in its tooltip and card). */
export const TITLE_LINES = 3;
/**
 * A leaf record's label from afar: where its title at text scale 1 would read under the readable size on screen
 * (paint.ts READABLE_PX), the leaf shows its title alone at this text scale, at most FAR_LINES lines, a longer one ending
 * in an ellipsis, so the records of a framed group read (LA-EXP-DS12). 1.6 is the largest at which two lines fit the leaf.
 */
export const FAR_TEXT = 1.6;
export const FAR_LINES = 2;
/** Inside a record that holds others: its padding, and the gap between two records. */
export const RECORD_PAD = 10;
export const RECORD_GAP = 12;
/** How many leaf records a row holds at least: in a record, in an area. A row takes more as its container fills, to keep it about the screen's shape. */
export const RECORD_COLUMNS = 3;
export const AREA_COLUMNS = 4;
/** The shape a container keeps as it fills, its width over its height: about a screen's, so a framed container reads whole. */
export const PACK_ASPECT = 1.6;
/** Each ground level's header band (where its label sits at street level), padding and gap between its children. */
export const LEVEL = {
  ground: { head: 96, pad: 48, gap: 240 },
  district: { head: 64, pad: 28, gap: 56 },
  neighborhood: { head: 40, pad: 16, gap: 28 },
  area: { head: 30, pad: 12, gap: RECORD_GAP },
} as const;

/** The Map's tree: the product at its root, every node's children in reading order, and what each node is. */
export interface GroundTree {
  root: string | null;
  children: ReadonlyMap<string, readonly string[]>;
  parent: ReadonlyMap<string, string>;
  role: ReadonlyMap<string, GroundRole>;
}

const trees = new WeakMap<RecordIndex, GroundTree>();

/**
 * The Map's tree of a product's space, built once per index: the product's ground; its Shared district (its own stages
 * and loose folders) and each domain's; in each its stages' neighborhoods (with records, in stage order) and loose
 * folders; in each stage its folders' areas (or the records of a stage with one folder); in each area its records, by
 * the nav's folder tree, each record holding its composition (composition.ts, kind by kind, a journey's or flow's steps path by path and by
 * position, sequence.ts) and followed in its area by the
 * records folded under it that are no part of it, each a box of its own. A record composed in another (a test in what
 * it proves) is held by that record, wherever its folder lists it; a stage or folder left with nothing is not drawn.
 */
export function groundTree(index: RecordIndex): GroundTree {
  const known = trees.get(index);
  if (known) return known;
  const children = new Map<string, string[]>();
  const parent = new Map<string, string>();
  const role = new Map<string, GroundRole>();
  const product = index.byId.get(index.product);
  const tree: GroundTree = { root: product ? product.id : null, children, parent, role };
  trees.set(index, tree);
  if (!product) return tree;

  const add = (up: string, id: string, r: GroundRole) => {
    if (role.has(id)) return false;
    role.set(id, r);
    parent.set(id, up);
    const list = children.get(up);
    if (list) list.push(id); else children.set(up, [id]);
    return true;
  };
  const nested = (r: RecordSummary) => {
    const up = r.parent ? index.byId.get(r.parent) : undefined;
    return !!up && composes(up.kind, r.kind);
  };
  /** A record in its container, its composition inside it, and the records folded under it that are no part of it after it in its area. */
  const addRecord = (container: string, area: string, r: RecordSummary) => {
    if (!add(container, r.id, 'record')) return;
    const own = composedOrder(index, (index.children.get(r.id) ?? []).filter((c) => composes(r.kind, c.kind)));
    for (const c of own) addRecord(r.id, area, c);
    for (const c of foldedChildren(index, r)) if (!composes(r.kind, c.kind)) addRecord(area, area, c);
  };
  const addRecords = (area: string, records: readonly RecordSummary[]) => {
    for (const r of records) if (!nested(r)) addRecord(area, area, r);
  };
  const addFolder = (up: string, f: Folder) => { if (add(up, f.key, 'area')) addRecords(f.key, f.records); };
  const addOwner = (owner: string, district: string) => {
    const folders = ownerFolders(index, owner);
    for (const stage of folders.stages) {
      if (stage.count === 0 || !add(district, stage.key, 'neighborhood')) continue;
      if (stage.direct) addRecords(stage.key, stage.direct.records);
      else for (const f of stage.folders) if (f.count > 0) addFolder(stage.key, f);
    }
    for (const f of folders.loose) addFolder(district, f);
  };
  role.set(product.id, 'ground');
  const shared = ownerFolders(index, product.id);
  if (shared.stages.some((s) => s.count > 0) || shared.loose.length > 0) {
    add(product.id, sharedKey(product.id), 'district');
    addOwner(product.id, sharedKey(product.id));
  }
  for (const d of index.domains) if (add(product.id, d.id, 'district')) addOwner(d.id, d.id);

  // A stage or folder whose records are all held elsewhere is not drawn.
  const prune = (id: string): boolean => {
    const own = children.get(id) ?? [];
    const kept = own.filter((c) => prune(c));
    if (kept.length !== own.length) children.set(id, kept);
    const r = role.get(id);
    if (r === 'record' || r === 'ground' || kept.length > 0) return true;
    role.delete(id);
    parent.delete(id);
    children.delete(id);
    return false;
  };
  prune(product.id);
  return tree;
}

/** A node's parent in the Map's tree, or null at the ground. */
export const groundParent = (index: RecordIndex, id: string): string | null => groundTree(index).parent.get(id) ?? null;
/** A node's children in the Map's tree, in reading order. */
export const groundChildren = (index: RecordIndex, id: string): readonly string[] => groundTree(index).children.get(id) ?? [];

// ---------- The layout ----------

/**
 * A label's lines at text scale 1 in a box `width` wide: at most TITLE_LINES lines in all past the first kind and ID
 * line, so every leaf's label fits its box; a title cut short ends in an ellipsis (its whole title is in its tooltip
 * and its card).
 */
export function groundLines(label: MapLabel, width: number, centered: boolean, titleLines = TITLE_LINES): WrappedLabel {
  const lines = linesIn(label, width, centered);
  const most = Math.max(1, titleLines - Math.max(0, lines.meta.length - 1));
  if (lines.title.length <= most) return lines;
  const kept = lines.title.slice(0, most);
  kept[most - 1] = `${kept[most - 1].trimEnd().replace(/\s*\S{0,2}$/, '')}…`;
  return { ...lines, title: kept };
}

/** A leaf's title alone at FAR_TEXT in a box `width` wide, at most FAR_LINES lines, the last ending in an ellipsis when cut. */
export function farLines(title: string, width: number): WrappedLabel {
  return groundLines({ title, meta: '' }, width / FAR_TEXT, true, FAR_LINES);
}

/** A record container's header band: its kind and ID line and its title, wrapped to its width, at most TITLE_LINES lines of title. */
const recordHeader = (label: MapLabel, width: number) => {
  const lines = groundLines(label, width, false);
  return 2 * (LABEL_PAD_BLOCK + BORDER) + LINE_HEIGHT * (lines.meta.length * META_FONT + lines.title.length * TITLE_FONT);
};

interface Size { w: number; h: number }

/** Boxes of the sizes given packed in reading order, rows left to right at most `most` wide (or one box per row past it), `gap` apart: each one's place from the top left, and the whole. */
export function packRows(sizes: readonly Size[], most: number, gap: number): { at: { x: number; y: number }[]; w: number; h: number } {
  const at: { x: number; y: number }[] = [];
  let x = 0;
  let y = 0;
  let row = 0;
  let w = 0;
  for (const s of sizes) {
    if (x > 0 && x + s.w > most) { y += row + gap; x = 0; row = 0; }
    at.push({ x, y });
    x += s.w + gap;
    row = Math.max(row, s.h);
    w = Math.max(w, x - gap);
  }
  return { at, w, h: sizes.length === 0 ? 0 : y + row };
}

/** Boxes side by side, their tops aligned, `gap` apart. */
const packRow = (sizes: readonly Size[], gap: number) => packRows(sizes, Infinity, gap);

/**
 * Boxes in rows, in reading order, `gap` apart, the rows as wide as keeps the whole about PACK_ASPECT (its room's area
 * times the aspect, square-rooted), and never narrower than `columns` leaves or the widest box. Three or more large
 * boxes whose aimed width falls just short of two side by side would stand in one tall column: then the rows take two,
 * when that keeps the whole nearer the aspect.
 */
export function packShaped(sizes: readonly Size[], columns: number, gap: number) {
  const room = sizes.reduce((a, s) => a + (s.w + gap) * (s.h + gap), 0);
  const aimed = packRows(sizes, Math.max(rowOf(columns, gap), ...sizes.map((s) => s.w), Math.sqrt(room * PACK_ASPECT)), gap);
  if (sizes.length < 3 || aimed.at.some((p) => p.x > 0)) return aimed;
  const paired = packRows(sizes, Math.max(...sizes.map((s) => s.w)) * 2 + gap, gap);
  const off = (shape: { w: number; h: number }) => Math.abs(Math.log(shape.w / shape.h / PACK_ASPECT));
  return off(paired) < off(aimed) ? paired : aimed;
}

/** The widest row of `n` leaves, `gap` apart. */
const rowOf = (n: number, gap: number) => n * LEAF_W + (n - 1) * gap;

/**
 * A place snapped to a thousandth of a map unit: a box kept where it was is placed again from its parent's corner, and
 * snapping makes that sum land on the very place it had, however many changes it is kept through.
 */
const snap = (v: number) => Math.round(v * 1000) / 1000;

/** A container's inside's corner from its own: its padding across, its header band down. */
const insetX = (role: GroundRole) => (role === 'record' ? RECORD_PAD : LEVEL[role].pad);
/** The padding under a container's inside. */
const insetBottom = (role: GroundRole) => (role === 'record' ? RECORD_PAD : LEVEL[role].pad);

/**
 * Each node's box in the Map before (`previous`), for the shape's nodes in order, five numbers each: its x and y from
 * its parent's inside's corner (a root's from the map's), its width, height and header band; NaN for a node the Map
 * before did not hold, or held under another parent. What placeGround keeps.
 */
export function keptGround(shape: TreeShape, previous: GroundMap): Float64Array {
  const kept = new Float64Array(shape.ids.length * 5).fill(NaN);
  shape.ids.forEach((id, i) => {
    const was = previous.nodes.get(id);
    const up = shape.parents[i] < 0 ? null : shape.ids[shape.parents[i]];
    if (!was || was.parent !== up) return;
    const parent = up === null ? null : previous.nodes.get(up)!;
    const ox = parent ? parent.x + insetX(parent.role) : 0;
    const oy = parent ? parent.y + parent.header : 0;
    kept.set([snap(was.x - ox), snap(was.y - oy), was.w, was.h, was.header], i * 5);
  });
  return kept;
}

/**
 * Lays out the Map's tree (LA-EXP-DS12), each node's label by `labelOf` and what it is by `roleOf` (by its place in the
 * shape): bottom-up, every leaf record LEAF_W by LEAF_H, every container as big as what it holds, packed in reading
 * order; or, with `kept` (keptGround's), every container's children kept where they were (keep-places.ts). Pure: the
 * same shape, labels, roles and boxes before always give the same geometry. Each node's five numbers are its x, y,
 * width, height and header band.
 */
export function placeGround(shape: TreeShape, labelOf: (i: number) => MapLabel, roleOf: (i: number) => GroundRole, kept: Float64Array | null = null): TreeGeometry {
  const boxes = new Float64Array(shape.ids.length * 5);
  const size: Size[] = new Array(shape.ids.length);
  const header = new Float64Array(shape.ids.length);
  /** Each node's children's places inside it, from its top left. */
  const inside: { x: number; y: number }[][] = new Array(shape.ids.length);

  /** A node's box before, if kept: its place inside its parent, its size and its header band. */
  const before = (i: number): (Was & { header: number }) | undefined => {
    if (!kept || !Number.isFinite(kept[i * 5])) return undefined;
    const b = i * 5;
    return { x: kept[b], y: kept[b + 1], width: kept[b + 2], height: kept[b + 3], header: kept[b + 4] };
  };
  /** A container's children kept where they were, in the room they had; null to pack them afresh. */
  const keptInside = (i: number, role: GroundRole, kids: readonly Size[], gap: number) => {
    const was = before(i);
    if (!was || (role === 'record' && was.header === 0)) return null;
    const room = { width: was.width - 2 * insetX(role), height: was.height - was.header - insetBottom(role) };
    const laid = keepPlaces(kids.map((k, n) => ({ id: String(shape.children[i][n]), width: k.w, height: k.h })), (c) => before(Number(c)), { gap, aspect: PACK_ASPECT, room, fill: true, beside: role === 'district' ? 'right' : 'shape' });
    return laid && { at: laid.children.map((c) => ({ x: c.x, y: c.y })), w: laid.width, h: laid.height };
  };

  /** A node's size, its children's sized first. */
  const measure = (i: number): Size => {
    const own = shape.children[i];
    const kids = own.map(measure);
    const role = roleOf(i);
    if (role === 'record') {
      if (own.length === 0) { header[i] = 0; inside[i] = []; return (size[i] = { w: LEAF_W, h: LEAF_H }); }
      const packed = keptInside(i, role, kids, RECORD_GAP) ?? packShaped(kids, RECORD_COLUMNS, RECORD_GAP);
      const w = Math.max(LEAF_W, packed.w + 2 * RECORD_PAD);
      header[i] = recordHeader(labelOf(i), w);
      inside[i] = packed.at.map((p) => ({ x: RECORD_PAD + p.x, y: header[i] + p.y }));
      return (size[i] = { w, h: header[i] + packed.h + RECORD_PAD });
    }
    const level = LEVEL[role];
    // A ground in rows of districts; a district's neighborhoods left to right, in stage order; a neighborhood's areas and
    // an area's records (or a stage's with one folder) in rows, in reading order, kept about the screen's shape.
    const holdsRecords = own.length > 0 && own.every((c) => roleOf(c) === 'record');
    const packed = keptInside(i, role, kids, holdsRecords ? RECORD_GAP : level.gap) ?? (role === 'ground'
      ? packGrid(kids, Math.max(1, Math.ceil(Math.sqrt(kids.length))), level.gap)
      : role === 'district'
        ? packRow(kids, level.gap)
        : holdsRecords
          ? packShaped(kids, AREA_COLUMNS, RECORD_GAP)
          : packShaped(kids, 1, level.gap));
    header[i] = level.head;
    inside[i] = packed.at.map((p) => ({ x: level.pad + p.x, y: level.head + p.y }));
    return (size[i] = { w: Math.max(LEAF_W, packed.w) + 2 * level.pad, h: level.head + packed.h + level.pad });
  };
  /** Each node at its place, its children inside it. */
  const place = (i: number, x: number, y: number) => {
    boxes.set([snap(x), snap(y), size[i].w, size[i].h, header[i]], i * 5);
    shape.children[i].forEach((c, k) => place(c, x + inside[i][k].x, y + inside[i][k].y));
  };
  const tops = shape.roots.map((r) => shape.ids.indexOf(r));
  let y = 0;
  let width = 0;
  for (const t of tops) {
    const s = measure(t);
    place(t, 0, y);
    y += s.h + LEVEL.ground.gap;
    width = Math.max(width, s.w);
  }
  return { boxes, width, height: tops.length === 0 ? 0 : y - LEVEL.ground.gap };
}

/**
 * Boxes in rows of `perRow`, in reading order, `gap` apart, each row as tall as its tallest: the ground's districts, about
 * as many to a row as rows (the square root of their count), so a district's own growth never moves one into another row.
 */
export function packGrid(sizes: readonly Size[], perRow: number, gap: number): { at: { x: number; y: number }[]; w: number; h: number } {
  const at: { x: number; y: number }[] = [];
  let y = 0;
  let w = 0;
  for (let k = 0; k < sizes.length; k += perRow) {
    const row = sizes.slice(k, k + perRow);
    let x = 0;
    for (const s of row) { at.push({ x, y }); x += s.w + gap; }
    w = Math.max(w, x - gap);
    y += Math.max(...row.map((s) => s.h)) + gap;
  }
  return { at, w, h: sizes.length === 0 ? 0 : y - gap };
}

// ---------- The map ----------

/** A Map node: what it is, its header band, its place in reading order, and how many records it holds. */
export interface GroundNode extends MapNode {
  role: GroundRole;
  /** Its header band's height, in map units: 0 for a leaf record. */
  header: number;
  /** Its place in the tree's order, a parent before its children: the keyboard's order. */
  order: number;
  /** How many records it holds, at every depth: an area's count, a district's. */
  count: number;
  /** A leaf record's label from afar, its title alone at FAR_TEXT; null for every other node. */
  far: WrappedLabel | null;
}

export interface GroundMap extends PlacedMap {
  view: 'map';
  nodes: ReadonlyMap<string, GroundNode>;
}

class GroundBox implements GroundNode {
  private wrapped: WrappedLabel | null = null;
  private farWrapped: WrappedLabel | null = null;
  readonly text = 1;
  constructor(
    readonly id: string, readonly parent: string | null, readonly children: readonly string[], readonly level: number, readonly order: number,
    readonly role: GroundRole, readonly count: number,
    readonly x: number, readonly y: number, readonly w: number, readonly h: number, readonly header: number, private readonly label: MapLabel,
  ) {}
  get centered() { return this.children.length === 0; }
  get lines(): WrappedLabel {
    return (this.wrapped ??= groundLines(this.label, this.w - 2 * BORDER, this.centered));
  }
  get far(): WrappedLabel | null {
    if (this.role !== 'record' || this.children.length > 0) return null;
    return (this.farWrapped ??= farLines(this.label.title, this.w - 2 * BORDER));
  }
}

/** A Map from its tree's shape, labels, roles and geometry (placeGround's, here or in the layout's worker). */
export function assembleGround(shape: TreeShape, labelOf: (i: number) => MapLabel, roleOf: (i: number) => GroundRole, geometry: TreeGeometry): GroundMap {
  const nodes = new Map<string, GroundNode>();
  const byLevel: GroundNode[][] = [];
  const { ids } = shape;
  const { boxes } = geometry;
  const counts = new Int32Array(ids.length);
  for (let i = ids.length - 1; i >= 0; i--) {
    const up = shape.parents[i];
    if (up >= 0) counts[up] += counts[i] + (roleOf(i) === 'record' ? 1 : 0);
  }
  ids.forEach((id, i) => {
    const up = shape.parents[i];
    const b = i * 5;
    const node = new GroundBox(id, up < 0 ? null : ids[up], shape.children[i].map((c) => ids[c]), shape.levels[i], i, roleOf(i), counts[i], boxes[b], boxes[b + 1], boxes[b + 2], boxes[b + 3], boxes[b + 4], labelOf(i));
    nodes.set(id, node);
    (byLevel[node.level] ??= []).push(node);
  });
  return { view: 'map', nodes, roots: shape.roots, byLevel, width: geometry.width, height: geometry.height };
}

