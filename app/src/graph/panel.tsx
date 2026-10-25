import type { MouseEvent, ReactNode } from 'react';
import { LongList } from '../components/LongList';
import type { SpecIndex } from '../specs/data';
import { FILE_KIND, PARENT, graphRelationLabel, parseGroupId, type Neighborhood } from './model';

// The graph's part of the inspector: what the drawn graph connects to the center, the files a
// trace reaches, and the legend. Kept apart from GraphPage (React Flow and ELK) so the inspector
// can show it without loading the graph.

/** A link to another center: a real address for new tabs, onNavigate on a plain click. */
export function NodeLink({ id, onNavigate, hrefFor, children, title }: { id: string; onNavigate: (id: string) => void; hrefFor: (id: string) => string; children: ReactNode; title?: string }) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onNavigate(id);
  };
  return <a href={hrefFor(id)} onClick={onClick} title={title}>{children}</a>;
}

/** How a node near the center is related to it: parent, child, a group, or the relations between them. */
export function relationTo(index: SpecIndex, graph: Neighborhood, center: string, id: string): string {
  const group = parseGroupId(id);
  if (group && !index.byId.has(id)) return group.parent === center ? 'child group' : 'its group';
  const record = index.byId.get(center);
  if (!record) {
    const g = parseGroupId(center);
    if (g?.parent === id) return 'parent';
    return 'member';
  }
  if (record.parent === id) return 'parent';
  if (index.byId.get(id)?.parent === center) return 'child';
  return graph.edges
    .filter((e) => e.relation !== PARENT && ((e.source === center && e.target === id) || (e.target === center && e.source === id)))
    .map((e) => (e.source === center ? graphRelationLabel(e.relation) : `${graphRelationLabel(e.relation)} this`))
    .join(', ');
}

export interface GraphInfo {
  graph: Neighborhood;
  tracing: boolean;
}

/** The inspector's graph section: the records drawn next to the center and the files a trace reaches. */
export function GraphConnections({ index, info, onNavigate, hrefFor }: { index: SpecIndex; info: GraphInfo; onNavigate: (id: string) => void; hrefFor: (id: string) => string }) {
  const { graph, tracing } = info;
  const near = graph.nodes.filter((n) => n.distance === 1 && n.kind !== FILE_KIND);
  const files = graph.nodes.filter((n) => n.kind === FILE_KIND);
  return (
    <>
      <section className="inspector-section" aria-labelledby="inspector-near">
        <h3 id="inspector-near">{tracing ? 'Traceability chain' : 'Connected in the graph'} <span className="section-count">{near.length}</span></h3>
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
        <section className="inspector-section" aria-labelledby="inspector-files">
          <h3 id="inspector-files">Files <span className="section-count">{files.length}</span></h3>
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
          <li><span className="graph-swatch stage-group" /> Group of one kind of child, with its count; its chevron points right when folded, down when open</li>
          <li><span className="graph-swatch stage-file" /> File named by a component or test</li>
          <li><span className="graph-line rel-structure" /> parent / child (the tree, through groups)</li>
          <li><span className="graph-line rel-trace" /> satisfies, proves, fulfills</li>
          <li><span className="graph-line rel-design" /> uses, implements, depends on</li>
          <li><span className="graph-line rel-pattern" /> follows (a use case's pattern, a cross-link)</li>
          <li><span className="graph-line rel-other" /> other links</li>
          <li><span className="graph-mark error">!</span> has errors <span className="graph-mark gap">gap</span> not satisfied or not proved (on a group: among its members)</li>
        </ul>
        <p className="hint">Tiers run left to right: product, domain, aggregates and use cases, rules and requirements, design records, tests. A record with several kinds of child, or many of one kind, reaches them through a group in its own column. A trace also runs left to right, from the rule to the files that build and test it.</p>
        <p className="hint">Click a record, or press Enter on it, to center the graph there. Click a group, or press Enter or o on it, to open or close it; center on a group from the inspector. Arrow keys or Tab move between boxes; + and - change the depth, t switches trace mode, and . fits the graph to the view.</p>
      </section>
    </details>
  );
}
