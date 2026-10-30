// The Delivery view as a list (LA-V98): one use case at a time, chosen from the rows in their order (the focus's row
// first shown), its outcomes above it and its four stages stacked down, each a heading that opens it (the same open
// boxes as the canvas, per place), its boxes listed under it, each child indented under its parent and each box with
// children carrying its own Open or Close button. It is the view on a phone, and under the canvas its accessible layer,
// visually hidden, its links carrying the keyboard's focus.
import { useState, type CSSProperties, type MouseEvent } from 'react';
import { kindLabel, type RecordIndex } from '../../exploring/record-summaries/record-index';
import { stageFor } from '../../graph/model';
import { DELIVERY_COLUMN_LABELS, DELIVERY_COLUMNS, isOpen, rowsOf, visible, type DeliveryGraph, type Item, type Openness } from './delivery';

export interface DeliveryListProps {
  index: RecordIndex;
  graph: DeliveryGraph;
  /** The rows in the order the view shows them. */
  order: readonly string[];
  open: Openness;
  focus: string;
  hrefFor: (id: string) => string;
  onNavigate: (id: string) => void;
  onToggle: (opens: string) => void;
  /** Under the canvas: no focus stop of its own. */
  access: boolean;
}

const plain = (e: MouseEvent) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

export function DeliveryList({ index, graph, order, open, focus, hrefFor, onNavigate, onToggle, access }: DeliveryListProps) {
  const ownRow = rowsOf(graph, focus)[0]?.useCase ?? null;
  const [chosen, setChosen] = useState<{ focus: string; row: string } | null>(null);
  const rows = order.filter((u) => graph.rowOf.has(u));
  const rowId = (chosen?.focus === focus ? chosen.row : null) ?? ownRow ?? rows[0] ?? null;
  const row = rowId ? graph.rowOf.get(rowId) : undefined;

  const go = (id: string) => (e: MouseEvent) => { if (!plain(e)) return; e.preventDefault(); onNavigate(id); };
  const toggle = (item: Item) => item.opens && (
    <button type="button" className="delivery-toggle" aria-expanded={isOpen(item, open)} onClick={() => onToggle(item.opens!)}>
      {isOpen(item, open) ? 'Close' : 'Open'}<span className="sr-only"> {item.words?.title ?? index.byId.get(item.id ?? '')?.title ?? ''}</span>
    </button>
  );
  const box = (item: Item, heading = false) => {
    const record = item.id && item.role === 'record' ? index.byId.get(item.id) : undefined;
    const indent = { '--depth': heading ? 0 : item.depth } as CSSProperties;
    if (record) {
      const stage = stageFor(index, item.id!, record.kind);
      return (
        <div className="delivery-row-box" style={indent}>
          <a className={`trace-col-row stage-${stage}`} href={hrefFor(item.id!)} aria-current={item.id === focus ? 'page' : undefined} data-trace-id={item.id!} onClick={go(item.id!)}>
            <small className="trace-col-meta">{kindLabel(index, record.kind)} · {item.id}</small>
            <span className="trace-col-title">{record.title}</span>
          </a>
          {toggle(item)}
        </div>
      );
    }
    return (
      <div className="delivery-row-box" style={indent}>
        <div className={`trace-col-row is-${item.role}`}>
          <small className="trace-col-meta">{item.words!.meta}</small>
          <span className="trace-col-title">{item.words!.title}</span>
        </div>
        {toggle(item)}
      </div>
    );
  };

  return (
    <div className="trace-scroll trace-col-list delivery-list" role="region" aria-label="Delivery" tabIndex={access ? undefined : 0}>
      <label className="delivery-pick">
        <span>Use case</span>
        <select value={rowId ?? ''} onChange={(e) => setChosen({ focus, row: e.target.value })}>
          {rows.map((u) => <option key={u} value={u}>{u} · {index.byId.get(u)?.title ?? u}</option>)}
        </select>
      </label>
      {!row ? <p className="hint">No use cases yet.</p> : (
        <>
          <section className="delivery-stage" aria-label={DELIVERY_COLUMN_LABELS.outcome}>
            <h3 className="trace-col-head">{DELIVERY_COLUMN_LABELS.outcome}</h3>
            {row.data.outcomes.length === 0 ? <p className="hint">Serves no business outcome.</p> : (
              <ul className="trace-col-rows">
                {row.data.outcomes.filter((o) => graph.items.has(`outcome/${o}`)).map((o) => <li key={o}>{box(graph.items.get(`outcome/${o}`)!)}</li>)}
              </ul>
            )}
          </section>
          {[1, 2, 3, 4].map((c) => {
            const keys = visible(graph, row.cells[c], open);
            return (
              <section key={c} className="delivery-stage" aria-label={DELIVERY_COLUMN_LABELS[DELIVERY_COLUMNS[c]]}>
                <h3 className="trace-col-head">{DELIVERY_COLUMN_LABELS[DELIVERY_COLUMNS[c]]}</h3>
                <ul className="trace-col-rows">
                  {keys.map((k, i) => <li key={k}>{box(graph.items.get(k)!, i === 0)}</li>)}
                </ul>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
