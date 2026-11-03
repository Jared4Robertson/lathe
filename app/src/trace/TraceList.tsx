// The Trace stage as a list (LA-V98): one use case at a time, chosen from the rows in their order (the focus's row
// first shown), its outcomes and the journeys carrying it out above it (each journey opening to its steps and test) and
// its four stages stacked down, each a heading that opens it (the same open
// boxes as the canvas, per place), its boxes listed under it, each child after its parent and each box with
// children carrying its own Open or Close button. It is the canvas's accessible layer on every width, visually hidden
// under it, its links carrying the keyboard's focus.
import { useState, type MouseEvent } from 'react';
import { kindLabel, type RecordIndex } from '../exploring/record-summaries/record-index';
import { Button } from '../components/Button';
import { journeyBox, STAGE_COLUMN, TRACE_COLUMN_LABELS, TRACE_STAGES, isOpen, rowsOf, visible, wordsName, type TraceGraph, type Item, type Openness } from './trace';

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
}

const plain = (e: MouseEvent) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

export function TraceList({ index, graph, order, open, focus, hrefFor, onNavigate, onToggle }: TraceListProps) {
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
    <Button aria-expanded={isOpen(item, open)} onClick={() => onToggle(item.opens!)}>
      {isOpen(item, open) ? 'Close' : 'Open'}<span className="sr-only"> {item.words ? wordsName(item.words) : index.byId.get(item.id ?? '')?.title ?? ''}</span>
    </Button>
  );
  const box = (item: Item) => {
    const record = item.id && item.role === 'record' ? index.byId.get(item.id) : undefined;
    if (record) {
      return (
        <div>
          <a href={hrefFor(item.id!)} aria-current={item.id === focus ? 'page' : undefined} data-trace-id={item.id!} onClick={go(item.id!)}>
            <small>{`${kindLabel(index, record.kind)} · ${item.id}`}</small>{' '}
            <span>{record.title}</span>
            {item.status && <small>{item.status}</small>}
          </a>
          {toggle(item)}
        </div>
      );
    }
    return (
      <div>
        <div>
          {item.words!.meta && <small>{item.words!.meta}</small>}{item.words!.meta && ' '}
          {item.words!.title && <span>{item.words!.title}</span>}
          {item.words!.status && <small>{item.words!.status}</small>}
        </div>
        {toggle(item)}
      </div>
    );
  };

  return (
    <div role="region" aria-label="Trace rows">
      <label>
        <span>Use case</span>
        <select value={rowId ?? ''} onChange={(e) => setChosen({ focus, row: e.target.value })}>
          {rows.map((u) => <option key={u} value={u}>{u} · {index.byId.get(u)?.title ?? u}</option>)}
        </select>
      </label>
      {!row ? <p className="hint">No use cases yet.</p> : (
        <>
          <section aria-label={TRACE_COLUMN_LABELS.outcome}>
            <h3>{TRACE_COLUMN_LABELS.outcome}</h3>
            {row.data.outcomes.length === 0 ? <p className="hint">Serves no business outcome.</p> : (
              <ul>
                {row.data.outcomes.filter((o) => graph.items.has(`outcome/${o}`)).map((o) => <li key={o}>{box(graph.items.get(`outcome/${o}`)!)}</li>)}
              </ul>
            )}
          </section>
          <section aria-label={TRACE_COLUMN_LABELS.journey}>
            <h3>{TRACE_COLUMN_LABELS.journey}</h3>
            {journeys.length === 0 ? <p className="hint">Carried out in no journey.</p> : (
              <ul>
                {journeys.flatMap((j) => visible(graph, journeyBox(j), open)).map((k) => <li key={k}>{box(graph.items.get(k)!)}</li>)}
              </ul>
            )}
          </section>
          {TRACE_STAGES.map((stage) => {
            const keys = visible(graph, row.cells[STAGE_COLUMN[stage]], open);
            return (
              <section key={stage} aria-label={TRACE_COLUMN_LABELS[stage]}>
                <h3>{TRACE_COLUMN_LABELS[stage]}</h3>
                <ul>
                  {keys.map((k) => <li key={k}>{box(graph.items.get(k)!)}</li>)}
                </ul>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
