import { useEffect, useState } from 'react';
import ELK, { type ElkNode } from 'elkjs/lib/elk.bundled.js';
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
import { navigate } from '../router';
import { byIdOrder, kindLabel, recordPath, relationLabel, type SpecIndex } from './data';

interface RecordNodeData extends Record<string, unknown> {
  id: string;
  title: string;
  kind: string;
  kindLabel: string;
  stage: string;
}
interface LinkEdgeData extends Record<string, unknown> {
  label: string;
  points: { x: number; y: number }[];
  parent: boolean;
}
type RecordNode = Node<RecordNodeData>;
type LinkEdge = Edge<LinkEdgeData>;

const elk = new ELK();
const WIDTH = 200;
const HEIGHT = 58;

function RecordNodeView({ data }: NodeProps<RecordNode>) {
  return (
    <div className={`spec-node stage-${data.stage || 'none'} kind-${data.kind}`} title={data.title}>
      <Handle type="target" position={Position.Left} className="handle" />
      <Handle type="source" position={Position.Right} className="handle" />
      <small>{data.kindLabel} · {data.id}</small>
      <strong>{data.title}</strong>
    </div>
  );
}

function LinkEdgeView({ id, data, markerEnd }: EdgeProps<LinkEdge>) {
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
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} className={data!.parent ? 'parent-edge' : ''} />
      <EdgeLabelRenderer>
        <div className="edge-label" style={{ transform: `translate(-50%, -50%) translate(${x}px, ${y}px)` }}>{data!.label}</div>
      </EdgeLabelRenderer>
    </>
  );
}

const nodeTypes = { record: RecordNodeView };
const edgeTypes = { link: LinkEdgeView };

// Draws a domain's records, their links, and (dashed) each rule or requirement's parent.
async function layoutDomain(index: SpecIndex, domain: string) {
  const records = index.workspace.records.filter((r) => r.domain === domain && r.id !== domain).sort(byIdOrder);
  const ids = new Set(records.map((r) => r.id));
  const edges = [
    ...index.workspace.links
      .filter((l) => ids.has(l.source) && ids.has(l.target))
      .map((l) => ({ source: l.source, target: l.target, label: relationLabel(l.relation), parent: false })),
    ...records
      .filter((r) => r.parent && ids.has(r.parent))
      .map((r) => ({ source: r.parent!, target: r.id, label: 'has', parent: true })),
  ];
  const graph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'LEFT',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.spacing.nodeNodeBetweenLayers': '80',
      'elk.spacing.nodeNode': '24',
      'elk.spacing.edgeNode': '20',
    },
    children: records.map((r): ElkNode => ({ id: r.id, width: WIDTH, height: HEIGHT })),
    edges: edges.map((e, i) => ({ id: `e${i}`, sources: [e.source], targets: [e.target] })),
  };
  const laid = await elk.layout(graph);
  const nodes: RecordNode[] = (laid.children ?? []).map((n) => {
    const r = index.byId.get(n.id)!;
    return {
      id: n.id,
      type: 'record',
      position: { x: n.x ?? 0, y: n.y ?? 0 },
      width: WIDTH,
      height: HEIGHT,
      draggable: false,
      data: { id: r.id, title: r.title, kind: r.kind, kindLabel: kindLabel(index, r.kind), stage: index.kinds.get(r.kind)?.stage ?? '' },
    };
  });
  const flowEdges: LinkEdge[] = (laid.edges ?? []).map((e) => {
    const link = edges[Number(e.id.slice(1))];
    const section = e.sections?.[0];
    return {
      id: e.id,
      source: link.source,
      target: link.target,
      type: 'link',
      markerEnd: { type: MarkerType.ArrowClosed },
      data: { label: link.label, parent: link.parent, points: section ? [section.startPoint, ...(section.bendPoints ?? []), section.endPoint] : [] },
    };
  });
  return { nodes, edges: flowEdges };
}

export default function DomainGraph({ index, domain }: { index: SpecIndex; domain: string }) {
  const [graph, setGraph] = useState<{ nodes: RecordNode[]; edges: LinkEdge[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    layoutDomain(index, domain).then(
      (g) => { if (live) { setGraph(g); setError(null); } },
      (e) => { if (live) setError(e instanceof Error ? e.message : String(e)); },
    );
    return () => { live = false; };
  }, [index, domain]);

  if (error) return <p className="error">Couldn't draw the graph: {error}</p>;
  if (!graph) return <p className="hint">Laying out the graph…</p>;
  if (graph.nodes.length === 0) return <p className="hint">This domain has no records to draw yet.</p>;
  return (
    <div className="spec-graph">
      <p className="hint">Click a box to open its record. Dashed lines join a rule or requirement to its parent.</p>
      <div className="spec-graph-canvas">
        <ReactFlow
          nodes={graph.nodes}
          edges={graph.edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          onNodeClick={(_, n) => navigate(recordPath(n.id))}
          fitView
          minZoom={0.2}
        >
          <Background gap={24} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}
