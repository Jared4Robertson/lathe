import { useMemo } from 'react';
import { LongList } from '../components/LongList';
import { groupLabel } from '../graph/model';
import { NodeLink, type GraphInfo } from '../graph/panel';
import { ERD_EMPTY, erdFor } from '../erd/erd';
import { obligationsUnder } from '../trace/chain';
import { isObligation } from '../trace/offer';
import { kindLabel, type SpecIndex } from '../specs/data';
import { listTitle } from '../specs/parts';
import type { SideMode } from './sideBarState';

// The side bar's Outline (LA-V95-R07): what the stage holds, as rows to jump to.
// - Graph: the records the camera frames, grouped by level from left to right.
// - ERD: the boxes, those in focus first.
// - Trace: the obligations the matrix rows hold, under their parents; nothing more for one obligation's chain.
// Each list is rows that are clickable anywhere (LA-PAT-APP-UX-R05), searchable past 10 rows.

export interface SideBarOutlineProps {
  index: SpecIndex;
  focus: string;
  mode: SideMode;
  graph: GraphInfo | null;
  onNavigate: (id: string) => void;
  hrefFor: (id: string) => string;
}

export function SideBarOutline(props: SideBarOutlineProps) {
  if (props.mode === 'graph') return <GraphOutline {...props} />;
  if (props.mode === 'erd') return <ErdOutline {...props} />;
  return <TraceOutline {...props} />;
}

// ---------- Graph ----------

function GraphOutline({ index, graph, onNavigate, hrefFor }: SideBarOutlineProps) {
  const levels = useMemo(() => {
    if (!graph) return [];
    const nodes = graph.graph.nodes;
    const columns = [...new Set(nodes.map((n) => n.column))].sort((a, b) => a - b);
    return columns.map((c, i) => ({ level: i + 1, nodes: nodes.filter((n) => n.column === c).sort((a, b) => a.row - b.row) }));
  }, [graph]);
  if (!graph) return <p className="hint" role="status">Drawing the graph…</p>;
  if (levels.length === 0) return <p className="hint">Nothing in focus (check the filters).</p>;
  const center = graph.graph.focus;
  return (
    <>
      {levels.map(({ level, nodes }) => (
        <section key={level} className="side-bar-section" aria-labelledby={`outline-level-${level}`}>
          <h3 id={`outline-level-${level}`}>Level {level}{nodes.some((n) => n.id === center) && <small className="meta"> the center</small>}<span className="section-count">{nodes.length}</span></h3>
          <LongList
            label={`Level ${level}`}
            className="record-list outline-list"
            items={nodes}
            itemKey={(n) => n.id}
            searchText={(n) => `${n.id} ${n.title}`}
            itemClassName={(n) => (n.id === center ? 'is-center' : undefined)}
            render={(n) => (
              <NodeLink id={n.id} onNavigate={onNavigate} hrefFor={hrefFor} className="row-link outline-record">
                {n.group ? <span>{groupLabel(index, n.id)}</span> : <><code>{n.id}</code> <span>{n.title}</span></>}
                <small className="meta">{n.group ? 'Group' : kindLabel(index, n.kind)}</small>
              </NodeLink>
            )}
          />
        </section>
      ))}
    </>
  );
}

// ---------- ERD ----------

function ErdOutline({ index, focus, onNavigate, hrefFor }: SideBarOutlineProps) {
  const erd = useMemo(() => erdFor(index, focus), [index, focus]);
  if (!erd) return null;
  if (erd.boxes.length === 0) return <p className="hint">{ERD_EMPTY[erd.level]}</p>;
  // What the diagram draws in focus, kind by kind in the schema's order, then the faded context.
  const inFocus = erd.boxes.filter((b) => !b.context);
  const kinds = [...new Set(inFocus.map((b) => b.kind))];
  const parts = [
    ...kinds.map((k) => {
      const boxes = inFocus.filter((b) => b.kind === k);
      return { key: k, title: listTitle(index, boxes.map((b) => index.byId.get(b.id)!).filter(Boolean), 'In focus'), boxes };
    }),
    { key: 'context', title: 'Faded', boxes: erd.boxes.filter((b) => b.context) },
  ].filter((p) => p.boxes.length > 0);
  return (
    <>
      {parts.map((p) => (
        <section key={p.key} className="side-bar-section" aria-labelledby={`outline-${p.key}`}>
          <h3 id={`outline-${p.key}`}>{p.title}<span className="section-count">{p.boxes.length}</span></h3>
          <LongList
            label={p.title}
            className="record-list outline-list"
            items={p.boxes}
            itemKey={(b) => b.id}
            searchText={(b) => `${b.id} ${b.title}`}
            itemClassName={(b) => (b.id === focus || b.highlight ? 'is-center' : undefined)}
            render={(b) => (
              <NodeLink id={b.id} onNavigate={onNavigate} hrefFor={hrefFor} className="row-link outline-record">
                <code>{b.id}</code> <span>{b.title}</span>
                {b.owner && <small className="meta">{b.owner}</small>}
              </NodeLink>
            )}
          />
        </section>
      ))}
    </>
  );
}

// ---------- Trace ----------

function TraceOutline({ index, focus, onNavigate, hrefFor }: SideBarOutlineProps) {
  const ids = useMemo(() => (isObligation(index, focus) ? [] : obligationsUnder(index, focus)), [index, focus]);
  if (ids.length === 0) return <p className="hint">The chain is one row: its columns are the outline.</p>;
  const records = ids.map((id) => index.byId.get(id)!);
  const title = listTitle(index, records, 'Obligations');
  return (
    <section className="side-bar-section" aria-labelledby="outline-obligations">
      <h3 id="outline-obligations">{title}<span className="section-count">{ids.length}</span></h3>
      <LongList
        label={title}
        className="record-list outline-list"
        items={records}
        itemKey={(r) => r.id}
        searchText={(r) => `${r.id} ${r.title}`}
        render={(r) => (
          <NodeLink id={r.id} onNavigate={onNavigate} hrefFor={hrefFor} className="row-link outline-record">
            <code>{r.id}</code> <span>{r.title}</span>
            {r.parent && <small className="meta">{r.parent}</small>}
          </NodeLink>
        )}
      />
    </section>
  );
}
