import { levelMove, nearestBox, readingOrder, type Move, type StageLevels } from '../views/levels';
import type { WalkBar } from '../views/StageChrome';
import type { ErdFocus, ErdMap, Rect } from './erd';

// The ERD stage's walk (LA-V61-R49): the stage walk's levels (views/levels.ts) over the map as the picture shows it,
// never the record tree: the product, its domains' regions, each region's aggregate areas, each area's entities. Out
// goes to the box around, In to the first box inside it in reading order. An arrow moves to the nearest box that way
// among the box's siblings, the boxes in the same area (or region, or the product's regions), by their centers: those
// overlapping its row (Left and Right) or column (Up and Down) first, then the shortest distance. At an area's edge it
// goes on to the next area's first box at that level in reading order (Right and Down), or the previous area's last
// (Left and Up), so repeated presses visit every entity, aggregate and region. Faded boxes count: a step into a faded
// area brings it into focus. Pure geometry over the map's one layout (layout.ts), tested directly.

/** On a phone, the walk's bar (LA-V93-R76): Previous and Next along a row, Left and Right; Up and Down, which step by column, stay in More. */
export const ERD_WALK_BAR: WalkBar = { previous: 'left', next: 'right', more: ['up', 'down'] };

const levelsCache = new WeakMap<ErdMap, WeakMap<ReadonlyMap<string, Rect>, StageLevels>>();

/** The map's boxes as levels, placed by the layout: each box's children in reading order. */
export function erdLevels(map: ErdMap, rects: ReadonlyMap<string, Rect>): StageLevels {
  let byRects = levelsCache.get(map);
  if (!byRects) { byRects = new WeakMap(); levelsCache.set(map, byRects); }
  const known = byRects.get(rects);
  if (known) return known;
  const parents = new Map(map.boxes.map((b) => [b.id, b.parent ?? map.product]));
  const inside = new Map<string, { id: string; rect: Rect }[]>();
  for (const b of map.boxes) {
    const rect = rects.get(b.id);
    if (!rect) continue;
    const up = parents.get(b.id)!;
    const list = inside.get(up);
    if (list) list.push({ id: b.id, rect }); else inside.set(up, [{ id: b.id, rect }]);
  }
  const ordered = new Map([...inside].map(([id, boxes]) => [id, readingOrder(boxes)]));
  const children = new Map([...ordered].map(([id, boxes]) => [id, boxes.map((b) => b.id)]));
  const levels: StageLevels = {
    root: map.product,
    parent: (id) => (id === map.product ? null : parents.get(id) ?? null),
    children: (id) => children.get(id) ?? [],
    across: (id, direction) => {
      const from = rects.get(id);
      const siblings = ordered.get(parents.get(id) ?? '') ?? [];
      return from ? nearestBox(from, siblings.filter((b) => b.id !== id), direction) : null;
    },
  };
  byRects.set(rects, levels);
  return levels;
}

/** Where the walk stands on the map for a focus: its picked-out box, else its scope's box (a domain's region), else the product. */
export function erdAt(map: ErdMap, at: ErdFocus): string {
  const boxes = new Set(map.boxes.map((b) => b.id));
  return at.pick && boxes.has(at.pick) ? at.pick : boxes.has(at.scope) ? at.scope : map.product;
}

/** Where a move goes on the map from a focus, or null where there is nowhere to go. */
export const erdTarget = (map: ErdMap, rects: ReadonlyMap<string, Rect>, at: ErdFocus, move: Move): string | null => levelMove(erdLevels(map, rects), erdAt(map, at), move);
