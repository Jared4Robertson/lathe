import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Background, Controls, Handle, Position, ReactFlow, ReactFlowProvider, useReactFlow, type Edge, type EdgeProps, type Node, type NodeProps } from '@xyflow/react';
import type { RelationRule, SpecIndex } from '../specs/data';
import { relationLabelOf } from '../specs/labels';
import { readMotion } from '../graph/motion';
import { lowerLabel } from '../plural';
import { erdFor, LINE_WORDS, lineGeometry, lineOffsets, RELATION_ENDS, type Erd, type ErdBox, type ErdKind, type ErdLine, type ErdRelation, type Rect } from './erd';
import { layoutErd } from './layout';
import { TapCard, useTapToOpen } from '../graph/touch';
import { EdgeHints } from './hints';

// The Model view: a domain's model (its aggregates and the commands, events, policies, specifications,
// read models and queries around them) or an aggregate's (its entities and fields, and its commands,
// events and policies), in event storming colors, drawn with React Flow and laid out by ELK left to
// right in event storming order. An entity, command, event or policy page draws its aggregate's model
// with that record highlighted. Clicking a box goes to it, as a graph node does. A key under the
// diagram explains the colors and the lines. Like the graph view it never reads the address, so it
// can sit in any pane.

/** What a box is called, in its accessible name, the key and the touch card. */
export const BOX_KIND: Record<ErdKind, string> = {
  aggregate: 'Aggregate', entity: 'Entity', command: 'Command', event: 'Domain event', policy: 'Policy',
  specification: 'Specification', read_model: 'Read model', query: 'Query',
};

/** The key's order of the box kinds, as event storming reads them. */
const KEY_ORDER: readonly ErdKind[] = ['policy', 'command', 'specification', 'aggregate', 'entity', 'event', 'read_model', 'query'];

/** The key's lines in order, each with what its label alone does not say (its whole meaning is the entry's tooltip). */
const LINE_KEY: Record<ErdRelation, { note: string; meaning: string }> = {
  refers_to: { note: 'n:1', meaning: 'A field holds the other aggregate\'s ID: many to one.' },
  has_one: { note: '1:1', meaning: 'An entity has one of the other: one to one.' },
  has_many: { note: '1:n', meaning: 'An entity has many of the other: one to many.' },
  changes: { note: '', meaning: 'The aggregate the command changes.' },
  also_changes: { note: '', meaning: 'A recorded exception: another aggregate the command changes in the same transaction, with its reason.' },
  raises: { note: '', meaning: 'The events the command raises.' },
  hears: { note: 'later', meaning: 'The policy reacts to the event after it is saved, through the outbox.' },
  invokes: { note: '', meaning: 'The command the policy runs.' },
  checks: { note: 'first', meaning: 'A specification the command checks before acting.' },
  reads: { note: '', meaning: 'What a read model or a specification reads.' },
  queries: { note: '', meaning: 'A query the read model answers.' },
  selects_by: { note: '', meaning: 'A specification the query selects by.' },
};
const LINE_ORDER = Object.keys(LINE_KEY) as ErdRelation[];

export interface ModelViewProps {
  index: SpecIndex;
  focus: string;
  onNavigate: (id: string) => void;
  /** Called with the box under the pointer or keyboard focus (`hover`) and the one selected by a first tap (`selected`), for the side bar. */
  onPeek?: (kind: 'hover' | 'selected', id: string | null) => void;
}

interface BoxData extends Record<string, unknown> { box: ErdBox; focus: boolean }
/**
 * `label`: the line's words, read from its drawn source, from the schema's relations (LA-EXP-V03-R07)
 * or the Model view's own for what is no stored link. `title`: the whole sentence, for its tooltip.
 * `hover`: the words shown on a dashed line while it is hovered, or null.
 */
interface LineData extends Record<string, unknown> { line: ErdLine; source: Rect; target: Rect; offset: number; label: string; title: string; hover: string | null }
type BoxNode = Node<BoxData>;
type LineEdge = Edge<LineData>;

/** A line's label, in sentence case: the relation's own words, or the Model view's for what is no stored link. */
export function lineLabel(relations: readonly RelationRule[], relation: ErdRelation): string {
  const own = LINE_WORDS[relation];
  if (own) return own.charAt(0).toUpperCase() + own.slice(1);
  return relationLabelOf(relations, relation);
}

function BoxView({ data }: NodeProps<BoxNode>) {
  const { box } = data;
  const classes = ['erd-box', `erd-${box.kind}`, `tone-${box.tone}`, box.highlight && 'is-highlight', data.focus && 'is-focus'].filter(Boolean).join(' ');
  return (
    <div className={classes} title={`${box.title} (${box.id})`}>
      <Handle type="target" position={Position.Left} className="erd-handle" isConnectable={false} />
      <Handle type="source" position={Position.Right} className="erd-handle" isConnectable={false} />
      <div className="erd-box-head">
        <strong>{box.title}</strong>
        {box.root && <span className="erd-root" title="The aggregate's root entity">root</span>}
      </div>
      <small className="erd-summary">{BOX_KIND[box.kind]}{box.owner ? ` ${box.owner}` : ''}</small>
      {box.kind === 'aggregate' && ((box.entities?.length ?? 0) > 0 || (box.valueObjects?.length ?? 0) > 0) && (
        <ul className="erd-fields" aria-label={`Entities of ${box.title}`}>
          {box.entities?.map((e) => <li key={e.id}><span className="erd-field">{e.title}</span>{e.root && <span className="erd-field-kind">root</span>}</li>)}
          {(box.valueObjects?.length ?? 0) > 0 && (
            <li title={`Value objects: ${box.valueObjects!.join(', ')}`}><span className="erd-field">Value objects: {box.valueObjects!.join(', ')}</span></li>
          )}
        </ul>
      )}
      {box.kind !== 'aggregate' && box.fields.length > 0 && (
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
  return (
    <g className={`erd-line rel-${line.relation}${line.dashed ? ' is-dashed' : ''}${line.context ? ' is-context' : ''}${data.hover ? ' has-hover-label' : ''}`} data-line={line.id} data-ends={`${line.sourceEnd}-${line.targetEnd}`}>
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
 * A line's words: its label, the sentence it says, read the way its link runs ("Loan refers to Member
 * (Loan.Member)", "Suspend member hears Account closed"), and for a dashed line what shows on hover.
 */
export function lineWords(line: ErdLine, label: string, titles: ReadonlyMap<string, string>): { label: string; title: string; hover: string | null } {
  const name = (id: string) => titles.get(id) ?? id;
  const words = lowerLabel(label);
  const sentence = line.reversed ? `${name(line.target)} ${words} ${name(line.source)}` : `${name(line.source)} ${words} ${name(line.target)}`;
  const title = line.via.length > 0 ? `${sentence} (${line.via.join('; ')})` : sentence;
  return { label: words, title, hover: line.dashed ? words : null };
}

const nodeTypes = { box: BoxView };
const edgeTypes = { line: LineView };

export function ModelView({ index, focus, onNavigate, onPeek }: ModelViewProps) {
  const erd = useMemo(() => erdFor(index, focus), [index, focus]);
  if (!erd) return <p className="hint model-missing">The Model view shows a domain, or an aggregate with its entities, commands, events and policies.</p>;
  const scope = index.byId.get(erd.scope);
  const empty = erd.boxes.length === 0;
  const counts = `${erd.boxes.length} ${erd.boxes.length === 1 ? 'box' : 'boxes'} · ${erd.lines.length} ${erd.lines.length === 1 ? 'line' : 'lines'}`;
  const caption = erd.level === 'domain'
    ? `The aggregates of ${scope?.title} and the commands, events, policies, rules and read models around them`
    : `The entities of ${scope?.title}, and its commands, events and policies`;
  return (
    <section className="model-page" aria-label="Model">
      <header className="model-header">
        {/* One line of one text, cut with an ellipsis, its whole text in its tooltip: a new caption never moves anything (LA-PAT-APP-UX-R08). */}
        <p className="model-caption" title={`${caption} · ${counts}`}>{`${caption} · ${counts}`}</p>
      </header>
      {empty ? (
        <p className="placeholder model-empty">{erd.level === 'domain' ? 'This domain has no aggregates yet.' : 'This aggregate has no entities, commands or events yet.'}</p>
      ) : (
        <div className="model-canvas">
          <ReactFlowProvider>
            <ErdCanvas relations={index.workspace.relations} erd={erd} focus={focus} onNavigate={onNavigate} onPeek={onPeek} />
          </ReactFlowProvider>
        </div>
      )}
      <ErdKey erd={erd} highlight={erd.boxes.some((b) => b.highlight)} relations={index.workspace.relations} />
    </section>
  );
}

/** The key under the diagram: the owners, the event storming colors of the kinds drawn, the badges and every kind of line drawn. */
export function ErdKey({ erd, highlight, relations = [] }: { erd: Erd; highlight: boolean; relations?: readonly RelationRule[] }) {
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
  const kinds = KEY_ORDER.filter((k) => erd.boxes.some((b) => b.kind === k));
  const lines = [...new Map(erd.lines.map((l) => [l.relation, l])).values()].sort((a, b) => LINE_ORDER.indexOf(a.relation) - LINE_ORDER.indexOf(b.relation));
  const other = erd.boxes.some((b) => b.tone === 'other');
  // Every entry is a cell of one grid of fixed cells, the colors' first and then the lines', so a model with other
  // entries never moves the key itself, only what is written in its cells (LA-PAT-APP-UX-R08): each cell is keyed by
  // its place, so it stays where it is and only its words change, and the lines start on a row of their own. A
  // cell's whole meaning is its tooltip.
  const text = (words: string) => <span className="erd-key-text">{words}</span>;
  type Entry = { className?: string; title: string; mark: ReactNode; words: string };
  const colors: Entry[] = [
    ...kinds.map((k) => ({ title: BOX_KIND[k], mark: <span className={`erd-key-swatch erd-key-${k}`} aria-hidden="true" />, words: BOX_KIND[k] })),
    { className: 'tone-current', title: "This domain's records", mark: <span className="erd-key-swatch erd-key-current" aria-hidden="true" />, words: 'This domain' },
    ...(other ? [{ className: 'tone-other', title: "Another domain's records, its name in parentheses", mark: <span className="erd-key-swatch erd-key-other" aria-hidden="true" />, words: 'Other domain, in parentheses' }] : []),
    ...(erd.boxes.some((b) => b.context) ? [{ title: erd.level === 'aggregate' ? 'Faded: records of other aggregates and domains' : 'Faded: records of other domains', mark: <span className="erd-key-context" aria-hidden="true" />, words: 'Faded: elsewhere' }] : []),
    ...(erd.boxes.some((b) => b.root) ? [{ title: "The aggregate's root entity", mark: <span className="erd-root">root</span>, words: 'Root entity' }] : []),
    ...(highlight ? [{ title: 'The record this page is about', mark: <span className="erd-key-highlight" aria-hidden="true" />, words: 'This record' }] : []),
  ];
  const lineEntries: Entry[] = lines.map((l) => {
    const { note, meaning } = LINE_KEY[l.relation];
    return { title: meaning, mark: sample(l.relation, l.dashed), words: `${lineLabel(relations, l.relation)}${note && ` (${note})`}` };
  });
  const cells = (entries: Entry[]) => entries.map((e, i) => <li key={i} className={e.className} title={e.title}>{e.mark} {text(e.words)}</li>);
  return (
    <div
      className={`erd-key${open ? ' is-open' : ''}`}
      role="group"
      aria-label="Key"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); } }}
    >
      {/* In a narrow pane the key is one bar: this button opens the whole key over the canvas, moving nothing. */}
      <button type="button" className="erd-key-toggle" aria-expanded={open} aria-controls={gridId} onClick={() => setOpen((o) => !o)}>
        {open ? 'Hide the key' : 'Key'}
      </button>
      <div className="erd-key-grid" id={gridId}>
        <ul className="erd-key-ends" aria-label="Colors">{cells(colors)}</ul>
        <ul className="erd-key-ends" aria-label="Lines">{cells(lineEntries)}</ul>
      </div>
    </div>
  );
}

/** The margin a fit keeps around the boxes: wider at the left, clear of the zoom controls in the bottom left corner. */
export const FIT_MARGIN = { left: 60, right: 24, top: 24, bottom: 24 };

/**
 * The viewport that shows every box, faded context included, inside the margin, centered, never zoomed in past 1:
 * the opening frame of a model leaves nothing out. A big model stays legible by its compact layout (layout.ts).
 */
export function fitRects(rects: Map<string, Rect>, width: number, height: number, margin = FIT_MARGIN) {
  const all = [...rects.values()];
  const minX = Math.min(...all.map((r) => r.x));
  const minY = Math.min(...all.map((r) => r.y));
  const maxX = Math.max(...all.map((r) => r.x + r.width));
  const maxY = Math.max(...all.map((r) => r.y + r.height));
  const innerW = Math.max(1, width - margin.left - margin.right);
  const innerH = Math.max(1, height - margin.top - margin.bottom);
  const zoom = Math.max(0.05, Math.min(1, innerW / (maxX - minX || 1), innerH / (maxY - minY || 1)));
  return {
    x: margin.left + innerW / 2 - ((minX + maxX) / 2) * zoom,
    y: margin.top + innerH / 2 - ((minY + maxY) / 2) * zoom,
    zoom,
  };
}

function ErdCanvas({ relations, erd, focus, onNavigate, onPeek }: { relations: readonly RelationRule[]; erd: Erd; focus: string; onNavigate: (id: string) => void; onPeek?: ModelViewProps['onPeek'] }) {
  const [placed, setPlaced] = useState<{ erd: Erd; rects: Map<string, Rect> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const { setViewport } = useReactFlow();

  useEffect(() => {
    let live = true;
    // Laid out to about the canvas's shape, so a big model wraps into rows instead of one long band.
    const box = wrapper.current?.getBoundingClientRect();
    const aspect = box && box.width > 0 && box.height > 0 ? box.width / box.height : 1.6;
    layoutErd(erd, aspect).then(
      (rects) => { if (live) { setPlaced({ erd, rects }); setError(null); } },
      (e) => { if (live) setError(e instanceof Error ? e.message : String(e)); },
    );
    return () => { live = false; };
  }, [erd]);

  const { nodes, edges } = useMemo(() => {
    if (!placed) return { nodes: [] as BoxNode[], edges: [] as LineEdge[] };
    const { rects } = placed;
    const offsets = lineOffsets(placed.erd.lines);
    const nodes: BoxNode[] = placed.erd.boxes.map((box) => {
      const r = rects.get(box.id) ?? { x: 0, y: 0, width: 0, height: 0 };
      const isFocus = box.id === focus;
      return {
        id: box.id,
        type: 'box',
        position: { x: r.x, y: r.y },
        width: r.width,
        height: r.height,
        draggable: false,
        connectable: false,
        selectable: false,
        handles: [
          { type: 'target' as const, position: Position.Left, x: 0, y: r.height / 2, width: 1, height: 1 },
          { type: 'source' as const, position: Position.Right, x: r.width, y: r.height / 2, width: 1, height: 1 },
        ],
        // A context box is out of focus: no keyboard stop, hidden from assistive technology, faded.
        ...(box.context
          ? { className: 'is-context', focusable: false, domAttributes: { 'aria-hidden': true } }
          : { ariaLabel: `${BOX_KIND[box.kind]} ${box.title}${box.owner ? ` ${box.owner}` : ''}${box.root ? ', root' : ''}${box.highlight ? ' (this record)' : ''}` }),
        data: { box, focus: isFocus },
      };
    });
    const titles = new Map(placed.erd.boxes.map((b) => [b.id, b.title]));
    const edges: LineEdge[] = placed.erd.lines.map((line) => ({
      id: line.id,
      source: line.source,
      target: line.target,
      type: 'line',
      focusable: false,
      selectable: false,
      data: { line, source: rects.get(line.source)!, target: rects.get(line.target)!, offset: offsets.get(line.id) ?? 0, ...lineWords(line, lineLabel(relations, line.relation), titles) },
    }));
    return { nodes, edges };
  }, [placed, focus, relations]);

  // Fit every box, moving there with the shared motion (LA-PAT-APP-UX-R04), or at once.
  const fit = useCallback((animate: boolean) => {
    const box = wrapper.current?.getBoundingClientRect();
    if (!placed || placed.rects.size === 0 || !box || box.width <= 0 || box.height <= 0) return;
    const motion = readMotion();
    setViewport(fitRects(placed.rects, box.width, box.height), animate && motion.duration > 0 ? { duration: motion.duration, ease: motion.ease } : { duration: 0 });
  }, [placed, setViewport]);
  // The edge hints count every box past an edge: the faded context, and what a big model leaves outside.
  const centers = useMemo(() => (placed ? placed.erd.boxes.flatMap((b) => {
    const r = placed.rects.get(b.id);
    return r ? [{ x: r.x + r.width / 2, y: r.y + r.height / 2 }] : [];
  }) : []), [placed]);
  // Before paint (LA-PAT-APP-UX-R08): the first picture appears already fitted, never drawn at
  // the default viewport and then moved; each picture after it glides from the view before.
  const fitted = useRef(false);
  useLayoutEffect(() => {
    if (!placed) return;
    fit(fitted.current);
    fitted.current = true;
  }, [placed, fit]);
  // Fit again whenever the canvas changes size. It observes once, for the canvas's life, and only
  // acts on a real change: observing anew with each picture reported the size again at once and
  // cut each glide short with a jump.
  const latestFit = useRef(fit);
  latestFit.current = fit;
  useEffect(() => {
    const el = wrapper.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let last = '';
    const observer = new ResizeObserver(() => {
      const box = el.getBoundingClientRect();
      const size = `${Math.round(box.width)}x${Math.round(box.height)}`;
      if (size === last) return;
      last = size;
      latestFit.current(false);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const go = (id: string) => { if (id !== focus) onNavigate(id); };
  // By touch, a first tap selects a box and a second tap (or the card's Open chip) opens it.
  const canOpen = useCallback((id: string) => id !== focus, [focus]);
  const tap = useTapToOpen(onNavigate, canOpen, wrapper, focus);
  const armedBox = tap.armed ? erd.boxes.find((b) => b.id === tap.armed) : undefined;
  useEffect(() => { onPeek?.('selected', tap.armed); }, [tap.armed, onPeek]);
  // A new diagram starts with nothing under the pointer.
  useEffect(() => () => onPeek?.('hover', null), [erd, onPeek]);
  const boxAt = (target: EventTarget | null) => (target instanceof Element ? target.closest('.react-flow__node')?.getAttribute('data-id') ?? null : null);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const id = (e.target as HTMLElement).closest?.('.react-flow__node')?.getAttribute('data-id');
    if (!id) return;
    e.preventDefault();
    go(id);
  };

  if (error) return <p className="error">Couldn't draw the diagram: {error}</p>;
  return (
    <div ref={wrapper} className="model-flow" onKeyDown={onKeyDown} onFocus={(e) => onPeek?.('hover', boxAt(e.target))} onBlur={() => onPeek?.('hover', null)}>
      {!placed && <p className="hint graph-loading">Laying out the diagram…</p>}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        edgesFocusable={false}
        onNodeClick={(e, n) => tap.onNodeClick(e, n.id)}
        onNodeMouseEnter={(_, n) => onPeek?.('hover', n.id)}
        onNodeMouseLeave={() => onPeek?.('hover', null)}
        onPaneClick={tap.clear}
        minZoom={0.05}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
      <EdgeHints centers={centers} wrapper={wrapper} />
      {armedBox && (
        <TapCard
          kind={BOX_KIND[armedBox.kind]}
          name={`${armedBox.title}${armedBox.owner ? ` ${armedBox.owner}` : ''}`}
          onOpen={tap.openArmed}
          onDismiss={tap.clear}
        />
      )}
    </div>
  );
}
