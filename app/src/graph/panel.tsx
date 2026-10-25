import type { MouseEvent, ReactNode } from 'react';
import { LongList } from '../components/LongList';
import type { SpecIndex } from '../specs/data';
import { FILE_KIND, PARENT, graphEdgeLabel, nodeParent, parseGroupId, type Neighborhood } from './model';

// The graph's part of the side bar: what the drawn graph connects to the center, the files a
// trace reaches, and the legend. Kept apart from GraphPage (React Flow and ELK) so the side bar
// can show it without loading the graph.

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
  // Focus records only: the context ring is out of focus.
  const near = graph.nodes.filter((n) => n.distance === 1 && n.kind !== FILE_KIND && !n.context && !n.more);
  const files = graph.nodes.filter((n) => n.kind === FILE_KIND);
  return (
    <>
      <section className="side-bar-section" aria-labelledby="side-bar-near">
        <h3 id="side-bar-near">{tracing ? 'Traceability chain' : 'Connected in the graph'} <span className="section-count">{near.length}</span></h3>
        {near.length === 0 ? <p className="hint">{tracing ? 'Nothing fulfills, satisfies or proves it yet.' : 'Nothing connected (check the filters).'}</p> : (
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
      <Legend />
    </>
  );
}

export function Legend() {
  return (
    <details className="graph-legend">
      <summary>Legend</summary>
      <section aria-label="Legend">
        <ul className="plain">
          <li><span className="graph-swatch stage-define" /> Define (aggregate, rule, use case, requirement)</li>
          <li><span className="graph-swatch stage-design" /> Design (flow, flow step, view, endpoint, component, test)</li>
          <li><span className="graph-swatch stage-structural" /> Structural (product, domain, question)</li>
          <li><span className="graph-swatch stage-group" /> Stage, folder or group, as the nav names it, with its count; its chevron points right when folded, down when open</li>
          <li><span className="graph-swatch stage-context" /> Context: the next level out, faded; click it to center there, hover it for its name</li>
          <li><span className="graph-swatch stage-more" /> More of a level than the picture shows: click it to center on their group, or their parent</li>
          <li><span className="graph-swatch stage-file" /> File named by a component or test</li>
          <li><span className="graph-line rel-structure" /> parent / child (the tree, through stages, folders and groups)</li>
          <li><span className="graph-line is-link" /> the center's own links, with Links on (satisfies, proves, uses and the rest)</li>
          <li><span className="graph-line rel-trace" /> satisfies, proves, fulfills</li>
          <li><span className="graph-line rel-design" /> uses, implements, depends on</li>
          <li><span className="graph-line rel-pattern" /> follows (a use case's pattern, a cross-link)</li>
          <li><span className="graph-line rel-other" /> other links</li>
          <li><span className="graph-mark error">!</span> has errors <span className="graph-mark gap">gap</span> not satisfied or not proved (on a group: among its members)</li>
        </ul>
        <p className="hint">The graph's tree is the nav's: a domain holds Define and Design, each stage its folders, each folder its records. Levels run left to right, and depth counts them each way, folders included. A trace also runs left to right, from the rule to the files that build and test it.</p>
        <p className="hint">Click a record or a group, or press Enter on it, to center the graph there. A group's chevron, or o, opens or closes it in place. Arrow keys or Tab move between boxes; + and - change the depth, l switches Links, t switches trace mode, and . fits the graph to the view. Alt+Up steps out to the parent, Alt+Down in to the first child, and Alt+Shift+Left or Right to a sibling.</p>
      </section>
    </details>
  );
}
