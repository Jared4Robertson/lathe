// The ERD stage of any address, /<id>?stage=erd (LA-V94).
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { Background, Controls, Handle, Position, ReactFlow, ReactFlowProvider, useReactFlow, useStore, ViewportPortal, type Edge, type EdgeProps, type Node, type NodeProps } from '@xyflow/react';
import type { RelationRule, SpecIndex } from '../specs/data';
import { relationLabelOf } from '../specs/labels';
import { useCameraGestures } from '../graph/gestures';
import { frameRect, type Viewport } from '../graph/camera';
import { PLAIN_LOOK, useThemeVersion } from '../graph/look';
import type { FadeLook } from '../graph/fade';
import { Button } from '../components/Button';
import { lowerLabel } from '../plural';
import { ERD_EMPTY, erdFocus, erdMap, erdStrength, LINE_WORDS, lineGeometry, lineOffsets, RELATION_ENDS, scopeContents, type ErdBox, type ErdFocus, type ErdKind, type ErdLine, type ErdMap, type ErdRelation, type Rect } from './erd';
import { erdLayout, readyErdLayout } from './layout';
import { TapCard, useTapToOpen } from '../graph/touch';
import { EdgeHints } from './hints';
import { ErdLeader } from './leader';
import { useOpenSpace, type OpenSpaceStore } from '../views/openSpace';
import { useWalk } from '../graph/steps';
import { ARROW_DIRECTION, erdStep } from './walk';
import { useChanges, type LiveMark } from '../changes/changes';
import { GHOST_MS, lensFade, markPhase, useStageMarks } from '../changes/marks';
import { ChangesKey } from '../changes/ChangesKey';

// The ERD stage: one map of the whole product (LA-V94-R08), each domain a region, its aggregates
// boundaries around their entities, drawn with React Flow and laid out once by ELK (layout.ts).
// A focus never moves a box: it fades what lies outside its scope (the graph's focus fade), picks
// out its box, and the camera glides to frame it with the shared camera (graph/gestures.ts). Clicking
// a box goes to it, as a graph node does. A key floating at the foot of the open space explains the
// boxes and the lines. Like the graph it never reads the address, and frames itself in the open space
// it is given.

/** What a box is called, in its accessible name, the key and the touch card. */
export const BOX_KIND: Record<ErdKind, string> = { domain: 'Domain', aggregate: 'Aggregate', entity: 'Entity' };

/** The key's lines in order, each with what its label alone does not say (its whole meaning is the entry's tooltip). */
const LINE_KEY: Record<ErdRelation, { note: string; meaning: string }> = {
  has_one: { note: '1:1', meaning: 'An entity has one of the other: one to one.' },
  has_many: { note: '1:n', meaning: 'An entity has many of the other: one to many.' },
  references: { note: '', meaning: "A field holds the other aggregate's ID; the line points at its root." },
};
const LINE_ORDER = Object.keys(LINE_KEY) as ErdRelation[];

/** A map past this many boxes draws only those in view; a smaller one draws them all, so its boxes are always in the page for the keyboard. */
export const DRAW_IN_VIEW_PAST = 150;

export interface ErdViewProps {
  index: SpecIndex;
  focus: string;
  onNavigate: (id: string) => void;
  /** Called with the box under the pointer or keyboard focus (`hover`) and the one selected by a first tap (`selected`), for the chat's app_focus. */
  onPeek?: (kind: 'hover' | 'selected', id: string | null) => void;
  /** Called with what the focus's scope holds, for the header strip: "4 entities · 3 lines". */
  onCounts?: (counts: string) => void;
  /** The open space the host's floating panels leave over the stage, where the focus is framed. */
  space?: OpenSpaceStore;
}

/**
 * `strength`: how strongly the box is drawn, 1 in the focus's scope (the focus fade). `pick`: the box the focus picks out.
 * `mark`: its live change (changes/marks.ts), drawn by the stylesheet: a new box's glow, a changed box's pulse, and a dot.
 */
interface BoxData extends Record<string, unknown> { box: ErdBox; focus: boolean; pick: boolean; strength: number; mark: { change: 'added' | 'changed'; t: number; moving: boolean } | null }
/**
 * `label`: the line's words, read from its source, from the schema's relations (LA-V92-R07) or the
 * ERD view's own for a reference. `title`: the whole sentence, for its tooltip. `hover`: the fields
 * shown on a dashed reference line while it is hovered, or null.
 */
interface LineData extends Record<string, unknown> { line: ErdLine; source: Rect; target: Rect; offset: number; label: string; title: string; hover: string | null; strength: number }
type BoxNode = Node<BoxData>;
type LineEdge = Edge<LineData>;

/** A line's label, in sentence case: the relation's own words, or the ERD view's for a reference. */
export function lineLabel(relations: readonly RelationRule[], relation: ErdRelation): string {
  const own = LINE_WORDS[relation];
  if (own) return own.charAt(0).toUpperCase() + own.slice(1);
  return relationLabelOf(relations, relation);
}

/** A closed box's kind line: "Aggregate", or "Domain · no aggregates yet" for an empty one. */
const kindLine = (box: ErdBox) => `${BOX_KIND[box.kind]}${box.empty ? ` · no ${box.kind === 'domain' ? 'aggregates' : 'entities'} yet` : ''}`;

/** A faded box's or line's strength, for its style. */
const strengthStyle = (strength: number) => ({ '--erd-strength': String(strength) }) as CSSProperties;

/** Below this zoom a region's head is too small to read, and its name shows over it at a readable size. */
export const REGION_LABEL_BELOW = 0.6;

interface Region { id: string; title: string; rect: Rect; strength: number }

/**
 * Each domain's name at the top left of its region when the map is zoomed out (the overview's level
 * of detail), at one size on screen above everything drawn, so every region reads by name at any
 * zoom. It follows the camera, fades with its region, and lets the pointer through.
 */
function RegionLabels({ regions }: { regions: readonly Region[] }) {
  const [x, y, zoom] = useStore((s) => s.transform);
  if (zoom >= REGION_LABEL_BELOW) return null;
  return (
    <div className="erd-region-labels" aria-hidden="true">
      {regions.map((r) => (
        <span
          key={r.id}
          className="erd-region-label"
          style={{ left: x + r.rect.x * zoom + 4, top: y + r.rect.y * zoom + 4, maxWidth: Math.max(140, r.rect.width * zoom - 8), opacity: r.strength }}
        >
          {r.title}
        </span>
      ))}
    </div>
  );
}

function BoxView({ data }: NodeProps<BoxNode>) {
  const { box } = data;
  const faded = data.strength < 1;
  const { mark } = data;
  const classes = ['erd-box', `erd-${box.kind}`, data.pick && 'is-highlight', data.focus && 'is-focus', faded && 'is-faded', mark && `has-change is-${mark.change}`].filter(Boolean).join(' ');
  return (
    <div className={classes} title={`${box.title} (${box.id})`} style={faded ? strengthStyle(data.strength) : undefined} data-change={mark?.change}>
      {/* A new box's glow or a changed box's pulse, once as it lands (keyed by when, so a second change plays it again); the dot lasts. */}
      {mark?.moving && <span key={mark.t} className="erd-change-flash" aria-hidden="true" />}
      {mark && <span className="erd-change-dot" aria-hidden="true" />}
      <Handle type="target" position={Position.Left} className="erd-handle" isConnectable={false} />
      <Handle type="source" position={Position.Right} className="erd-handle" isConnectable={false} />
      <div className="erd-box-head">
        <strong>{box.title}</strong>
        {box.root && <span className="erd-root" title="The aggregate's root entity">root</span>}
      </div>
      {box.kind !== 'entity' && <small className="erd-summary">{kindLine(box)}</small>}
      {box.fields.length > 0 && (
        <ul className="erd-fields" aria-label={`Fields of ${box.title}`}>
          {box.fields.map((f) => <li key={f.field} title={`${f.field}: ${f.kind}`}><span className="erd-field">{f.field}</span><span className="erd-field-kind">{f.kind}</span></li>)}
        </ul>
      )}
    </div>
  );
}

function LineView({ data }: EdgeProps<LineEdge>) {
  if (!data) return null;
  const { line } = data;
  const g = lineGeometry(data.source, data.target, [line.sourceEnd, line.targetEnd], data.offset);
  const mid = { x: (g.from.x + g.to.x) / 2, y: (g.from.y + g.to.y) / 2 };
  const faded = data.strength < 1;
  return (
    <g
      className={`erd-line rel-${line.relation}${line.dashed ? ' is-dashed' : ''}${faded ? ' is-faded' : ''}${data.hover ? ' has-hover-label' : ''}`}
      data-line={line.id}
      data-ends={`${line.sourceEnd}-${line.targetEnd}`}
      style={faded ? strengthStyle(data.strength) : undefined}
    >
      <title>{data.title}</title>
      {/* A wider, unseen stroke to hover, so a thin dashed line is easy to point at. */}
      {data.hover && <path className="erd-line-hit" d={g.line} />}
      <path className="erd-line-path" d={g.line} />
      {g.sourceEnd && <path className="erd-end" d={g.sourceEnd} />}
      {g.targetEnd && <path className="erd-end" d={g.targetEnd} />}
      {data.hover && <text className="erd-line-label" x={mid.x} y={mid.y - 6} textAnchor="middle">{data.hover}</text>}
    </g>
  );
}

/**
 * A line's words: its label, the sentence it says ("Loan has many Reminder", "Loan references by ID
 * Member (Loan.Member)"), and for a dashed reference the fields that show on hover.
 */
export function lineWords(line: ErdLine, label: string, titles: ReadonlyMap<string, string>): { label: string; title: string; hover: string | null } {
  const name = (id: string) => titles.get(id) ?? id;
  const words = lowerLabel(label);
  const sentence = `${name(line.source)} ${words} ${name(line.target)}`;
  const title = line.via.length > 0 ? `${sentence} (${line.via.join('; ')})` : sentence;
  return { label: words, title, hover: line.dashed && line.via.length > 0 ? line.via.join(', ') : null };
}

const nodeTypes = { box: BoxView };
const edgeTypes = { line: LineView };

/** What a scope holds, for the header strip: "4 entities · 3 lines". */
export const erdCounts = (map: ErdMap, scope: string) => {
  const { boxes, lines } = scopeContents(map, scope);
  const entities = boxes.filter((b) => b.kind === 'entity').length;
  return `${entities} ${entities === 1 ? 'entity' : 'entities'} · ${lines.length} ${lines.length === 1 ? 'line' : 'lines'}`;
};

export function ErdView({ index, focus, onNavigate, onPeek, onCounts, space }: ErdViewProps) {
  const at = useMemo(() => erdFocus(index, focus), [index, focus]);
  const map = useMemo(() => (at ? erdMap(index, at.product) : null), [index, at]);
  useLayoutEffect(() => { onCounts?.(map && at ? erdCounts(map, at.scope) : ''); }, [map, at, onCounts]);
  // The plain arrows walk the map from anywhere (LA-V61-R49): each moves the focus to the nearest box that way on the
  // map, as the picture shows it (walk.ts), read from the map's one layout once it has arrived; each step only moves the camera.
  const target = useCallback((key: string) => {
    const direction = ARROW_DIRECTION[key];
    const rects = at && direction ? readyErdLayout(index, at.product) : undefined;
    return map && at && rects ? erdStep(map, rects, at, direction) : null;
  }, [index, map, at]);
  useWalk(index, focus, target, onNavigate);
  if (!at || !map) return <p className="hint erd-missing">There's no record or group <code>{focus}</code>.</p>;
  const product = index.byId.get(at.product);
  return (
    <section className="erd-page" aria-label={`ERD: The domains of ${product?.title ?? at.product}, their aggregates, entities and relationships`}>
      {map.boxes.length === 0 ? (
        <p className="placeholder erd-empty">{ERD_EMPTY}</p>
      ) : (
        <div className="erd-canvas">
          <ReactFlowProvider>
            <ErdCanvas index={index} map={map} at={at} focus={focus} onNavigate={onNavigate} onPeek={onPeek} space={space} />
          </ReactFlowProvider>
        </div>
      )}
      <div className="erd-tools stage-tools" data-stage-tools="bottom">
        <ErdKey map={map} at={at} relations={index.workspace.relations} />
      </div>
    </section>
  );
}

/** The key under the map: each kind of box, badge and line the map draws, and nothing it does not. */
export function ErdKey({ map, at, relations = [] }: { map: ErdMap; at: ErdFocus; relations?: readonly RelationRule[] }) {
  const [open, setOpen] = useState(false);
  const gridId = useId();
  const sample = (relation: ErdRelation, dashed: boolean) => {
    const g = lineGeometry({ x: 0, y: 0, width: 2, height: 2 }, { x: 34, y: 0, width: 2, height: 2 }, RELATION_ENDS[relation]);
    return (
      <svg className={`erd-key-line rel-${relation}${dashed ? ' is-dashed' : ''}`} viewBox="-2 -9 40 18" width="36" height="18" aria-hidden="true">
        <path className="erd-line-path" d={g.line} />
        {g.sourceEnd && <path className="erd-end" d={g.sourceEnd} />}
        {g.targetEnd && <path className="erd-end" d={g.targetEnd} />}
      </svg>
    );
  };
  const has = (kind: ErdKind) => map.boxes.some((b) => b.kind === kind);
  const lines = [...new Map(map.lines.map((l) => [l.relation, l])).values()].sort((a, b) => LINE_ORDER.indexOf(a.relation) - LINE_ORDER.indexOf(b.relation));
  const faded = at.scope !== map.product && map.boxes.length > scopeContents(map, at.scope).boxes.length;
  // Every entry is a cell of one grid of fixed cells, the boxes' first and then the lines', so a map with other
  // entries never moves the key itself, only what is written in its cells (LA-PAT-APP-UX-R08): each cell is keyed by
  // its place, so it stays where it is and only its words change, and the lines start on a row of their own. A
  // cell's whole meaning is its tooltip.
  const text = (words: string) => <span className="erd-key-text">{words}</span>;
  type Entry = { title: string; mark: ReactNode; words: string };
  const boxes: Entry[] = [
    ...(has('domain') ? [{ title: 'A domain: the region around its aggregates', mark: <span className="erd-key-swatch erd-key-domain" aria-hidden="true" />, words: 'Domain' }] : []),
    ...(has('aggregate') ? [{ title: 'An aggregate: the boundary around its entities, or a closed box', mark: <span className="erd-key-swatch erd-key-aggregate" aria-hidden="true" />, words: 'Aggregate boundary' }] : []),
    ...(has('entity') ? [{ title: 'An entity, with its fields and their types', mark: <span className="erd-key-swatch erd-key-entity" aria-hidden="true" />, words: 'Entity' }] : []),
    ...(map.boxes.some((b) => b.root) ? [{ title: "The aggregate's root entity, the one references point at", mark: <span className="erd-root">root</span>, words: 'Root entity' }] : []),
    ...(at.pick ? [{ title: 'The record in focus, or the nearest entity or aggregate above it', mark: <span className="erd-key-highlight" aria-hidden="true" />, words: 'Picked out' }] : []),
    ...(faded ? [{ title: 'Faded: outside the domain or aggregate in focus', mark: <span className="erd-key-faded" aria-hidden="true" />, words: 'Faded: out of focus' }] : []),
  ];
  const lineEntries: Entry[] = lines.map((l) => {
    const { note, meaning } = LINE_KEY[l.relation];
    return { title: meaning, mark: sample(l.relation, l.dashed), words: `${l.relation === 'references' ? 'Reference by ID' : lineLabel(relations, l.relation)}${note && ` (${note})`}` };
  });
  const cells = (entries: Entry[]) => entries.map((e, i) => <li key={i} title={e.title}>{e.mark} {text(e.words)}</li>);
  return (
    <div
      className={`erd-key${open ? ' is-open' : ''}`}
      role="group"
      aria-label="Key"
      tabIndex={0}
      data-arrows="own"
      onKeyDown={(e) => { if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); } }}
    >
      {/* In a narrow pane the key is one bar: this button opens the whole key over the canvas, moving nothing. */}
      <Button className="erd-key-toggle" aria-expanded={open} aria-controls={gridId} onClick={() => setOpen((o) => !o)}>
        {open ? 'Hide the key' : 'Key'}
      </Button>
      <div className="erd-key-grid" id={gridId}>
        <ul className="erd-key-ends" aria-label="Boxes">{cells(boxes)}</ul>
        <ul className="erd-key-ends" aria-label="Lines">{cells(lineEntries)}</ul>
        <ChangesKey cells />
      </div>
    </div>
  );
}

/** The margin a frame keeps around what it frames: wider at the left, clear of the zoom controls in the bottom left corner. */
export const FIT_MARGIN = { left: 60, right: 24, top: 24, bottom: 24 };
/** The least room, in px, a frame keeps; less frames on the whole stage. */
const MIN_FIT = 120;

/**
 * The viewport that shows the given boxes inside the margin, centered, never zoomed in past 1: the
 * shared framing of every one-map stage (graph/camera.ts `frameRect`, LA-PAT-APP-UX-R19) of the
 * rectangle around them. A small box is framed with the map around it, never blown up.
 */
export function fitRects(rects: Iterable<Rect>, width: number, height: number, margin = FIT_MARGIN): Viewport {
  const all = [...rects];
  const x = Math.min(...all.map((r) => r.x));
  const y = Math.min(...all.map((r) => r.y));
  const around = { x, y, w: Math.max(...all.map((r) => r.x + r.width)) - x, h: Math.max(...all.map((r) => r.y + r.height)) - y };
  const frame = { x: margin.left, y: margin.top, w: Math.max(1, width - margin.left - margin.right), h: Math.max(1, height - margin.top - margin.bottom) };
  return frameRect(around, null, frame, { pad: 0, read: MIN_ZOOM, max: 1, min: MIN_ZOOM });
}

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 2;

/**
 * What the camera frames for a focus: its picked-out box (a domain's region, an aggregate's
 * boundary, an entity), else its scope's, else (a product) the whole map.
 */
export function framedRects(rects: ReadonlyMap<string, Rect>, map: ErdMap, at: ErdFocus): Rect[] {
  const target = at.pick ?? (at.scope === map.product ? null : at.scope);
  const one = target ? rects.get(target) : undefined;
  return one ? [one] : [...rects.values()];
}

/** The focus fade's strength, as the stylesheet sets it at an element. */
function fadeLook(at: HTMLElement | null): Pick<FadeLook, 'focusFade'> {
  const n = at ? parseFloat(getComputedStyle(at).getPropertyValue('--focus-fade')) : NaN;
  return { focusFade: Number.isFinite(n) ? n : PLAIN_LOOK.focusFade };
}

/** A box's accessible name: its kind, title and root mark, and whether the focus picks it out. */
const boxName = (box: ErdBox, pick: boolean) => `${BOX_KIND[box.kind]} ${box.title}${box.root ? ', root' : ''}${box.empty ? `, ${kindLine(box).split(' · ')[1]}` : ''}${pick ? ' (picked out)' : ''}`;

interface CanvasProps { index: SpecIndex; map: ErdMap; at: ErdFocus; focus: string; onNavigate: (id: string) => void; onPeek?: ErdViewProps['onPeek']; space?: OpenSpaceStore }

function ErdCanvas({ index, map, at, focus, onNavigate, onPeek, space }: CanvasProps) {
  const relations = index.workspace.relations;
  // The map's layout: ready at once when this product was laid out before on the same data.
  const [placed, setPlaced] = useState<{ map: ErdMap; rects: Map<string, Rect> } | null>(() => {
    const rects = readyErdLayout(index, at.product);
    return rects ? { map, rects } : null;
  });
  const [error, setError] = useState<string | null>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const { getViewport, setViewport } = useReactFlow();

  useEffect(() => {
    if (placed?.map === map) return;
    let live = true;
    erdLayout(index, at.product).then(
      (rects) => { if (live) { setPlaced({ map, rects }); setError(null); } },
      (e) => { if (live) setError(e instanceof Error ? e.message : String(e)); },
    );
    return () => { live = false; };
  }, [index, at.product, map, placed]);

  const theme = useThemeVersion();
  // The fade strengths, read again when the theme changes, and once the canvas is there to read them at.
  const look = useMemo(() => fadeLook(wrapper.current), [theme, placed]);
  // With the Changes lens on, what changed from its baseline is kept in place of the focus's scope (changes/marks.ts).
  const changes = useChanges();
  const strength = useMemo(() => (changes.lens ? lensFade(changes.byId, look) : erdStrength(map, at.scope, look)), [map, at.scope, look, changes.lens, changes.byId]);
  // The live marks, and the removed boxes' ghosts where the layout drawn before had them.
  const rectsRef = placed?.rects;
  const placeOf = useCallback((id: string) => { const r = rectsRef?.get(id); return r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null; }, [rectsRef]);
  const marks = useStageMarks(placeOf);
  const liveNow = marks.at(performance.now());
  const markOf = (m: LiveMark | undefined): BoxData['mark'] => (m && m.change !== 'removed' ? { change: m.change, t: m.t, moving: markPhase(liveNow, m) !== null } : null);

  // The boxes' places come from the layout alone; the focus changes only their strength, their
  // pick and their keyboard stop, never where they are or their size.
  const { nodes, edges } = useMemo(() => {
    if (!placed) return { nodes: [] as BoxNode[], edges: [] as LineEdge[] };
    const { rects } = placed;
    const offsets = lineOffsets(placed.map.lines);
    const node = (box: ErdBox): BoxNode => {
      const r = rects.get(box.id) ?? { x: 0, y: 0, width: 0, height: 0 };
      // A box sits inside its parent, placed from its corner, so React Flow draws an entity's lines above its boundary.
      const parent = box.parent ? rects.get(box.parent) : undefined;
      const s = strength(box.id);
      const pick = box.id === at.pick;
      return {
        id: box.id,
        type: 'box',
        position: parent ? { x: r.x - parent.x, y: r.y - parent.y } : { x: r.x, y: r.y },
        ...(parent ? { parentId: box.parent } : {}),
        width: r.width,
        height: r.height,
        draggable: false,
        connectable: false,
        selectable: false,
        handles: [
          { type: 'target' as const, position: Position.Left, x: 0, y: r.height / 2, width: 1, height: 1 },
          { type: 'source' as const, position: Position.Right, x: r.width, y: r.height / 2, width: 1, height: 1 },
        ],
        // A faded box is out of focus: no keyboard stop, hidden from assistive technology.
        ...(s < 1 ? { focusable: false, domAttributes: { 'aria-hidden': true } } : { ariaLabel: boxName(box, pick) }),
        data: { box, focus: box.id === focus, pick, strength: s, mark: markOf(changes.live.get(box.id)) },
      };
    };
    // The map's boxes come each parent before its children, as React Flow wants.
    const nodes = placed.map.boxes.map(node);
    const titles = new Map(placed.map.boxes.map((b) => [b.id, b.title]));
    const edges: LineEdge[] = placed.map.lines.map((line) => ({
      id: line.id,
      source: line.source,
      target: line.target,
      type: 'line',
      focusable: false,
      selectable: false,
      data: {
        line, source: rects.get(line.source)!, target: rects.get(line.target)!, offset: offsets.get(line.id) ?? 0,
        strength: Math.min(strength(line.source), strength(line.target)), ...lineWords(line, lineLabel(relations, line.relation), titles),
      },
    }));
    return { nodes, edges };
  }, [placed, strength, at.pick, focus, relations, marks.version]);

  // The camera: the shared glide (graph/gestures.ts), driving React Flow's viewport; React Flow keeps
  // the pointer's drag, pinch and wheel, and any of them takes over from a glide.
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const noCanvas = useRef<HTMLCanvasElement>(null);
  const camera = useCameraGestures({
    canvas: noCanvas,
    size,
    getViewport: () => getViewport(),
    setViewport: (v) => { void setViewport(v, { duration: 0 }); },
    zoom: { min: MIN_ZOOM, max: MAX_ZOOM },
    onHover: () => {},
    onTap: () => {},
  });

  // Frame the focus in the open space the floating panels and the key leave over the stage (openSpace.ts).
  const open = useOpenSpace(space);
  const frame = open?.frame;
  const margin = useMemo(() => (frame
    ? { left: FIT_MARGIN.left + frame.left, right: FIT_MARGIN.right + frame.right, top: FIT_MARGIN.top + frame.top, bottom: FIT_MARGIN.bottom + frame.bottom }
    : FIT_MARGIN), [frame]);
  const fitted = useRef(false);
  const frameFocus = useCallback((animate: boolean): boolean => {
    const box = wrapper.current?.getBoundingClientRect();
    if (!placed || placed.rects.size === 0 || !box || box.width <= 0 || box.height <= 0 || (space && !open)) return false;
    // An open space too small to frame anything in frames on the whole stage.
    const room = box.width - margin.left - margin.right >= MIN_FIT && box.height - margin.top - margin.bottom >= MIN_FIT;
    const view = fitRects(framedRects(placed.rects, placed.map, at), box.width, box.height, room ? margin : FIT_MARGIN);
    camera.moveTo(view, animate);
    // Marks the map framed, for the browser suites and the perf budget of its first frame.
    wrapper.current?.setAttribute('data-framed', '');
    return true;
  }, [placed, at, margin, space, open, camera]);
  // Before paint (LA-PAT-APP-UX-R08): the first picture appears already framed, never drawn at the
  // default viewport and then moved; each focus after it, and each change of the open space, glides
  // there from the view before.
  const framedFor = useRef('');
  useLayoutEffect(() => {
    const key = `${at.pick ?? at.scope}|${margin.left},${margin.right},${margin.top},${margin.bottom}|${placed ? 'placed' : ''}`;
    if (framedFor.current === key) return;
    if (frameFocus(fitted.current)) { fitted.current = true; framedFor.current = key; }
  }, [at, margin, placed, frameFocus]);
  // Frame again, at once, whenever the canvas changes size. It observes once, for the canvas's
  // life, and only acts on a real change, so a glide is not cut short by a size reported again.
  const latestFrame = useRef(frameFocus);
  latestFrame.current = frameFocus;
  useEffect(() => {
    const el = wrapper.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let last = '';
    const observer = new ResizeObserver(() => {
      const box = el.getBoundingClientRect();
      const now = `${Math.round(box.width)}x${Math.round(box.height)}`;
      if (now === last) return;
      last = now;
      setSize({ w: box.width, h: box.height });
      if (latestFrame.current(false)) fitted.current = true;
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // The edge hints count the boxes in focus past each edge: the innermost ones, each entity and each closed box.
  const centers = useMemo(() => {
    if (!placed) return [];
    const holders = new Set(placed.map.boxes.flatMap((b) => (b.parent ? [b.parent] : [])));
    return placed.map.boxes.flatMap((b) => {
      const r = placed.rects.get(b.id);
      return r && !holders.has(b.id) && strength(b.id) === 1 ? [{ x: r.x + r.width / 2, y: r.y + r.height / 2 }] : [];
    });
  }, [placed, strength]);

  const regions = useMemo<Region[]>(() => (placed ? placed.map.boxes.flatMap((b) => {
    const rect = placed.rects.get(b.id);
    return b.kind === 'domain' && rect ? [{ id: b.id, title: b.title, rect, strength: strength(b.id) }] : [];
  }) : []), [placed, strength]);

  const go = (id: string) => { if (id !== focus) onNavigate(id); };
  // By touch, a first tap selects a box and a second tap (or a tap on its card) opens it.
  const canOpen = useCallback((id: string) => id !== focus, [focus]);
  const tap = useTapToOpen(onNavigate, canOpen, wrapper, focus);
  const armedBox = tap.armed ? map.boxes.find((b) => b.id === tap.armed) : undefined;
  useEffect(() => { onPeek?.('selected', tap.armed); }, [tap.armed, onPeek]);
  // A new focus starts with nothing under the pointer.
  useEffect(() => () => onPeek?.('hover', null), [focus, onPeek]);
  const boxAt = (target: EventTarget | null) => (target instanceof Element ? target.closest('.react-flow__node')?.getAttribute('data-id') ?? null : null);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const id = (e.target as HTMLElement).closest?.('.react-flow__node')?.getAttribute('data-id');
    if (!id) return;
    // Enter on the focus's own box is left to the commands layer, where it shows or collapses the wiki card (LA-V96-R19).
    if (id === focus && e.key === 'Enter') return;
    e.preventDefault();
    go(id);
  };

  if (error) return <p className="error">Couldn't draw the diagram: {error}</p>;
  return (
    <div ref={wrapper} className="erd-flow" onKeyDown={onKeyDown} onFocus={(e) => onPeek?.('hover', boxAt(e.target))} onBlur={() => onPeek?.('hover', null)}>
      {!placed && <p className="hint graph-loading">Laying out the map…</p>}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        edgesFocusable={false}
        onlyRenderVisibleElements={map.boxes.length > DRAW_IN_VIEW_PAST}
        onMoveStart={(e) => { if (e) camera.stopGlide(); }}
        onNodeClick={(e, n) => tap.onNodeClick(e, n.id)}
        onNodeMouseEnter={(_, n) => onPeek?.('hover', n.id)}
        onNodeMouseLeave={() => onPeek?.('hover', null)}
        onPaneClick={tap.clear}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} size={1} />
        <Controls showInteractive={false} />
        <RegionLabels regions={regions} />
        {!liveNow.reduced && liveNow.ghosts.some((g) => liveNow.now - g.t < GHOST_MS) && (
          <ViewportPortal>
            {liveNow.ghosts.filter((g) => liveNow.now - g.t < GHOST_MS).map((g) => (
              <div key={`${g.id} ${g.t}`} className="erd-ghost" data-ghost={g.id} aria-hidden="true" style={{ transform: `translate(${g.x}px, ${g.y}px)`, width: g.w, height: g.h }} />
            ))}
          </ViewportPortal>
        )}
      </ReactFlow>
      <EdgeHints centers={centers} wrapper={wrapper} moveTo={(v) => camera.moveTo(v, true)} />
      <ErdLeader host={wrapper} rects={placed?.rects ?? null} focus={focus} space={space} />
      {armedBox && <TapCard kind={BOX_KIND[armedBox.kind]} name={armedBox.title} onOpen={tap.openArmed} onDismiss={tap.clear} />}
    </div>
  );
}
