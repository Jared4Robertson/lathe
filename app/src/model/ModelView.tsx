import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Background, Controls, Handle, Position, ReactFlow, ReactFlowProvider, useReactFlow, type Edge, type EdgeProps, type Node, type NodeProps } from '@xyflow/react';
import type { SpecIndex } from '../specs/data';
import { readMotion } from '../graph/motion';
import { erdFor, lineGeometry, lineOffsets, RELATION_ENDS, RELATION_LABELS, type Erd, type ErdBox, type ErdLine, type Rect } from './erd';
import { layoutErd } from './layout';
import { TapCard, useTapToOpen } from '../graph/touch';

// The Model view: the ERD of a domain (at aggregate level) or of an aggregate (its entities), drawn
// with React Flow and laid out by ELK. An entity page draws its aggregate's ERD with the entity
// highlighted. Clicking a box goes to it, as a graph node does. A key under the diagram explains
// the colors and the line ends. Like the graph view it never reads the address, so it can sit in
// any pane.

export interface ModelViewProps {
  index: SpecIndex;
  focus: string;
  onNavigate: (id: string) => void;
}

interface BoxData extends Record<string, unknown> { box: ErdBox; focus: boolean }
interface LineData extends Record<string, unknown> { line: ErdLine; source: Rect; target: Rect; offset: number }
type BoxNode = Node<BoxData>;
type LineEdge = Edge<LineData>;

function BoxView({ data }: NodeProps<BoxNode>) {
  const { box } = data;
  const classes = ['erd-box', `erd-${box.kind}`, `tone-${box.tone}`, box.foreign && 'is-foreign', box.highlight && 'is-highlight', data.focus && 'is-focus'].filter(Boolean).join(' ');
  return (
    <div className={classes} title={`${box.title} (${box.id})`}>
      <Handle type="target" position={Position.Left} className="erd-handle" isConnectable={false} />
      <Handle type="source" position={Position.Right} className="erd-handle" isConnectable={false} />
      <div className="erd-box-head">
        <strong>{box.title}</strong>
        {box.root && <span className="erd-root" title="The aggregate's root entity">root</span>}
      </div>
      {box.owner && <small className="erd-owner">{box.owner}</small>}
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
  return (
    <g className={`erd-line rel-${line.relation}${line.dashed ? ' is-dashed' : ''}`} data-line={line.id} data-ends={`${line.sourceEnd}-${line.targetEnd}`}>
      <title>{`${line.source} ${RELATION_LABELS[line.relation]} ${line.target}`}</title>
      <path className="erd-line-path" d={g.line} />
      <path className="erd-end" d={g.sourceEnd} />
      <path className="erd-end" d={g.targetEnd} />
    </g>
  );
}

const nodeTypes = { box: BoxView };
const edgeTypes = { line: LineView };

export function ModelView({ index, focus, onNavigate }: ModelViewProps) {
  const erd = useMemo(() => erdFor(index, focus), [index, focus]);
  if (!erd) return <p className="hint model-missing">The Model view shows a domain, an aggregate or an entity.</p>;
  const scope = index.byId.get(erd.scope);
  const empty = erd.boxes.length === 0;
  const counts = `${erd.boxes.length} ${erd.boxes.length === 1 ? 'box' : 'boxes'} · ${erd.lines.length} ${erd.lines.length === 1 ? 'line' : 'lines'}`;
  const caption = erd.level === 'domain' ? `The aggregates of ${scope?.title} and how they refer to each other` : `The entities of ${scope?.title} and their relationships`;
  return (
    <section className="model-page" aria-label="Model">
      <header className="model-header">
        {/* One line of one text, cut with an ellipsis, its whole text in its tooltip: a new caption never moves anything (LA-PAT-APP-CODE-R17). */}
        <p className="model-caption" title={`${caption} · ${counts}`}>{`${caption} · ${counts}`}</p>
      </header>
      {empty ? (
        <p className="placeholder model-empty">{erd.level === 'domain' ? 'This domain has no aggregates yet.' : 'This aggregate has no entities yet: add entity records under it, each with a Fields table.'}</p>
      ) : (
        <div className="model-canvas">
          <ReactFlowProvider>
            <ErdCanvas erd={erd} focus={focus} onNavigate={onNavigate} />
          </ReactFlowProvider>
        </div>
      )}
      <ErdKey erd={erd} highlight={erd.boxes.some((b) => b.highlight)} />
    </section>
  );
}

/** The key under the diagram: the colors (as emoji squares) and the line ends. */
export function ErdKey({ erd, highlight }: { erd: Erd; highlight: boolean }) {
  const end = (ends: [ErdLine['sourceEnd'], ErdLine['targetEnd']], dashed = false) => {
    const g = lineGeometry({ x: 0, y: 0, width: 2, height: 2 }, { x: 46, y: 0, width: 2, height: 2 }, ends);
    return (
      <svg className={`erd-key-line${dashed ? ' is-dashed' : ''}`} viewBox="-2 -9 52 18" width="52" height="18" aria-hidden="true">
        <path className="erd-line-path" d={g.line} />
        <path className="erd-end" d={g.sourceEnd} />
        <path className="erd-end" d={g.targetEnd} />
      </svg>
    );
  };
  return (
    <div className="erd-key" role="group" aria-label="Key">
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
            {highlight && <li><span className="erd-key-highlight" aria-hidden="true" /> This entity</li>}
          </>
        ) : (
          <>
            <li>{end(RELATION_ENDS.refers_to)} Its entities refer to the other aggregate: many to one</li>
            <li>{end(RELATION_ENDS.relates_to, true)} Related aggregate, for one whose entities refer to no other</li>
          </>
        )}
      </ul>
    </div>
  );
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

function ErdCanvas({ erd, focus, onNavigate }: { erd: Erd; focus: string; onNavigate: (id: string) => void }) {
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
        ariaLabel: `${box.kind === 'aggregate' ? 'Aggregate' : 'Entity'} ${box.title}${box.owner ? ` ${box.owner}` : ''}${box.root ? ', root' : ''}${box.highlight ? ' (this entity)' : ''}`,
        data: { box, focus: isFocus },
      };
    });
    const edges: LineEdge[] = placed.erd.lines.map((line) => ({
      id: line.id,
      source: line.source,
      target: line.target,
      type: 'line',
      focusable: false,
      selectable: false,
      data: { line, source: rects.get(line.source)!, target: rects.get(line.target)!, offset: offsets.get(line.id) ?? 0 },
    }));
    return { nodes, edges };
  }, [placed, focus]);

  // Fit the picture, moving there with the shared motion (LA-PAT-APP-CODE-R12), or at once.
  const fit = useCallback((animate: boolean) => {
    const box = wrapper.current?.getBoundingClientRect();
    if (!placed || placed.rects.size === 0 || !box || box.width <= 0 || box.height <= 0) return;
    const motion = readMotion();
    setViewport(fitRects(placed.rects, box.width, box.height), animate && motion.duration > 0 ? { duration: motion.duration, ease: motion.ease } : { duration: 0 });
  }, [placed, setViewport]);
  // Before paint (LA-PAT-APP-CODE-R17): the first picture appears already fitted, never drawn at
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
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const id = (e.target as HTMLElement).closest?.('.react-flow__node')?.getAttribute('data-id');
    if (!id) return;
    e.preventDefault();
    go(id);
  };

  if (error) return <p className="error">Couldn't draw the diagram: {error}</p>;
  return (
    <div ref={wrapper} className="model-flow" onKeyDown={onKeyDown}>
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
        onPaneClick={tap.clear}
        minZoom={0.1}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
      {armedBox && (
        <TapCard
          kind={armedBox.kind === 'aggregate' ? 'Aggregate' : 'Entity'}
          name={`${armedBox.title}${armedBox.owner ? ` ${armedBox.owner}` : ''}`}
          onOpen={tap.openArmed}
          onDismiss={tap.clear}
        />
      )}
    </div>
  );
}
