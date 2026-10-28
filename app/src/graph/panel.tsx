import type { MouseEvent, ReactNode } from 'react';
import { LongList } from '../components/LongList';
import type { SpecIndex, Stage, StageRule } from '../specs/data';
import { FILE_KIND, PARENT, graphEdgeLabel, nodeParent, parseGroupId, type Neighborhood } from './model';
import { MARKS, SHAPES, type Mark, type Shape } from './shapes';
import { MarkIcon, ShapeIcon } from './shape-icons';

// The graph's part of the side bar: what the framed picture connects to the center, the files a
// trace reaches, and the legend. Kept apart from GraphPage (React Flow) so the side bar can show
// it without loading the graph.

/** A link to another center: a real address for new tabs, onNavigate on a plain click. */
export function NodeLink({ id, onNavigate, hrefFor, children, title, ariaLabel, className }: { id: string; onNavigate: (id: string) => void; hrefFor: (id: string) => string; children: ReactNode; title?: string; ariaLabel?: string; className?: string }) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onNavigate(id);
  };
  return <a href={hrefFor(id)} onClick={onClick} title={title} aria-label={ariaLabel} className={className}>{children}</a>;
}

/** How a node near the center is related to it: parent, child, a group, or the relations between them. */
export function relationTo(index: SpecIndex, graph: Neighborhood, center: string, id: string): string {
  // The tree first (stages, folders and groups are levels of it), then the links drawn.
  const isGroupId = !index.byId.has(id) && parseGroupId(id) !== null;
  if (nodeParent(index, id) === center) return isGroupId ? 'child group' : index.byId.has(center) ? 'child' : 'member';
  if (nodeParent(index, center) === id) return isGroupId ? 'its group' : 'parent';
  if (isGroupId) return parseGroupId(id)!.parent === center ? 'child group' : 'its group';
  const record = index.byId.get(center);
  if (!record) return parseGroupId(center)?.parent === id ? 'parent' : 'member';
  if (record.parent === id) return 'parent';
  if (index.byId.get(id)?.parent === center) return 'child';
  return graph.edges
    .filter((e) => e.relation !== PARENT && ((e.source === center && e.target === id) || (e.target === center && e.source === id)))
    .map((e) => graphEdgeLabel(index, e, e.source === center ? 'source' : 'target'))
    .join(', ');
}

export interface GraphInfo {
  graph: Neighborhood;
  tracing: boolean;
}

/** The side bar's graph section: the records drawn next to the center and the files a trace reaches. */
export function GraphConnections({ index, info, onNavigate, hrefFor }: { index: SpecIndex; info: GraphInfo; onNavigate: (id: string) => void; hrefFor: (id: string) => string }) {
  const { graph, tracing } = info;
  // As the picture lays them out: column by column (the parent before the children), each column top to bottom in the tree's order.
  const near = graph.nodes.filter((n) => n.distance === 1 && n.kind !== FILE_KIND).sort((a, b) => a.column - b.column || a.row - b.row);
  const files = graph.nodes.filter((n) => n.kind === FILE_KIND);
  return (
    <>
      <section className="side-bar-section" aria-labelledby="side-bar-near">
        <h3 id="side-bar-near">{tracing ? 'Traceability chain' : 'Connected in the graph'} <span className="section-count">{near.length}</span></h3>
        {near.length === 0 ? <p className="hint">{tracing ? 'Nothing designs, builds or proves it yet.' : 'Nothing connected (check the filters).'}</p> : (
          <LongList
            label="Connected records"
            className="plain graph-near"
            items={near}
            itemKey={(n) => n.id}
            searchText={(n) => `${n.id} ${n.title}`}
            render={(n) => (
              <>
                <NodeLink id={n.id} onNavigate={onNavigate} hrefFor={hrefFor}>{n.group ? <>{n.title}</> : <><code>{n.id}</code> {n.title}</>}</NodeLink>
                <small className="meta"> {relationTo(index, graph, graph.focus, n.id)}</small>
              </>
            )}
          />
        )}
      </section>
      {files.length > 0 && (
        <section className="side-bar-section" aria-labelledby="side-bar-files">
          <h3 id="side-bar-files">Files <span className="section-count">{files.length}</span></h3>
          <LongList label="Files" className="plain" items={files} itemKey={(f) => f.id} searchText={(f) => f.title} render={(f) => <code>{f.title}</code>} />
        </section>
      )}
      <Legend stages={index.workspace.stages} />
    </>
  );
}

/** What each stage's swatch holds, in the key. */
const STAGE_KINDS: Readonly<Record<Stage, string>> = {
  discovery: 'business outcome',
  'domain-model': 'domain, aggregate, entity, value object, constraint, invariant, specification, domain event, command, read model, query, policy, domain service, term',
  'use-cases': 'capability, use case, UC requirement, pattern and its rules',
  'interaction-design': 'flow, flow step, view, view requirement, endpoint, API requirement, integration',
  'technical-specification': 'the technical record that implements each design record, a table, a UI component, a standard and its rules',
  'test-plan': 'every kind of test, and the test data sets tests start from',
};
const STAGE_NAMES = Object.keys(STAGE_KINDS) as Stage[];

/** The graph's key: one swatch per stage, labeled by the stage's label from the schema (or its name in words). */
export function Legend({ stages = [] }: { stages?: readonly StageRule[] }) {
  const label = (stage: Stage) => stages.find((s) => s.stage === stage)?.label ?? `${stage.charAt(0).toUpperCase()}${stage.slice(1).replaceAll('-', ' ')}`;
  return (
    <details className="graph-legend">
      <summary>Legend</summary>
      <section aria-label="Legend">
        <ul className="plain">
          {STAGE_NAMES.map((stage) => (
            <li key={stage}><span className={`graph-swatch stage-${stage}`} /> {label(stage)} ({STAGE_KINDS[stage]})</li>
          ))}
          <li><span className="graph-swatch stage-structural" /> Structural (product)</li>
          <li><span className="graph-swatch kind-question" /> Open question, in the warning color (dashed in the Nested and Voronoi views)</li>
          <li><span className="graph-swatch stage-group" /> Groups: a stage, folder or group, a folder outlined in its stage's color (gray for open questions)</li>
          <li><span className="graph-swatch is-focus" /> The focus, ringed</li>
        </ul>
        <h4 className="graph-legend-heading">Shapes</h4>
        <ul className="plain">
          {(Object.keys(SHAPES) as Shape[]).map((shape) => (
            <li key={shape}><span className={`graph-swatch is-shape shape-${shape}`}><ShapeIcon shape={shape} /></span> {SHAPES[shape].kinds}: {SHAPES[shape].name}</li>
          ))}
          {(Object.keys(MARKS) as Mark[]).map((mark) => (
            <li key={mark}><span className={`graph-swatch is-shape mark-${mark}`}><MarkIcon mark={mark} /></span> {MARKS[mark]}</li>
          ))}
        </ul>
        <p className="hint">In the Tree view each box's outline is its kind's shape. In the Nested and Voronoi views every box keeps its rectangle or cell, and its shape is the small mark before its kind and ID.</p>
        <ul className="plain">
          <li><span className="graph-swatch stage-nested" /> Nested view: a box holding its children below its name</li>
          <li><span className="graph-swatch is-cell" /> Voronoi view: a cell made of its children's cells, its name at its top</li>
          <li><span className="graph-swatch stage-bar" /> A bar: children too small to draw at this zoom</li>
          <li><span className="graph-swatch stage-file" /> File named by a technical record or a test</li>
          <li><span className="graph-line rel-structure" /> parent / child (the tree, through stages, folders and groups)</li>
          <li><span className="graph-line is-link" /> the center's own links, with Links on (fulfills, invokes, raises and the rest)</li>
          <li><span className="graph-line rel-trace" /> fulfills (a step and a UC requirement), enforces (a table's unique key and an invariant)</li>
          <li><span className="graph-line rel-design" /> invokes, happens in, exchanges with, renders, meets (a standard rule)</li>
          <li><span className="graph-line rel-pattern" /> follows (a domain's or use case's pattern, a cross-link)</li>
          <li><span className="graph-line rel-event" /> raises, hears (a domain event's links)</li>
          <li><span className="graph-line rel-file" /> names file (a technical record's or test's file)</li>
          <li><span className="graph-line rel-other" /> other links</li>
          <li><span className="graph-mark error">!</span> has errors <span className="graph-mark warning">!</span> has warnings <span className="graph-mark gap">gap</span> not designed or not proved (on a group: among its members)</li>
        </ul>
        <p className="hint">The graph is one map of the nav's tree: a product holds its own stages and its domains, a domain its five stages, each stage a folder per kind, each folder the records that start a branch of the stage, and each record what sits under it in the same stage. Levels run left to right, each parent as tall as its children, and nothing changes size: focusing moves the camera. Depth is how many levels below the focus the camera frames, folders included. A trace runs left to right, from an obligation to what designs it, the technical records that build it, the tests that prove it and their files.</p>
        <p className="hint">The Nested layout (v) draws the same tree as boxes inside boxes: the product made of its stages and domains, each domain of its stages, each stage of its folders, each box as big as the records under it. Focusing frames the box; depth is how many levels inside it are labeled, and zooming in labels the rest.</p>
        <p className="hint">The Voronoi layout draws the same tree as polygon cells inside cells: the product a hexagon split into its stages and domains, each domain split into its stages, and so on down, each cell as big as the records under it and never too small for its name. It frames and labels as the Nested layout does.</p>
        <p className="hint">Click a record or a group, or press Enter on it, to focus it. Scroll, pinch or drag to look around. Once the graph has focus (click its canvas or a box), the arrow keys step through the tree, each step moving the focus. In the Tree view, Left goes to the parent, Right to the first child, and Up and Down to the previous and next sibling; in the Nested and Voronoi views, which draw children inside their parent, Up goes to the parent, Down to the first child, and Left and Right to the previous and next sibling. Tab and Shift+Tab move between the boxes; + and - change the depth, l switches Links, t switches trace mode, and . frames the focus again.</p>
      </section>
    </details>
  );
}
