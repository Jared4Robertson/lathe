import ELK, { type ElkExtendedEdge, type ElkNode } from 'elkjs/lib/elk.bundled.js';
import type { Edge, Node } from '@xyflow/react';
import type { Kind, Link, Model, Status, Term } from './types';

export interface ModelNodeData extends Record<string, unknown> {
  term: string;
  label: string;
  kind: Kind | 'context';
  status: Status;
  subtitle: string;
}

export interface ModelEdgeData extends Record<string, unknown> {
  link: Link;
  points: { x: number; y: number }[];
  uncertain: boolean;
}

const elk = new ELK();

const SIZES: Record<string, { width: number; height: number }> = {
  entity: { width: 170, height: 50 },
  value_object: { width: 170, height: 50 },
  domain_event: { width: 150, height: 56 },
  term: { width: 120, height: 44 },
  topic: { width: 170, height: 44 },
};

const KIND_LABELS: Record<Kind, string> = {
  aggregate: 'aggregate',
  entity: 'entity',
  value_object: 'value object',
  domain_event: 'domain event',
  term: 'term',
  topic: 'topic',
};

const CONTEXT_LABELS: Record<string, string> = {
  people_and_tools: 'People and tools',
  making_software: 'Making software',
  sdlc: 'Software development lifecycle',
};

const contextId = (context: string) => `context:${context}`;
const partId = (aggregate: string, part: string) => `${aggregate}/${part}`;

// Turns the model into an ELK graph (contexts contain aggregates and events; aggregates contain
// their parts), runs the layout, and converts the result into React Flow nodes and edges.
export async function layoutModel(model: Model): Promise<{ nodes: Node<ModelNodeData>[]; edges: Edge<ModelEdgeData>[] }> {
  const terms = new Map(model.terms.map((t) => [t.name, t]));
  const contains = model.links.filter((l) => l.relation === 'contains');
  const others = model.links.filter((l) => l.relation !== 'contains');

  // The diagram checks forbid a part in more than one aggregate, but a diagram is drawn even while
  // its checks fail, so each placement still gets its own node rather than breaking the layout.
  const placements = new Map<string, string[]>();
  for (const l of contains) placements.set(l.target, [...(placements.get(l.target) ?? []), partId(l.source, l.target)]);
  const nodeIdsFor = (name: string) => placements.get(name) ?? [name];

  const subtitles = new Map<string, string>();
  for (const l of contains) subtitles.set(partId(l.source, l.target), l.note ?? KIND_LABELS[terms.get(l.target)!.kind]);

  const leaf = (id: string, term: Term): ElkNode => ({ id, ...SIZES[term.kind] });
  const contexts = [...new Set(model.terms.map((t) => t.context))];

  const graph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.spacing.nodeNodeBetweenLayers': '70',
      'elk.spacing.nodeNode': '28',
      'elk.spacing.edgeNode': '20',
      'elk.json.edgeCoords': 'ROOT',
    },
    children: contexts.map((context) => ({
      id: contextId(context),
      layoutOptions: { 'elk.padding': '[top=52,left=24,bottom=24,right=24]' },
      children: model.terms
        .filter((t) => t.context === context && !placements.has(t.name))
        .map((t) =>
          t.kind === 'aggregate'
            ? {
                id: t.name,
                layoutOptions: { 'elk.padding': '[top=56,left=16,bottom=16,right=16]', 'elk.direction': 'DOWN' },
                children: contains.filter((l) => l.source === t.name).map((l) => leaf(partId(t.name, l.target), terms.get(l.target)!)),
              }
            : leaf(t.name, t),
        ),
    })),
    edges: others.flatMap((link, i): ElkExtendedEdge[] => {
      const sources = nodeIdsFor(link.source);
      const targets = nodeIdsFor(link.target);
      return sources.flatMap((s) => targets.map((t, j) => ({ id: `e${i}-${s}-${j}-${t}`, sources: [s], targets: [t] })));
    }),
  };

  const laid = await elk.layout(graph);

  const nodes: Node<ModelNodeData>[] = [];
  const visit = (n: ElkNode, parentId?: string) => {
    if (n.id !== 'root') {
      const isContext = n.id.startsWith('context:');
      const name = isContext ? n.id.slice('context:'.length) : n.id.includes('/') ? n.id.split('/')[1] : n.id;
      const term = terms.get(name);
      nodes.push({
        id: n.id,
        type: isContext ? 'context' : term!.kind === 'aggregate' ? 'aggregate' : 'leaf',
        position: { x: n.x ?? 0, y: n.y ?? 0 },
        width: n.width,
        height: n.height,
        parentId,
        draggable: false,
        selectable: !isContext,
        data: {
          term: isContext ? '' : name,
          label: isContext ? CONTEXT_LABELS[name] ?? name : name,
          kind: isContext ? 'context' : term!.kind,
          status: isContext ? 'decided' : term!.status,
          subtitle: isContext ? '' : subtitles.get(n.id) ?? KIND_LABELS[term!.kind],
        },
      });
    }
    for (const child of n.children ?? []) visit(child, n.id === 'root' ? undefined : n.id);
  };
  visit(laid);

  const edges: Edge<ModelEdgeData>[] = (laid.edges ?? []).map((e) => {
    const link = others[Number(e.id.slice(1).split('-')[0])];
    const section = e.sections?.[0];
    const points = section ? [section.startPoint, ...(section.bendPoints ?? []), section.endPoint] : [];
    const uncertain = link.status === 'open' || nodeIdsFor(link.target).length > 1 || nodeIdsFor(link.source).length > 1;
    return {
      id: e.id,
      source: e.sources[0],
      target: e.targets[0],
      type: 'model',
      data: { link, points, uncertain },
    };
  });

  return { nodes, edges };
}
