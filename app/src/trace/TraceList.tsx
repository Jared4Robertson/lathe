// The Trace stage as a list (LA-V98): one use case at a time, chosen from the rows in their order (the focus's row
// first shown), its outcomes and the journeys carrying it out above it (each journey opening to its steps and test) and
// its four stages stacked down, each a heading that opens it (the same open
// boxes as the canvas, per place), its boxes listed under it, each child indented under its parent and each box with
// children carrying its own Open or Close button. It is the view on a phone, and under the canvas its accessible layer,
// visually hidden, its links carrying the keyboard's focus.
import { useState, type CSSProperties, type MouseEvent } from 'react';
import { kindLabel, type RecordIndex } from '../exploring/record-summaries/record-index';
import { stageFor } from '../graph/model';
import { Button } from '../components/Button';
import { journeyBox, STAGE_COLUMN, TRACE_COLUMN_LABELS, TRACE_STAGES, isOpen, rowsOf, visible, type TraceGraph, type Item, type Openness } from './trace';

export interface TraceListProps {
  index: RecordIndex;
  graph: TraceGraph;
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

export function TraceList({ index, graph, order, open, focus, hrefFor, onNavigate, onToggle, access }: TraceListProps) {
  // A journey or one of its boxes shows the row of its first step carrying out a use case.
  const ownRow = rowsOf(graph, focus)[0]?.useCase ?? graph.carries.find((c) => c.journey === graph.journeyOf.get(focus)?.id)?.useCase ?? null;
  const [chosen, setChosen] = useState<{ focus: string; row: string } | null>(null);
  const rows = order.filter((u) => graph.rowOf.has(u));
  const rowId = (chosen?.focus === focus ? chosen.row : null) ?? ownRow ?? rows[0] ?? null;
  const row = rowId ? graph.rowOf.get(rowId) : undefined;
  /** The journeys carrying the row's use case out, each once, in ID order. */
  const carrying = new Set(row ? graph.carries.filter((c) => c.useCase === row.useCase).map((c) => c.journey) : []);
  const journeys = graph.journeys.map((j) => j.id).filter((j) => carrying.has(j));

  const go = (id: string) => (e: MouseEvent) => { if (!plain(e)) return; e.preventDefault(); onNavigate(id); };
  const toggle = (item: Item) => item.opens && (
    <Button className="trace-toggle" aria-expanded={isOpen(item, open)} onClick={() => onToggle(item.opens!)}>
      {isOpen(item, open) ? 'Close' : 'Open'}<span className="sr-only"> {item.words?.title ?? index.byId.get(item.id ?? '')?.title ?? ''}</span>
    </Button>
  );
  const box = (item: Item, heading = false) => {
    const record = item.id && item.role === 'record' ? index.byId.get(item.id) : undefined;
    const indent = { '--depth': heading ? 0 : item.depth } as CSSProperties;
    if (record) {
      const stage = stageFor(index, item.id!, record.kind);
      return (
        <div className="trace-row-box" style={indent}>
          <a className={`trace-col-row stage-${stage}`} href={hrefFor(item.id!)} aria-current={item.id === focus ? 'page' : undefined} data-trace-id={item.id!} onClick={go(item.id!)}>
            <small className="trace-col-meta">{item.meta ?? `${kindLabel(index, record.kind)} · ${item.id}`}</small>
            <span className="trace-col-title">{record.title}</span>
          </a>
          {toggle(item)}
        </div>
      );
    }
    return (
      <div className="trace-row-box" style={indent}>
        <div className={`trace-col-row is-${item.role}`}>
          <small className="trace-col-meta">{item.words!.meta}</small>
          <span className="trace-col-title">{item.words!.title}</span>
        </div>
        {toggle(item)}
      </div>
    );
  };

  return (
    <div className="trace-scroll trace-col-list trace-list" role="region" aria-label="Trace rows" tabIndex={access ? undefined : 0}>
      <label className="trace-pick">
        <span>Use case</span>
        <select value={rowId ?? ''} onChange={(e) => setChosen({ focus, row: e.target.value })}>
          {rows.map((u) => <option key={u} value={u}>{u} · {index.byId.get(u)?.title ?? u}</option>)}
        </select>
      </label>
      {!row ? <p className="hint">No use cases yet.</p> : (
        <>
          <section className="trace-stage-cell" aria-label={TRACE_COLUMN_LABELS.outcome}>
            <h3 className="trace-col-head">{TRACE_COLUMN_LABELS.outcome}</h3>
            {row.data.outcomes.length === 0 ? <p className="hint">Serves no business outcome.</p> : (
              <ul className="trace-col-rows">
                {row.data.outcomes.filter((o) => graph.items.has(`outcome/${o}`)).map((o) => <li key={o}>{box(graph.items.get(`outcome/${o}`)!)}</li>)}
              </ul>
            )}
          </section>
          <section className="trace-stage-cell" aria-label={TRACE_COLUMN_LABELS.journey}>
            <h3 className="trace-col-head">{TRACE_COLUMN_LABELS.journey}</h3>
            {journeys.length === 0 ? <p className="hint">Carried out in no journey.</p> : (
              <ul className="trace-col-rows">
                {journeys.flatMap((j) => visible(graph, journeyBox(j), open)).map((k) => <li key={k}>{box(graph.items.get(k)!)}</li>)}
              </ul>
            )}
          </section>
          {TRACE_STAGES.map((stage) => {
            const keys = visible(graph, row.cells[STAGE_COLUMN[stage]], open);
            return (
              <section key={stage} className="trace-stage-cell" aria-label={TRACE_COLUMN_LABELS[stage]}>
                <h3 className="trace-col-head">{TRACE_COLUMN_LABELS[stage]}</h3>
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
