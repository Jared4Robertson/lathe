import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Background, Controls, Handle, Position, ReactFlow, ReactFlowProvider, useReactFlow, type Edge, type EdgeProps, type Node, type NodeProps } from '@xyflow/react';
import type { SpecIndex } from '../specs/data';
import type { RelationRule } from '../../../lathe/src/types';
import { relationLabelOf } from '../specs/labels';
import { readMotion } from '../graph/motion';
import { erdFor, lineGeometry, lineOffsets, RELATION_ENDS, type Erd, type ErdBox, type ErdLine, type Rect } from './erd';
import { layoutErd } from './layout';
import { TapCard, useTapToOpen } from '../graph/touch';
import { EdgeHints } from '../graph/hints';

// The Model view: the ERD of a domain (at aggregate level) or of an aggregate (its entities), drawn
// with React Flow and laid out by ELK. An entity page draws its aggregate's ERD with the entity
// highlighted. Clicking a box goes to it, as a graph node does. A key under the diagram explains
// the colors and the line ends. Like the graph view it never reads the address, so it can sit in
// any pane. Domain events (LA-EXP-UC11-R07, R08) are pills in the spark colors, their lines and
// the dashed "reacts to" lines in spark too, each "reacts to" line showing its label on hover.

/** What a box is called, in its accessible name and the touch card. */
const BOX_KIND: Record<ErdBox['kind'], string> = { aggregate: 'Aggregate', entity: 'Entity', event: 'Domain event' };

export interface ModelViewProps {
  index: SpecIndex;
  focus: string;
  onNavigate: (id: string) => void;
  /** Called with the box under the pointer or keyboard focus (`hover`) and the one selected by a first tap (`selected`), for the side bar. */
  onPeek?: (kind: 'hover' | 'selected', id: string | null) => void;
}

interface BoxData extends Record<string, unknown> { box: ErdBox; focus: boolean }
/**
 * `label`: the line's relation in words, read from its link's source, from the meta-model
 * (LA-EXP-V03-R07). `title`: the whole sentence, for its tooltip. `hover`: the words shown on the line
 * while it is hovered (a "reacts to" line's event, or its label), or null.
 */
interface LineData extends Record<string, unknown> { line: ErdLine; source: Rect; target: Rect; offset: number; label: string; title: string; hover: string | null }
type BoxNode = Node<BoxData>;
type LineEdge = Edge<LineData>;

function BoxView({ data }: NodeProps<BoxNode>) {
  const { box } = data;
  const classes = ['erd-box', `erd-${box.kind}`, `tone-${box.tone}`, box.foreign && 'is-foreign', box.highlight && 'is-highlight', data.focus && 'is-focus', box.context && 'is-context'].filter(Boolean).join(' ');
  return (
    <div className={classes} title={`${box.title} (${box.id})`}>
      <Handle type="target" position={Position.Left} className="erd-handle" isConnectable={false} />
      <Handle type="source" position={Position.Right} className="erd-handle" isConnectable={false} />
      <div className="erd-box-head">
        <strong>{box.title}</strong>
        {box.root && <span className="erd-root" title="The aggregate's root entity">root</span>}
      </div>
      {box.owner && <small className="erd-owner">{box.owner}</small>}
      {box.kind === 'event' && <small className="erd-summary">{box.fields.length === 0 ? 'Domain event' : `Domain event · ${box.fields.length} ${box.fields.length === 1 ? 'field' : 'fields'}`}</small>}
      {box.kind === 'aggregate' && (
        <small className="erd-summary">
          {box.rootTitle ? <>Root: {box.rootTitle}</> : 'No root entity'} · {box.entities} {box.entities === 1 ? 'entity' : 'entities'}
        </small>
      )}
      {box.kind === 'entity' && !box.foreign && (
        box.fields.length > 0 ? (
          <ul className="erd-fields" aria-label={`Fields of ${box.title}`}>
            {box.fields.map((f) => <li key={f.field} title={`${f.field}: ${f.kind}`}><span className="erd-field">{f.field}</span><span className="erd-field-kind">{f.kind}</span></li>)}
          </ul>
        ) : <small className="erd-summary">No fields listed</small>
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
    <g className={`erd-line rel-${line.relation}${line.dashed ? ' is-dashed' : ''}${line.context ? ' is-context' : ''}${data.hover ? ' has-hover-label' : ''}${line.event ? ' has-event' : ''}`} data-line={line.id} data-ends={`${line.sourceEnd}-${line.targetEnd}`}>
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
 * A line's words: its label, the sentence it says (read the way its link runs: "Member reacts to
 * Loan opened", "Loan opened raised by Loan") and, for a "reacts to" line, what shows on hover: the
 * event's name on a domain's ERD, where the event is not drawn, and the label on an aggregate's.
 */
export function lineWords(line: ErdLine, label: string, titles: ReadonlyMap<string, string>): { label: string; title: string; hover: string | null } {
  const name = (id: string) => titles.get(id) ?? id;
  if (line.event) {
    return { label, title: `${name(line.target)} ${label} ${line.event.title}, raised by ${name(line.source)}`, hover: line.event.title };
  }
  const title = line.reversed ? `${name(line.target)} ${label} ${name(line.source)}` : `${name(line.source)} ${label} ${name(line.target)}`;
  return { label, title, hover: line.relation === 'reacts_to' ? label : null };
}

const nodeTypes = { box: BoxView };
const edgeTypes = { line: LineView };

export function ModelView({ index, focus, onNavigate, onPeek }: ModelViewProps) {
  const erd = useMemo(() => erdFor(index, focus), [index, focus]);
  if (!erd) return <p className="hint model-missing">The Model view shows a domain, an aggregate or an entity.</p>;
  const scope = index.byId.get(erd.scope);
  const empty = erd.boxes.length === 0;
  const counts = `${erd.boxes.length} ${erd.boxes.length === 1 ? 'box' : 'boxes'} · ${erd.lines.length} ${erd.lines.length === 1 ? 'line' : 'lines'}`;
  const reacts = erd.lines.some((l) => l.relation === 'reacts_to');
  const caption = erd.level === 'domain'
    ? `The aggregates of ${scope?.title}, how they refer to each other${reacts ? ' and how they react to each other\'s events' : ''}`
    : `The entities of ${scope?.title} and their relationships${erd.boxes.some((b) => b.kind === 'event') ? ', and the domain events it raises' : ''}`;
  return (
    <section className="model-page" aria-label="Model">
      <header className="model-header">
        {/* One line of one text, cut with an ellipsis, its whole text in its tooltip: a new caption never moves anything (LA-PAT-APP-UX-R08). */}
        <p className="model-caption" title={`${caption} · ${counts}`}>{`${caption} · ${counts}`}</p>
      </header>
      {empty ? (
        <p className="placeholder model-empty">{erd.level === 'domain' ? 'This domain has no aggregates yet.' : 'This aggregate has no entities yet: add entity records under it, each with a Fields table.'}</p>
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

/** The key under the diagram: the colors (as emoji squares), the line ends, and the event pill and its lines. */
export function ErdKey({ erd, highlight, relations = [] }: { erd: Erd; highlight: boolean; relations?: readonly RelationRule[] }) {
  const end = (ends: [ErdLine['sourceEnd'], ErdLine['targetEnd']], dashed = false, relation = '') => {
    const g = lineGeometry({ x: 0, y: 0, width: 2, height: 2 }, { x: 46, y: 0, width: 2, height: 2 }, ends);
    return (
      <svg className={`erd-key-line${dashed ? ' is-dashed' : ''}${relation ? ` rel-${relation}` : ''}`} viewBox="-2 -9 52 18" width="52" height="18" aria-hidden="true">
        <path className="erd-line-path" d={g.line} />
        {g.sourceEnd && <path className="erd-end" d={g.sourceEnd} />}
        {g.targetEnd && <path className="erd-end" d={g.targetEnd} />}
      </svg>
    );
  };
  const events = erd.boxes.some((b) => b.kind === 'event');
  const raised = erd.lines.some((l) => l.relation === 'raised_by');
  const reacts = erd.lines.some((l) => l.relation === 'reacts_to');
  const highlightsEvent = highlight && erd.boxes.some((b) => b.highlight && b.kind === 'event');
  // The relations' labels, from the meta-model (LA-EXP-V03-R07).
  const reactsTo = relationLabelOf(relations, 'reacts_to');
  const raisedBy = relationLabelOf(relations, 'raised_by');
  return (
    <div className="erd-key" role="group" aria-label="Key" tabIndex={0}>
      <table className="erd-key-table">
        <thead><tr><th scope="col">Color</th><th scope="col">Owner</th></tr></thead>
        <tbody>
          <tr><td>🟦</td><td>The current domain{erd.level === 'aggregate' ? ' (from another aggregate: its name in parentheses)' : ''}</td></tr>
          <tr><td>⬜</td><td>Another domain, named in parentheses</td></tr>
        </tbody>
      </table>
      <ul className="erd-key-ends">
        {erd.level === 'aggregate' ? (
          <>
            <li>{end(RELATION_ENDS.has_one)} Has one: one to one</li>
            <li>{end(RELATION_ENDS.has_many)} Has many: one to many</li>
            <li>{end(RELATION_ENDS.refers_to)} Refers to: many to one</li>
            <li><span className="erd-root">root</span> The aggregate's root entity</li>
            {highlight && !highlightsEvent && <li><span className="erd-key-highlight" aria-hidden="true" /> This entity</li>}
          </>
        ) : (
          <>
            <li>{end(RELATION_ENDS.refers_to)} Its entities refer to the other aggregate: many to one</li>
            <li>{end(RELATION_ENDS.relates_to, true)} Related aggregate, for one whose entities refer to no other</li>
          </>
        )}
        {erd.boxes.some((b) => b.context) && <li><span className="erd-key-context" aria-hidden="true" /> Faded: one ring out, {erd.level === 'aggregate' ? `what the entities it refers to refer to${reacts ? ', and the aggregates reacting to its events' : ''}` : 'the aggregates of other domains'}</li>}
      </ul>
      {(events || reacts) && (
        <ul className="erd-key-ends erd-key-events" aria-label="Domain events">
          {events && <li><span className="erd-key-event" aria-hidden="true" /> A domain event</li>}
          {highlightsEvent && <li><span className="erd-key-event is-highlight" aria-hidden="true" /> This event</li>}
          {raised && <li>{end(RELATION_ENDS.raised_by, false, 'raised_by')} {raisedBy}: the entity whose change raises it</li>}
          {reacts && (erd.level === 'aggregate'
            ? <li>{end(RELATION_ENDS.reacts_to, true, 'reacts_to')} {reactsTo}: an aggregate that reacts to the event, faded</li>
            : <li>{end(RELATION_ENDS.reacts_to, true, 'reacts_to')} {reactsTo}: the aggregate at the arrow reacts to an event the other raises; hover for the event</li>)}
        </ul>
      )}
    </div>
  );
}

/** The boxes in focus: every box but the context ring, or every box when all are context (a domain with no aggregates of its own). */
export function focusRects(erd: Erd, rects: Map<string, Rect>): Map<string, Rect> {
  const inFocus = new Map([...rects].filter(([id]) => !erd.boxes.find((b) => b.id === id)?.context));
  return inFocus.size > 0 ? inFocus : rects;
}

/** The viewport that fits every box, centered, never zoomed in past 1. */
function fitRects(rects: Map<string, Rect>, width: number, height: number, padding = 32) {
  const all = [...rects.values()];
  const minX = Math.min(...all.map((r) => r.x));
  const minY = Math.min(...all.map((r) => r.y));
  const maxX = Math.max(...all.map((r) => r.x + r.width));
  const maxY = Math.max(...all.map((r) => r.y + r.height));
  const zoom = Math.max(0.1, Math.min(1, (width - 2 * padding) / (maxX - minX || 1), (height - 2 * padding) / (maxY - minY || 1)));
  return { x: width / 2 - ((minX + maxX) / 2) * zoom, y: height / 2 - ((minY + maxY) / 2) * zoom, zoom };
}

function ErdCanvas({ relations, erd, focus, onNavigate, onPeek }: { relations: readonly RelationRule[]; erd: Erd; focus: string; onNavigate: (id: string) => void; onPeek?: ModelViewProps['onPeek'] }) {
  const [placed, setPlaced] = useState<{ erd: Erd; rects: Map<string, Rect> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const { setViewport } = useReactFlow();

  useEffect(() => {
    let live = true;
    layoutErd(erd).then(
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
          : { ariaLabel: `${BOX_KIND[box.kind]} ${box.title}${box.owner ? ` ${box.owner}` : ''}${box.root ? ', root' : ''}${box.highlight ? ` (this ${box.kind === 'event' ? 'event' : 'entity'})` : ''}` }),
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
      data: { line, source: rects.get(line.source)!, target: rects.get(line.target)!, offset: offsets.get(line.id) ?? 0, ...lineWords(line, relationLabelOf(relations, line.relation).toLowerCase(), titles) },
    }));
    return { nodes, edges };
  }, [placed, focus, relations]);

  // Fit the boxes in focus, moving there with the shared motion (LA-PAT-APP-UX-R04), or at once;
  // the context ring may run past the canvas's edges (LA-EXP-UC11-R06).
  const fit = useCallback((animate: boolean) => {
    const box = wrapper.current?.getBoundingClientRect();
    if (!placed || placed.rects.size === 0 || !box || box.width <= 0 || box.height <= 0) return;
    const motion = readMotion();
    setViewport(fitRects(focusRects(placed.erd, placed.rects), box.width, box.height), animate && motion.duration > 0 ? { duration: motion.duration, ease: motion.ease } : { duration: 0 });
  }, [placed, setViewport]);
  const centers = useMemo(() => (placed ? placed.erd.boxes.filter((b) => b.context).flatMap((b) => {
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
        minZoom={0.1}
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
