// The ERD stage of any address, /<id>?stage=erd (LA-V94).
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { type MetaRelation } from '../platform/meta-model/reads';
import { type RecordIndex } from '../exploring/record-summaries/record-index';
import { relationLabelOf } from '../specs/labels';
import { useCameraGestures } from '../graph/gestures';
import { followBox, useMorph, type MorphMap } from '../graph/morph';
import { frameRect, wholeIn, type Viewport } from '../graph/camera';
import { onCanvas } from '../graph/paint';
import { PLAIN_LOOK, useThemeVersion } from '../graph/look';
import { fadeTween, type FadeLook } from '../graph/fade';
import { readMotion } from '../graph/motion';
import { EdgeHintChips, panToward, pastEdges, type Point, type Side } from '../graph/hints';
import { lowerLabel } from '../plural';
import { ERD_EMPTY, erdFocus, erdStrength, LINE_WORDS, lineEnds, lineGeometry, lineOffsets, RELATION_ENDS, scopeContents, type ErdBox, type ErdFocus, type ErdKind, type ErdLine, type ErdMap, type ErdRelation, type Rect, useErd } from './erd';
import { erdLayout, readyErdLayout, tidyErdLayout } from './layout';
import { BLOCK_BELOW_ZOOM, boxEdge, boxText, lineOnCanvas, measureAgain, paintErd, readErdFonts, readErdLook, REGION_LABEL_BELOW, regionFits, type DrawnBox, type DrawnLine, type ErdFonts, type ErdFrame, type ErdLook, type RegionLabel } from './paint';
import { TapCard, useTapToOpen } from '../graph/touch';
import { useOpenSpace, type OpenSpaceStore } from '../views/openSpace';
import { drawLeaderLine, useLeaderFollow } from '../views/leaderLine';
import { keepCamera } from '../exploring/tab-set/commands/keep-camera';
import { keptCamera } from '../exploring/tab-set/reads';
import { runTabSetCommand } from '../exploring/tab-set/run';
import { useWalk } from '../graph/steps';
import { useCommand, useRunCommand } from '../shell/commands';
import { Tooltip } from '../shell/Tooltip';
import { Button } from '../components/Button';
import { Icon } from '../components/icons';
import { StageCamera, StageKey, StageToolbar, ZOOM_STEP, type KeyEntry } from '../views/StageChrome';
import type { Move } from '../views/levels';
import { erdTarget } from './walk';
import { useChanges } from '../changes/changes';
import { GHOST_MS, highlightFade, markPhase, marksMoving, useStageMarks } from '../changes/marks';
import { useChangesKey } from '../changes/ChangesKey';

// The ERD stage: one map of the whole product (LA-V94-R08), each domain a region, its aggregates boundaries around their
// entities, laid out once by ELK (layout.ts) and drawn on the shared canvas (paint.ts, under graph/gestures.ts's camera),
// only what is on screen, a plain block below a readable size. A focus never moves a box: it fades what lies outside its
// scope (the graph's focus fade), picks out its box, and the camera glides to frame it. Clicking a box goes to it, as a
// graph node does. A visually hidden layer of the boxes (each with its fields) carries keyboard focus, Enter, and each
// box's name for assistive technology; the box it focuses gets the drawn ring. Its toolbar, camera and key bar are every
// stage's (views/StageChrome.tsx), the key explaining the boxes and the lines it draws. Like the graph it never reads the
// address, and frames itself in the open space it is given.

/** What a box is called, in its accessible name, the key and the touch card. */
export const BOX_KIND: Record<ErdKind, string> = { domain: 'Domain', aggregate: 'Aggregate', entity: 'Entity' };

/** The key's lines in order, each with what its label alone does not say (its whole meaning is the entry's tooltip). */
const LINE_KEY: Record<ErdRelation, { note: string; meaning: string }> = {
  has_one: { note: '1:1', meaning: 'An entity has one of the other: one to one.' },
  has_many: { note: '1:n', meaning: 'An entity has many of the other: one to many.' },
  references: { note: '', meaning: "A field holds the other aggregate's ID; the line points at its root." },
};
const LINE_ORDER = Object.keys(LINE_KEY) as ErdRelation[];

/** A map past this many boxes keeps only those in view in its keyboard's layer; a smaller one keeps them all, so its boxes are always in the page for the keyboard. */
export const DRAW_IN_VIEW_PAST = 150;

export interface ErdViewProps {
  index: RecordIndex;
  focus: string;
  onNavigate: (id: string) => void;
  /** Called with the box under the pointer or keyboard focus (`hover`) and the one selected by a first tap (`selected`), for the chat's app_focus. */
  onPeek?: (kind: 'hover' | 'selected', id: string | null) => void;
  /** Called with what the focus's scope holds, for the header strip: "4 entities · 3 lines". */
  onCounts?: (counts: string) => void;
  /** The open space the host's floating panels leave over the stage, where the focus is framed. */
  space?: OpenSpaceStore;
  /** The place the ERD shows (the Tab set's cameras, exploring/tab-set): its camera is kept as the place is left and taken back as it shows again. */
  cameraKey?: string;
  /** Opens a box in a new place (Cmd or Ctrl+click, or a middle-click for the background), when the host has places. */
  onOpenNew?: (id: string, background: boolean) => void;
}

/** A line's label, in sentence case: the relation's own words, or the ERD view's for a reference. */
export function lineLabel(relations: readonly MetaRelation[], relation: ErdRelation): string {
  const own = LINE_WORDS[relation];
  if (own) return own.charAt(0).toUpperCase() + own.slice(1);
  return relationLabelOf(relations, relation);
}

/** A closed box's kind line: "Aggregate", or "Domain · no aggregates yet" for an empty one. */
const kindLine = (box: ErdBox) => `${BOX_KIND[box.kind]}${box.empty ? ` · no ${box.kind === 'domain' ? 'aggregates' : 'entities'} yet` : ''}`;

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

/** What a scope holds, for the header strip: "4 entities · 3 lines". */
export const erdCounts = (map: ErdMap, scope: string) => {
  const { boxes, lines } = scopeContents(map, scope);
  const entities = boxes.filter((b) => b.kind === 'entity').length;
  return `${entities} ${entities === 1 ? 'entity' : 'entities'} · ${lines.length} ${lines.length === 1 ? 'line' : 'lines'}`;
};

export function ErdView({ index, focus, onNavigate, onPeek, onCounts, space, cameraKey, onOpenNew }: ErdViewProps) {
  const at = useMemo(() => erdFocus(index, focus), [index, focus]);
  // The product's map, from the ERD read, read again with every data change (the index is the data's version).
  const read = useErd(at?.product ?? null, index);
  const map = at && read.state === 'read' && read.answer.product === at.product ? read.answer : null;
  useLayoutEffect(() => { onCounts?.(map && at ? erdCounts(map, at.scope) : ''); }, [map, at, onCounts]);
  // The stage walk moves over the map from anywhere (LA-V61-R49): Out and In between the product, the regions, the areas
  // and the entities, each arrow to the nearest box that way among its siblings, as the picture shows them (walk.ts),
  // read from the map's one layout once it has arrived; each step only moves the camera.
  const [, setLaidOut] = useState(0);
  const target = useCallback((move: Move) => {
    const rects = map ? readyErdLayout(map) : undefined;
    return map && at && rects ? erdTarget(map, rects, at, move) : null;
  }, [map, at]);
  // From a box with keyboard focus (the canvas's keyboard layer), keyboard focus follows to the new focus's box.
  const refocus = useRef<string | null>(null);
  const follow = useCallback((to: string) => {
    if (!document.activeElement?.closest('.erd-access')) return false;
    refocus.current = to;
    return true;
  }, []);
  useWalk(index, focus, target, onNavigate, follow);
  const changesKey = useChangesKey();
  const keyEntries = useMemo(() => (map && at ? [...erdKeyEntries(map, at, index.meta.relations), ...changesKey] : []), [map, at, index, changesKey]);
  if (!at) return <p className="hint erd-missing">There's no record or group <code>{focus}</code>.</p>;
  if (read.state === 'refused') return <p className="error erd-missing">Couldn't read the ERD: {read.error}</p>;
  if (!map) return <p className="hint erd-reading" role="status">Reading the ERD…</p>;
  const product = index.byId.get(at.product);
  return (
    <section className="erd-page" aria-label={`ERD: The domains of ${product?.title ?? at.product}, their aggregates, entities and relationships`}>
      {map.boxes.length === 0 ? (
        <p className="placeholder erd-empty">{ERD_EMPTY}</p>
      ) : (
        <div className="erd-canvas">
          <ErdCanvas index={index} map={map} at={at} focus={focus} refocus={refocus} onNavigate={onNavigate} onPeek={onPeek} space={space} cameraKey={cameraKey} onOpenNew={onOpenNew} onLaidOut={() => setLaidOut((n) => n + 1)} />
        </div>
      )}
      <StageToolbar can={(move) => target(move) !== null} own={() => ({ primary: <TidyUp /> })} />
      <StageKey entries={keyEntries} />
    </section>
  );
}

/** The toolbar's Tidy up (LA-V94-R09): the whole map laid out afresh, by its keymap command. */
function TidyUp() {
  const runCommand = useRunCommand();
  return (
    <Tooltip label="Tidy up: lay the whole map out afresh" command="stageTidy">
      <Button className="stage-tidy" aria-label="Tidy up" onClick={() => runCommand('stageTidy')}>
        <Icon name="tidy" size={14} /><span className="stage-tidy-name">Tidy up</span>
      </Button>
    </Tooltip>
  );
}

/** The ERD's key entries (LA-V94-R05), for the stage's key bar: each kind of box, badge and line the map draws, and nothing it does not. */
export function erdKeyEntries(map: ErdMap, at: ErdFocus, relations: readonly MetaRelation[] = []): KeyEntry[] {
  const sample = (relation: ErdRelation, dashed: boolean) => {
    const g = lineGeometry({ x: 0, y: 0, width: 2, height: 2 }, { x: 34, y: 0, width: 2, height: 2 }, RELATION_ENDS[relation]);
    return (
      <svg className={`erd-key-line rel-${relation}${dashed ? ' is-dashed' : ''}`} viewBox="-2 -9 40 18" width="28" height="14" aria-hidden="true">
        <path className="erd-line-path" d={g.line} />
        {g.sourceEnd && <path className="erd-end" d={g.sourceEnd} />}
        {g.targetEnd && <path className="erd-end" d={g.targetEnd} />}
      </svg>
    );
  };
  const has = (kind: ErdKind) => map.boxes.some((b) => b.kind === kind);
  const lines = [...new Map(map.lines.map((l) => [l.relation, l])).values()].sort((a, b) => LINE_ORDER.indexOf(a.relation) - LINE_ORDER.indexOf(b.relation));
  const faded = at.scope !== map.product && map.boxes.length > scopeContents(map, at.scope).boxes.length;
  const boxes: KeyEntry[] = [
    ...(has('domain') ? [{ id: 'domain', group: 'boxes', meaning: 'A domain: the region around its aggregates', sample: <span className="erd-key-swatch erd-key-domain" />, words: 'Domain' }] : []),
    ...(has('aggregate') ? [{ id: 'aggregate', group: 'boxes', meaning: 'An aggregate: the boundary around its entities, or a closed box', sample: <span className="erd-key-swatch erd-key-aggregate" />, words: 'Aggregate' }] : []),
    ...(has('entity') ? [{ id: 'entity', group: 'boxes', meaning: 'An entity, with its fields and their types', sample: <span className="erd-key-swatch erd-key-entity" />, words: 'Entity' }] : []),
    ...(map.boxes.some((b) => b.root) ? [{ id: 'root', group: 'boxes', meaning: "The aggregate's root entity, the one references point at", sample: <span className="erd-root">root</span>, words: 'Root entity' }] : []),
    ...(at.pick ? [{ id: 'pick', group: 'focus', meaning: 'The record in focus, or the nearest entity or aggregate above it', sample: <span className="erd-key-highlight" />, words: 'Picked out' }] : []),
    ...(faded ? [{ id: 'faded', group: 'focus', meaning: 'Faded: outside the domain or aggregate in focus', sample: <span className="erd-key-faded" />, words: 'Faded' }] : []),
  ];
  const lineEntries: KeyEntry[] = lines.map((l) => {
    const { note, meaning } = LINE_KEY[l.relation];
    return { id: `line-${l.relation}`, group: 'lines', meaning, sample: sample(l.relation, l.dashed), words: `${l.relation === 'references' ? 'Reference by ID' : lineLabel(relations, l.relation)}${note && ` (${note})`}` };
  });
  return [...boxes, ...lineEntries];
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
  return frameRect(around, marginFrame({ w: width, h: height }, margin), { pad: 0, read: MIN_ZOOM, max: 1, min: MIN_ZOOM });
}

/** The frame inside a margin of the stage, in screen pixels. */
const marginFrame = (s: { w: number; h: number }, margin: typeof FIT_MARGIN) => ({ x: margin.left, y: margin.top, w: Math.max(1, s.w - margin.left - margin.right), h: Math.max(1, s.h - margin.top - margin.bottom) });
/** A placed box as a map rectangle. */
const rectBox = (r: Rect) => ({ x: r.x, y: r.y, w: r.width, h: r.height });

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

/** A box's accessible name: its kind, title and root mark, and whether the focus picks it out. */
const boxName = (box: ErdBox, pick: boolean) => `${BOX_KIND[box.kind]} ${box.title}${box.root ? ', root' : ''}${box.empty ? `, ${kindLine(box).split(' · ')[1]}` : ''}${pick ? ' (picked out)' : ''}`;


/** How near a line the pointer must come to hover it, in CSS pixels on screen. */
const LINE_HIT_PX = 7;
/** How long the camera rests before the keyboard's layer takes the boxes then in view (a map past DRAW_IN_VIEW_PAST), in ms. */
const LAYER_SETTLE_MS = 150;
const NO_HINTS = '0 0 0 0';

/** One drawn box as the test hook reports it: the box's place in the map and on the page, its text as drawn, and its states. */
export interface ErdSceneBox {
  id: string; kind: ErdKind; parent: string | null; title: string[]; root: boolean; kindLine: string | null; fields: { name: string; type: string }[];
  focus: boolean; pick: boolean; hover: boolean; ring: boolean; armed: boolean; strength: number; block: boolean;
  /** Its live change (a dot), whether its glow or pulse is playing now, and with Highlight changes on its change from the baseline (its pill). */
  change: 'added' | 'changed' | null; flash: boolean; pill: 'added' | 'changed' | null;
  map: Rect; rect: { left: number; top: number; width: number; height: number };
}
/** One drawn line as the test hook reports it: its ends' drawings, its sentence, its fields' words when shown, and its strength. */
export interface ErdSceneLine { id: string; relation: ErdRelation; dashed: boolean; ends: string; title: string; label: string | null; hover: boolean; strength: number; from: Point; to: Point }
/** What the canvas draws now, as the test hook reports it; with `whole`, every box and line of the map, in view or not. */
export interface ErdScene {
  camera: Viewport;
  canvas: { left: number; top: number; width: number; height: number };
  boxes: ErdSceneBox[];
  lines: ErdSceneLine[];
  /** The regions whose names show over them, zoomed out. */
  regions: string[];
  ghosts: string[];
}
/** The canvas's element, with the hooks the tests read the drawn scene and hit-test through (the desktop's record menu too). */
export type ErdHost = HTMLDivElement & { erdScene?: (whole?: boolean) => ErdScene; graphHit?: (clientX: number, clientY: number) => string | null };

interface CanvasProps { index: RecordIndex; map: ErdMap; at: ErdFocus; focus: string; refocus: { current: string | null }; onNavigate: (id: string) => void; onPeek?: ErdViewProps['onPeek']; space?: OpenSpaceStore; cameraKey?: string; onOpenNew?: ErdViewProps['onOpenNew']; onLaidOut: () => void }

/** The coarse pointer (a touch screen), where there is no hover: dashed lines always show their fields (LA-PAT-APP-UX-R07). */
const coarsePointer = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;

/** Distance from a point to a segment. */
function toSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = dx === 0 && dy === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

const inRect = (p: Point, r: Rect) => p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
const toRect = (b: { x: number; y: number; w: number; h: number }): Rect => ({ x: b.x, y: b.y, width: b.w, height: b.h });

function ErdCanvas({ index, map, at, focus, refocus, onNavigate, onPeek, space, cameraKey, onOpenNew, onLaidOut }: CanvasProps) {
  const relations = index.meta.relations;
  // The map's layout: ready at once when this product was laid out before on the same data.
  const [placed, setPlaced] = useState<{ map: ErdMap; rects: Map<string, Rect> } | null>(() => {
    const rects = readyErdLayout(map);
    return rects ? { map, rects } : null;
  });
  const [error, setError] = useState<string | null>(null);
  const wrapper = useRef<ErdHost>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const layer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (placed?.map === map) return;
    let live = true;
    erdLayout(map).then(
      (rects) => { if (live) { setPlaced({ map, rects }); setError(null); onLaidOut(); } },
      (e) => { if (live) setError(e instanceof Error ? e.message : String(e)); },
    );
    return () => { live = false; };
  }, [map, placed]);

  // ---- The camera ----
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const view = useRef<Viewport>({ x: 0, y: 0, zoom: 1 });
  const frameRequest = useRef<number | null>(null);
  const paintRef = useRef<() => void>(() => {});
  const requestPaint = useCallback(() => {
    if (frameRequest.current !== null || typeof requestAnimationFrame === 'undefined') return;
    frameRequest.current = requestAnimationFrame(() => { frameRequest.current = null; paintRef.current(); });
  }, []);
  useEffect(() => () => { if (frameRequest.current !== null) cancelAnimationFrame(frameRequest.current); frameRequest.current = null; }, []);
  /** The keyboard's layer follows the camera once it rests (a map past DRAW_IN_VIEW_PAST). */
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const layerRef = useRef<() => void>(() => {});
  const setViewport = useCallback((v: Viewport) => {
    view.current = v;
    requestPaint();
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => { settle.current = null; layerRef.current(); }, LAYER_SETTLE_MS);
  }, [requestPaint]);
  useEffect(() => () => { if (settle.current) clearTimeout(settle.current); }, []);
  const getViewport = useCallback(() => view.current, []);
  const gestures = useCameraGestures({
    canvas,
    size,
    getViewport,
    setViewport,
    zoom: { min: MIN_ZOOM, max: MAX_ZOOM },
    onHover: (x, y) => setHover(hitAt(x, y)),
    onTap: (x, y, e) => { const hit = hitAt(x, y); if (hit?.box) tap.onNodeClick(e, hit.box); else tap.clear(); },
  });

  // ---- The look, the fade, the glide and the marks ----
  const theme = useThemeVersion();
  const fonts = useMemo<ErdFonts>(() => readErdFonts(), [theme]);
  const look = useRef<ErdLook>({ ...PLAIN_LOOK, regionFill: PLAIN_LOOK.domainModelFill, radius: 4 });
  const [lookVersion, setLookVersion] = useState(0);
  useLayoutEffect(() => {
    if (wrapper.current) look.current = readErdLook(wrapper.current);
    setLookVersion((n) => n + 1);
    requestPaint();
  }, [theme]);
  // The faces load after the first paint: the text is measured again and drawn in them once they have.
  useEffect(() => {
    let live = true;
    void document.fonts?.ready.then(() => { if (live) { measureAgain(); setLookVersion((n) => n + 1); requestPaint(); } });
    return () => { live = false; };
  }, [fonts]);
  const fadeLook = useMemo<Pick<FadeLook, 'focusFade'>>(() => ({ focusFade: look.current.focusFade }), [lookVersion]);
  // With Highlight changes on, what changed from its baseline is kept in place of the focus's scope (changes/marks.ts).
  const changes = useChanges();
  const strength = useMemo(() => (changes.highlight ? highlightFade(changes.byId) : erdStrength(map, at.scope, fadeLook)), [map, at.scope, fadeLook, changes.highlight, changes.byId]);
  // The fade eases with the camera's glide to a new focus, on the shared motion.
  const tween = useMemo(() => fadeTween((t) => readMotion().ease(t)), []);
  useLayoutEffect(() => {
    tween.send(strength, readMotion().duration);
    requestPaint();
  }, [strength]);
  // A new layout's boxes glide from their old places to their new ones (LA-PAT-APP-UX-R22), lines with them.
  const morphMap = useMemo<MorphMap>(() => ({
    view: 'erd',
    roots: [placed?.map.product ?? map.product],
    nodes: new Map([...(placed?.rects ?? new Map<string, Rect>())].map(([id, r]) => [id, { x: r.x, y: r.y, w: r.width, h: r.height }])),
  }), [placed]);
  const morph = useMorph(morphMap);
  // The live marks, and the removed boxes' ghosts where the layout drawn before had them.
  const rectsNow = placed?.rects;
  const placeOf = useCallback((id: string) => { const r = rectsNow?.get(id); return r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null; }, [rectsNow]);
  const tree = useMemo(() => ({ nodes: new Map(map.boxes.map((b) => [b.id, { parent: b.parent ?? null }])) }), [map]);
  const marks = useStageMarks(placeOf, tree);
  useEffect(() => { requestPaint(); }, [marks.version, marks.highlight]);

  // ---- The pointer, the keyboard's ring and a tap's selection ----
  const hover = useRef<{ box: string | null; line: string | null }>({ box: null, line: null });
  const ring = useRef<string | null>(null);
  const touch = useMemo(coarsePointer, []);
  const canOpen = useCallback((id: string) => id !== focus, [focus]);
  const tap = useTapToOpen(onNavigate, canOpen, wrapper, focus, onOpenNew);
  const armed = useRef(tap.armed);
  armed.current = tap.armed;
  useEffect(() => { onPeek?.('selected', tap.armed); requestPaint(); }, [tap.armed, onPeek]);
  // A new focus starts with nothing under the pointer.
  useEffect(() => () => onPeek?.('hover', null), [focus, onPeek]);

  // ---- What a camera shows ----
  const titles = useMemo(() => new Map(map.boxes.map((b) => [b.id, b.title])), [map]);
  const offsets = useMemo(() => (placed ? lineOffsets(placed.map.lines) : new Map<string, number>()), [placed]);
  const words = useMemo(() => new Map((placed?.map.lines ?? []).map((l) => [l.id, lineWords(l, lineLabel(relations, l.relation), titles)])), [placed, relations, titles]);
  /** What the frame draws through a camera: the boxes on the canvas with their states, and the lines between them; with `whole`, every one. */
  const frameAt = useCallback((v: Viewport, s: { w: number; h: number }, now: number, whole = false): ErdFrame => {
    const out: ErdFrame = { under: [], lines: [], over: [] };
    if (!placed) return out;
    const cam = { cx: (s.w / 2 - v.x) / v.zoom, cy: (s.h / 2 - v.y) / v.zoom, zoom: v.zoom, w: s.w, h: s.h };
    const fade = tween.now().at;
    const hl = marks.highlight;
    const rectAt = (id: string) => { const b = morph.box(id, now); return b ? toRect(b) : undefined; };
    for (const box of placed.map.boxes) {
      const rect = rectAt(box.id);
      if (!rect) continue;
      if (!whole && !onCanvas({ x: rect.x, y: rect.y, w: rect.width, h: rect.height }, cam)) continue;
      const laid = placed.rects.get(box.id)!;
      const d: DrawnBox = {
        box, rect, text: boxText(box, laid.width, kindLine(box), fonts), strength: fade(box.id),
        focus: box.id === focus, pick: box.id === at.pick, hover: hover.current.box === box.id, ring: ring.current === box.id, armed: armed.current === box.id,
        hl: hl ? { change: hl.change(box.id), roll: hl.rolls.get(box.id) ?? null } : null,
      };
      (box.kind === 'entity' ? out.over : out.under).push(d);
    }
    for (const line of placed.map.lines) {
      const a = rectAt(line.source);
      const b = rectAt(line.target);
      if (!a || !b) continue;
      const ends = whole ? lineEnds(a, b, offsets.get(line.id) ?? 0) : lineOnCanvas(a, b, offsets.get(line.id) ?? 0, cam);
      if (!ends) continue;
      const hovered = hover.current.line === line.id;
      const w = words.get(line.id)!;
      out.lines.push({ line, ...ends, strength: Math.min(fade(line.source), fade(line.target)), hover: hovered && !!w.hover, label: w.hover && (hovered || touch) ? w.hover : null });
    }
    return out;
  }, [placed, morph, tween, marks.highlight, fonts, focus, at.pick, offsets, words, touch, lookVersion]);

  /** The regions' names zoomed out. */
  const regions = useCallback((now: number): RegionLabel[] => (placed ? placed.map.boxes.flatMap((b) => {
    const b2 = b.kind === 'domain' ? morph.box(b.id, now) : null;
    return b2 ? [{ title: b.title, roll: marks.highlight?.rolls.get(b.id) ?? null, rect: toRect(b2), strength: tween.now().at(b.id) }] : [];
  }) : []), [placed, morph, marks.highlight, tween]);

  // The edge hints count the boxes in focus past each edge: the innermost ones, each entity and each closed box; and with
  // Highlight changes on, the changed boxes. They are drawn again only when a count changes (LA-PAT-APP-UX-R11).
  const centers = useMemo(() => {
    if (!placed) return [];
    const holders = new Set(placed.map.boxes.flatMap((b) => (b.parent ? [b.parent] : [])));
    return placed.map.boxes.flatMap((b) => {
      const r = placed.rects.get(b.id);
      return r && !holders.has(b.id) && strength(b.id) === 1 ? [{ x: r.x + r.width / 2, y: r.y + r.height / 2 }] : [];
    });
  }, [placed, strength]);
  const changeCenters = useMemo(() => (marks.highlight?.boxes ?? []).map((b) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 })), [marks.highlight]);
  const [hints, setHints] = useState({ more: NO_HINTS, changes: NO_HINTS });
  const hintKey = (points: readonly Point[], v: Viewport, s: { w: number; h: number }) => {
    if (points.length === 0) return NO_HINTS;
    const p = pastEdges(points, v, s.w, s.h);
    return `${p.up} ${p.down} ${p.left} ${p.right}`;
  };

  // ---- Painting ----
  const ctx = useRef<CanvasRenderingContext2D | null | undefined>(undefined);
  const lastFrame = useRef<ErdFrame | null>(null);
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  paintRef.current = () => {
    const s = sizeRef.current;
    if (!s || !placed) return;
    const now = performance.now();
    const v = view.current;
    const frame = frameAt(v, s, now);
    lastFrame.current = frame;
    const more = hintKey(centers, v, s);
    const changed = hintKey(changeCenters, v, s);
    if (more !== hints.more || changed !== hints.changes) setHints({ more, changes: changed });
    if (ctx.current === undefined) ctx.current = canvas.current?.getContext?.('2d') ?? null;
    const g = ctx.current;
    if (!g) return;
    const live = marks.at(now);
    const cam = { cx: (s.w / 2 - v.x) / v.zoom, cy: (s.h / 2 - v.y) / v.zoom, zoom: v.zoom, w: s.w, h: s.h };
    paintErd(g, dpr, cam, frame, v.zoom < REGION_LABEL_BELOW ? regions(now) : [], look.current, fonts, live);
    // The leader line to the wiki card (LA-V96-R24), from the focus's box, in its edge's color.
    const own = morph.box(focus, now);
    const kind = placed.map.boxes.find((b) => b.id === focus)?.kind;
    if (wrapper.current) drawLeaderLine(g, {
      host: wrapper.current, space, dpr, color: kind ? boxEdge(look.current, kind) : look.current.ink,
      box: own ? { left: own.x * v.zoom + v.x, top: own.y * v.zoom + v.y, right: (own.x + own.w) * v.zoom + v.x, bottom: (own.y + own.h) * v.zoom + v.y } : null,
    });
    const drawn = [...frame.under, ...frame.over].map((d) => d.box.id);
    if (morph.moving(now) || !tween.now().done || marksMoving(live, drawn) || (live.ghosts.length > 0 && !live.highlight && !live.reduced)) requestPaint();
  };
  useEffect(() => { requestPaint(); });
  useLeaderFollow(wrapper, space, () => paintRef.current());

  // The pane's size, observed once for the canvas's life; the backing store at the screen's pixel ratio.
  useLayoutEffect(() => {
    const el = wrapper.current;
    if (!el) return;
    const measureBox = (b: { width: number; height: number }) => {
      if (b.width <= 0 || b.height <= 0) return;
      setSize((s) => (s && Math.round(s.w) === Math.round(b.width) && Math.round(s.h) === Math.round(b.height) ? s : { w: b.width, h: b.height }));
    };
    measureBox(el.getBoundingClientRect());
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => measureBox(entries[0]?.contentRect ?? el.getBoundingClientRect()));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    const c = canvas.current;
    if (!c || !size) return;
    c.width = Math.max(1, Math.round(size.w * dpr));
    c.height = Math.max(1, Math.round(size.h * dpr));
    paintRef.current();
  }, [size, dpr]);

  // ---- Framing ----
  // Frame the focus in the open space the floating panels and the key leave over the stage (openSpace.ts).
  const open = useOpenSpace(space);
  const frame = open?.frame;
  const margin = useMemo(() => (frame
    ? { left: FIT_MARGIN.left + frame.left, right: FIT_MARGIN.right + frame.right, top: FIT_MARGIN.top + frame.top, bottom: FIT_MARGIN.bottom + frame.bottom }
    : FIT_MARGIN), [frame]);
  const fitted = useRef(false);
  const frameFocus = useCallback((animate: boolean): boolean => {
    const s = sizeRef.current;
    if (!placed || placed.rects.size === 0 || !s || (space && !open)) return false;
    // An open space too small to frame anything in frames on the whole stage.
    const room = s.w - margin.left - margin.right >= MIN_FIT && s.h - margin.top - margin.bottom >= MIN_FIT;
    const m = room ? margin : FIT_MARGIN;
    // The focused box always whole in the frame (LA-PAT-APP-UX-R23).
    const fit = fitRects(framedRects(placed.rects, placed.map, at), s.w, s.h, m);
    const own = placed.rects.get(at.pick ?? at.scope);
    const v = own ? wholeIn(fit, rectBox(own), marginFrame(s, m), 0, MIN_ZOOM) : fit;
    gestures.moveTo(v, animate);
    // Marks the map framed, for the browser suites and the perf budget of its first frame.
    wrapper.current?.setAttribute('data-framed', '');
    return true;
  }, [placed, at, margin, space, open, gestures]);
  // Before paint (LA-PAT-APP-UX-R08): the first picture appears already framed, never drawn at the default viewport and
  // then moved; each focus after it, and each change of the open space, glides there from the view before.
  // Each place keeps its camera (the Tab set's cameras, exploring/tab-set): as the place shown changes (another tab), the
  // one left keeps where its camera was, and the one shown takes its own back, at once, when it still frames the same scope.
  const framedFor = useRef('');
  const framed = `${at.pick ?? at.scope}`;
  const frameKey = `${framed}|${margin.left},${margin.right},${margin.top},${margin.bottom}|${placed ? 'placed' : ''}|${size ? 'sized' : ''}`;
  const cameraPlace = useRef<{ key: string | undefined; framed: string; restore: boolean }>({ key: cameraKey, framed: '', restore: true });
  useLayoutEffect(() => {
    const was = cameraPlace.current;
    if (was.key !== cameraKey) {
      if (was.key && fitted.current) runTabSetCommand(keepCamera, { place: was.key, stage: 'erd', camera: { framed: was.framed, view: view.current } });
      cameraPlace.current = { key: cameraKey, framed, restore: true };
    }
    cameraPlace.current.framed = framed;
    if (!cameraPlace.current.restore || !placed || !size) return;
    cameraPlace.current.restore = false;
    const back = cameraKey ? keptCamera<Viewport>(cameraKey, 'erd', framed) : null;
    if (!back) return;
    gestures.moveTo(back, false);
    wrapper.current?.setAttribute('data-framed', '');
    fitted.current = true;
    framedFor.current = frameKey;
  }, [framed, frameKey, placed, cameraKey, size]);
  // New data leaves the camera where it is (the frame key holds no layout), unless the new layout moved the box it frames,
  // when the camera glides with that box as the boxes glide to their new places (LA-PAT-APP-UX-R22).
  const followed = useRef<{ id: string; rect: Rect } | null>(null);
  useLayoutEffect(() => {
    if (!placed) return;
    const id = at.pick ?? at.scope;
    const now = placed.rects.get(id);
    const was = followed.current;
    followed.current = now ? { id, rect: now } : null;
    if (!was || !now || was.id !== id || !fitted.current || framedFor.current !== frameKey) return;
    const v = followBox(view.current, rectBox(was.rect), rectBox(now), { min: MIN_ZOOM, max: MAX_ZOOM });
    // Following the focus keeps it whole too (LA-PAT-APP-UX-R23).
    const s = sizeRef.current;
    if (v) gestures.moveTo(s ? wholeIn(v, rectBox(now), marginFrame(s, margin), 0, MIN_ZOOM) : v, true);
  }, [placed]);
  useLayoutEffect(() => {
    const key = frameKey;
    if (framedFor.current === key) return;
    if (frameFocus(fitted.current)) { fitted.current = true; framedFor.current = key; }
  }, [frameKey, frameFocus]);
  const lastSize = useRef(size);
  useLayoutEffect(() => {
    const was = lastSize.current;
    lastSize.current = size;
    if (was && size && (Math.round(was.w) !== Math.round(size.w) || Math.round(was.h) !== Math.round(size.h)) && frameFocus(false)) fitted.current = true;
  }, [size]);
  useEffect(() => () => {
    const { key, framed: what } = cameraPlace.current;
    if (key && fitted.current) runTabSetCommand(keepCamera, { place: key, stage: 'erd', camera: { framed: what, view: view.current } });
  }, []);
  // `.` and the toolbar's Frame frame the focus again, as on every stage; the camera's buttons zoom about the frame's
  // middle and fit the whole map.
  useCommand('graphFit', () => { frameFocus(true); }, !!placed);
  // Tidy up (LA-V94-R09): the whole map laid out afresh, its boxes and lines gliding to their new places; the camera
  // follows the focus's box as on new data.
  const tidying = useRef(false);
  useCommand('stageTidy', () => {
    if (tidying.current) return;
    tidying.current = true;
    tidyErdLayout(map).then(
      (rects) => { tidying.current = false; setPlaced({ map, rects }); onLaidOut(); },
      (e) => { tidying.current = false; setError(e instanceof Error ? e.message : String(e)); },
    );
  }, !!placed);
  const frameMiddle = () => {
    const s = sizeRef.current ?? { w: 0, h: 0 };
    return { x: margin.left + (s.w - margin.left - margin.right) / 2, y: margin.top + (s.h - margin.top - margin.bottom) / 2 };
  };
  const zoomButton = (factor: number) => () => { const m = frameMiddle(); gestures.zoomBy(m.x, m.y, factor); };
  const fitMap = () => {
    const s = sizeRef.current;
    if (!placed || placed.rects.size === 0 || !s) return;
    gestures.moveTo(fitRects(placed.rects.values(), s.w, s.h, margin), true);
  };

  // ---- The pointer: hover and click (drag, wheel and pinch are graph/gestures.ts's) ----
  /** What lies under a point of the pane: the innermost box, or a line near it (an entity first, then a line, then the box around). */
  const hitAt = useCallback((x: number, y: number): { box: string | null; line: string | null } | null => {
    const v = view.current;
    const s = sizeRef.current;
    if (!s || !placed) return null;
    const frame = lastFrame.current ?? frameAt(v, s, performance.now());
    const p = { x: (x - v.x) / v.zoom, y: (y - v.y) / v.zoom };
    const entity = [...frame.over].reverse().find((d) => inRect(p, d.rect));
    if (entity) return { box: entity.box.id, line: null };
    const line = frame.lines.find((l) => toSegment(p, l.from, l.to) <= LINE_HIT_PX / v.zoom);
    if (line) return { box: null, line: line.line.id };
    const around = [...frame.under].reverse().find((d) => inRect(p, d.rect));
    return around ? { box: around.box.id, line: null } : null;
  }, [placed, frameAt]);
  const setHover = (hit: { box: string | null; line: string | null } | null) => {
    const next = hit ?? { box: null, line: null };
    if (hover.current.box === next.box && hover.current.line === next.line) return;
    if (hover.current.box !== next.box) onPeek?.('hover', next.box);
    hover.current = next;
    const c = canvas.current;
    if (c) {
      const box = next.box ? map.boxes.find((b) => b.id === next.box) : undefined;
      c.style.cursor = box && canOpen(box.id) ? 'pointer' : '';
      c.title = box ? `${box.title} (${box.id})` : next.line ? words.get(next.line)?.title ?? '' : '';
    }
    requestPaint();
  };

  // ---- The keyboard's layer ----
  const [layerIds, setLayerIds] = useState<string[] | null>(null);
  layerRef.current = () => {
    const s = sizeRef.current;
    if (!placed || !s || placed.map.boxes.length <= DRAW_IN_VIEW_PAST) return;
    const frame = frameAt(view.current, s, performance.now());
    const ids = new Set([...frame.under, ...frame.over].map((d) => d.box.id));
    const next = placed.map.boxes.filter((b) => ids.has(b.id)).map((b) => b.id);
    setLayerIds((was) => (was && was.join(' ') === next.join(' ') ? was : next));
  };
  useEffect(() => { layerRef.current(); }, [placed, size]);
  const layerBoxes = useMemo(() => {
    if (!placed) return [];
    if (placed.map.boxes.length <= DRAW_IN_VIEW_PAST || !layerIds) return placed.map.boxes;
    const ids = new Set(layerIds);
    return placed.map.boxes.filter((b) => ids.has(b.id));
  }, [placed, layerIds]);
  /** The lines between the layer's boxes in focus, each its sentence ("Loan has many Reminder"), read after the boxes. */
  const layerLines = useMemo(() => {
    if (!placed) return [];
    const kept = new Set(layerBoxes.filter((b) => strength(b.id) === 1).map((b) => b.id));
    return placed.map.lines.filter((l) => kept.has(l.source) && kept.has(l.target));
  }, [placed, layerBoxes, strength]);
  // After Enter or the walk from a box with keyboard focus, keyboard focus goes to the new focus's box once it is in the layer.
  const layerNode = (id: string) => [...(layer.current?.querySelectorAll<HTMLElement>('.erd-node') ?? [])].find((el) => el.dataset.id === id) ?? null;
  useEffect(() => {
    if (!refocus.current) return;
    const el = layerNode(refocus.current);
    if (!el) return;
    refocus.current = null;
    el.focus({ preventScroll: true });
  }, [focus, layerBoxes]);
  const go = (id: string, fromKeyboard: boolean) => {
    if (id === focus) return;
    if (fromKeyboard) refocus.current = id;
    onNavigate(id);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const id = (e.target as HTMLElement).closest?.<HTMLElement>('.erd-node')?.dataset.id;
    if (!id) return;
    // Enter on the focus's own box is left to the commands layer, where it shows or collapses the wiki card (LA-V96-R19).
    if (id === focus && e.key === 'Enter') return;
    e.preventDefault();
    go(id, true);
  };

  // ---- The test hook: the drawn scene, in the page's pixels; and the hit test the desktop's record menu reads ----
  useEffect(() => {
    const host = wrapper.current;
    if (!host) return;
    host.graphHit = (clientX, clientY) => {
      const r = canvas.current!.getBoundingClientRect();
      return hitAt(clientX - r.left, clientY - r.top)?.box ?? null;
    };
    host.erdScene = (whole = false) => {
      const s = sizeRef.current ?? { w: 0, h: 0 };
      const v = view.current;
      const r = canvas.current!.getBoundingClientRect();
      const now = performance.now();
      const frame = frameAt(v, s, now, whole);
      const live = marks.at(now);
      const box = (d: DrawnBox): ErdSceneBox => ({
        id: d.box.id, kind: d.box.kind, parent: d.box.parent ?? null, title: d.text.title, root: d.text.root > 0, kindLine: d.text.kind, fields: d.text.fields.map((f) => ({ name: f.name, type: f.type })),
        focus: d.focus, pick: d.pick, hover: d.hover, ring: d.ring, armed: d.armed, strength: d.strength, block: v.zoom < BLOCK_BELOW_ZOOM,
        change: ((m) => (m && m.change !== 'removed' ? m.change : null))(changes.live.get(d.box.id)),
        flash: ((m) => !!m && m.change !== 'removed' && markPhase(live, m) !== null)(live.mark(d.box.id)),
        pill: d.hl?.change === 'added' || d.hl?.change === 'changed' ? d.hl.change : null,
        map: d.rect, rect: { left: r.left + d.rect.x * v.zoom + v.x, top: r.top + d.rect.y * v.zoom + v.y, width: d.rect.width * v.zoom, height: d.rect.height * v.zoom },
      });
      const line = (l: DrawnLine): ErdSceneLine => ({
        id: l.line.id, relation: l.line.relation, dashed: l.line.dashed, ends: `${l.line.sourceEnd}-${l.line.targetEnd}`, title: words.get(l.line.id)?.title ?? '',
        label: l.label, hover: hover.current.line === l.line.id, strength: l.strength, from: l.from, to: l.to,
      });
      const shownRegions = v.zoom < REGION_LABEL_BELOW ? regions(now).filter((g) => regionFits(g, v.zoom, fonts)).map((g) => g.title) : [];
      return {
        camera: { ...v },
        canvas: { left: r.left, top: r.top, width: s.w, height: s.h },
        boxes: [...frame.under, ...frame.over].sort((a, b) => placed!.map.boxes.indexOf(a.box) - placed!.map.boxes.indexOf(b.box)).map(box),
        lines: frame.lines.map(line),
        regions: shownRegions,
        ghosts: live.reduced && !live.highlight ? [] : live.ghosts.filter((g) => live.highlight || live.now - g.t < GHOST_MS).map((g) => g.id),
      };
    };
  });

  if (error) return <p className="error">Couldn't draw the diagram: {error}</p>;
  const armedBox = tap.armed ? map.boxes.find((b) => b.id === tap.armed) : undefined;
  const pan = (side: Side) => { const s = sizeRef.current; if (s) gestures.moveTo(panToward(view.current, side, s.w, s.h), true); };
  const past = (key: string) => { const [up, down, left, right] = key.split(' ').map(Number); return { up, down, left, right }; };
  return (
    <div
      ref={wrapper}
      className="erd-flow"
      data-ready={size && placed ? 'true' : undefined}
      tabIndex={-1}
      role="group"
      aria-label="ERD canvas: Tab steps through the boxes, the arrow keys walk the map"
      onKeyDown={onKeyDown}
    >
      {!placed && <p className="hint graph-loading">Laying out the map…</p>}
      <canvas
        ref={canvas}
        className="graph-canvas-draw"
        aria-hidden="true"
        {...gestures.handlers}
        onAuxClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const hit = hitAt(e.clientX - r.left, e.clientY - r.top);
          if (hit?.box) tap.onNodeAuxClick(e, hit.box);
        }}
        onPointerLeave={(e) => { if (!gestures.pressed(e.pointerId)) setHover(null); }}
      />
      <div
        ref={layer}
        className="erd-access"
        onFocus={(e) => {
          const el = (e.target as HTMLElement).closest?.<HTMLElement>('.erd-node');
          const id = el?.dataset.id ?? null;
          ring.current = el && el.matches(':focus-visible') ? id : null;
          onPeek?.('hover', id);
          requestPaint();
        }}
        onBlur={() => { ring.current = null; onPeek?.('hover', null); requestPaint(); }}
      >
        {layerBoxes.map((box) => {
          const s = strength(box.id);
          const pick = box.id === at.pick;
          // A faded box is out of focus: no keyboard stop, hidden from assistive technology.
          return (
            <div
              key={box.id}
              className="erd-node"
              data-id={box.id}
              role="group"
              aria-roledescription="node"
              {...(s < 1 ? { 'aria-hidden': true } : { 'aria-label': boxName(box, pick), tabIndex: 0 })}
              aria-current={box.id === focus ? 'true' : undefined}
              onClick={(e) => tap.onNodeClick(e, box.id)}
              onAuxClick={(e) => tap.onNodeAuxClick(e, box.id)}
            >
              {box.fields.length > 0 && (
                <ul aria-label={`Fields of ${box.title}`}>
                  {box.fields.map((f) => <li key={f.field}><span>{f.field}</span><span>{f.kind}</span></li>)}
                </ul>
              )}
            </div>
          );
        })}
        {layerLines.length > 0 && (
          <ul aria-label="Lines">
            {layerLines.map((l) => <li key={l.id} data-line={l.id}>{words.get(l.id)?.title}</li>)}
          </ul>
        )}
      </div>
      <StageCamera onZoomIn={zoomButton(ZOOM_STEP)} onZoomOut={zoomButton(1 / ZOOM_STEP)} onFit={fitMap} />
      {hints.more !== NO_HINTS && <EdgeHintChips past={past(hints.more)} noun="more" onPan={pan} />}
      {marks.highlight && hints.changes !== NO_HINTS && <EdgeHintChips past={past(hints.changes)} noun="changed" word="changes" onPan={pan} />}
      {armedBox && <TapCard kind={BOX_KIND[armedBox.kind]} name={armedBox.title} onOpen={tap.openArmed} onDismiss={tap.clear} />}
    </div>
  );
}
