// The Trace stage's columns on a phone (LA-V98-R13): one column at a time, the walk's levels, with a back row naming the
// box above it. A box that holds anything opens its column (a record by becoming the focus, as a click on the canvas does);
// a link opens its capability, a file its first naming record in its chain; a gap opens nothing.
import { useMemo, useState, type MouseEvent } from 'react';
import type { SpecIndex } from '../specs/data';
import { stageFor } from '../graph/model';
import { holds } from './columns';
import { nodeLabel, traceFade, type TraceMap, type TraceNode } from './tree';

export interface ColumnListProps {
  index: SpecIndex;
  map: TraceMap;
  focus: string;
  /** The node the focus stands on (tree.ts focusKey). */
  at: string;
  gapsOnly: boolean;
  hrefFor: (id: string) => string;
  /** Opens a record, with the node it was opened from. */
  onNavigate: (id: string, at?: string) => void;
}

const FADE = { focusFade: 0.25 };

/** A node's title: its words when it is no record, else its record's. */
const titleOf = (index: SpecIndex, n: TraceNode) => n.words?.title ?? index.byId.get(n.id)?.title ?? n.id;

export function ColumnList({ index, map, focus, at, gapsOnly, hrefFor, onNavigate }: ColumnListProps) {
  // The column shown: the focus's children, or its own column when it holds nothing; a mark that is no record (Untraced)
  // opens its column here without moving the focus.
  const [opened, setOpened] = useState<{ focus: string; owner: string } | null>(null);
  const shown = opened?.focus === focus && map.map.nodes.has(opened.owner) ? opened.owner : holds(map, at) > 0 ? at : map.map.nodes.get(at)?.parent ?? map.product;
  const node = map.map.nodes.get(shown)!;
  const up = node.parent;
  const fade = useMemo(() => traceFade(map, null, gapsOnly, FADE), [map, gapsOnly]);

  /** Opens a node's column or record from a row, as a click on its box does. */
  const follow = (n: TraceNode) => {
    if (n.role === 'record') { onNavigate(n.id, n.key); return; }
    if (holds(map, n.key) > 0) { setOpened({ focus, owner: n.key }); return; }
    if (!n.opens) return;
    const own = n.chain ? map.copies.get(n.opens)?.find((k) => map.nodes.get(k)!.chain === n.chain) : undefined;
    onNavigate(n.opens, own);
  };
  const back = () => {
    if (up === null) return;
    const n = map.nodes.get(up)!;
    setOpened(null);
    if (n.id !== focus) onNavigate(n.id, n.key);
  };
  const plain = (e: MouseEvent) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
  const own = map.nodes.get(shown)!;

  return (
    <div className="trace-scroll trace-col-list" role="region" aria-label="Trace columns" tabIndex={0}>
      {up !== null && (
        <a className="trace-col-back" href={hrefFor(map.nodes.get(up)!.id)} onClick={(e) => { if (!plain(e)) return; e.preventDefault(); back(); }}>
          <span aria-hidden="true">‹</span>{titleOf(index, map.nodes.get(up)!)}
        </a>
      )}
      <h3 className="trace-col-head">{titleOf(index, own)} <span className="section-count">{node.children.length}</span></h3>
      <ul className="trace-col-rows">
        {node.children.map((key) => {
          const n = map.nodes.get(key)!;
          const label = nodeLabel(index, n);
          const record = n.role === 'record' ? index.byId.get(n.id) : undefined;
          const stage = record ? stageFor(index, n.id, record.kind) : 'structural';
          const count = holds(map, key);
          const current = key === at || (n.role === 'record' && n.id === focus);
          const target = n.role === 'record' ? n.id : n.opens;
          const body = (
            <>
              <small className="trace-col-meta">{label.meta}</small>
              <span className="trace-col-title">{label.title}</span>
              {count > 0 && <span className="trace-col-count" aria-label={`holds ${count}`}>{count} ›</span>}
            </>
          );
          const className = `trace-col-row stage-${stage} is-${n.role}${fade(key) < 1 ? ' is-faded' : ''}`;
          return (
            <li key={key}>
              {target || count > 0 ? (
                <a className={className} href={hrefFor(target ?? focus)} aria-current={current ? 'page' : undefined} data-trace-id={target ?? undefined}
                  onClick={(e) => { if (!plain(e)) return; e.preventDefault(); follow(n); }}>{body}</a>
              ) : <div className={className}>{body}</div>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
