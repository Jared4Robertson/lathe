import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import { layoutModel, type ModelEdgeData, type ModelNodeData } from './layout';
import type { Model } from './types';

type ModelNode = Node<ModelNodeData>;
type ModelEdge = Edge<ModelEdgeData>;

const RELATION_LABELS: Record<string, string> = { is_a: 'is a' };

function Handles() {
  return (
    <>
      <Handle type="target" position={Position.Left} className="handle" />
      <Handle type="source" position={Position.Right} className="handle" />
    </>
  );
}

function ContextNode({ data }: NodeProps<ModelNode>) {
  return <div className="context-node"><span>{data.label}</span></div>;
}

function AggregateNode({ data }: NodeProps<ModelNode>) {
  return (
    <div className={`aggregate-node status-${data.status}`}>
      <Handles />
      <strong>{data.label}</strong>
      <small>{data.subtitle}</small>
    </div>
  );
}

function LeafNode({ data }: NodeProps<ModelNode>) {
  return (
    <div className={`leaf-node kind-${data.kind} status-${data.status}`}>
      <Handles />
      <strong>{data.label}{data.status === 'open' ? ' ?' : ''}</strong>
      <small>{data.subtitle}</small>
    </div>
  );
}

// Draws the route ELK computed, with the relation as a label on its longest segment.
function ModelEdgeView({ id, data, markerEnd }: EdgeProps<ModelEdge>) {
  const points = data?.points ?? [];
  if (points.length < 2) return null;
  const path = `M ${points.map((p) => `${p.x} ${p.y}`).join(' L ')}`;
  let best = 0;
  let bestLength = -1;
  for (let i = 0; i < points.length - 1; i++) {
    const length = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
    if (length > bestLength) { best = i; bestLength = length; }
  }
  const x = (points[best].x + points[best + 1].x) / 2;
  const y = (points[best].y + points[best + 1].y) / 2;
  const link = data!.link;
  const label = `${RELATION_LABELS[link.relation] ?? link.relation}${data!.uncertain ? ' ?' : ''}`;
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} className={data!.uncertain ? 'uncertain' : ''} />
      <EdgeLabelRenderer>
        <div className="edge-label" style={{ transform: `translate(-50%, -50%) translate(${x}px, ${y}px)` }}>{label}</div>
      </EdgeLabelRenderer>
    </>
  );
}

const nodeTypes = { context: ContextNode, aggregate: AggregateNode, leaf: LeafNode };
const edgeTypes = { model: ModelEdgeView };

export default function App() {
  const [model, setModel] = useState<Model | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [graph, setGraph] = useState<{ nodes: ModelNode[]; edges: ModelEdge[] }>({ nodes: [], edges: [] });
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/model');
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? response.statusText);
      setModel(body);
      setGraph(await layoutModel(body));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    load();
    import.meta.hot?.on('model:changed', load);
    return () => import.meta.hot?.off('model:changed', load);
  }, [load]);

  // Highlight the selected term, its links and the terms at their other ends.
  const { nodes, edges } = useMemo(() => {
    if (!selected) return { nodes: graph.nodes, edges: graph.edges.map((e) => ({ ...e, markerEnd: { type: MarkerType.ArrowClosed } })) };
    const touches = (e: ModelEdge) => e.data!.link.source === selected || e.data!.link.target === selected;
    const neighbours = new Set([selected]);
    for (const l of model?.links ?? []) if (l.source === selected || l.target === selected) { neighbours.add(l.source); neighbours.add(l.target); }
    return {
      nodes: graph.nodes.map((n) => ({ ...n, className: n.type === 'context' || neighbours.has(n.data.term) ? (n.data.term === selected ? 'selected-term' : '') : 'dimmed' })),
      edges: graph.edges.map((e) => ({ ...e, markerEnd: { type: MarkerType.ArrowClosed }, className: touches(e) ? 'highlighted' : 'dimmed' })),
    };
  }, [graph, model, selected]);

  const term = model?.terms.find((t) => t.name === selected);
  const links = model?.links.filter((l) => l.source === selected || l.target === selected) ?? [];

  return (
    <div className="app">
      <header>
        <div>
          <p className="eyebrow">Domain model · live from model/*.csv via DuckDB</p>
          <h1>Lathe</h1>
        </div>
        {model && (
          <p className={`checks ${model.checks.ok ? 'ok' : 'failed'}`} title={model.checks.message}>
            {model.checks.ok ? 'All checks passed' : 'Checks failed'}
          </p>
        )}
      </header>
      {error && <p className="error">Couldn't load the model: {error}</p>}
      {model && !model.checks.ok && <p className="error">{model.checks.message}</p>}
      <div className="workspace">
        <div className="canvas">
          {graph.nodes.length > 0 && <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            nodesDraggable={false}
            nodesConnectable={false}
            onNodeClick={(_, n) => n.data.term && setSelected(n.data.term === selected ? null : n.data.term)}
            onPaneClick={() => setSelected(null)}
            fitView
            minZoom={0.2}
          >
            <Background gap={24} size={1} />
            <Controls showInteractive={false} />
          </ReactFlow>}
        </div>
        <aside>
          {term ? (
            <>
              <p className="eyebrow">{term.kind.replace('_', ' ')} · {term.status}</p>
              <h2>{term.name}</h2>
              <p>{term.definition}</p>
              <h3>Links</h3>
              <ul>
                {links.map((l, i) => (
                  <li key={i} className={`status-${l.status}`}>
                    <span>{l.source} <em>{RELATION_LABELS[l.relation] ?? l.relation}</em> {l.target}{l.status === 'open' ? ' ?' : ''}</span>
                    {(l.cardinality || l.note) && <small>{[l.cardinality, l.note].filter(Boolean).join(' · ')}</small>}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <h2>Select a term</h2>
              <p>Click any box to see its definition and links, and to highlight what it connects to.</p>
              <p className="legend"><span className="swatch agg" /> aggregate <span className="swatch evt" /> domain event <span className="dash" /> open or unclear ("?")</p>
              <p className="hint">Edit model/terms.csv or model/links.csv and this view reloads.</p>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
