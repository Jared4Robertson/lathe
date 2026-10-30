// The All-at-once view on a phone (LA-V98): one column at a time, chosen by a row of the five columns' names (the
// focus's column first), the focus's own links listed above it by kind (what it serves and reaches, what builds and
// proves it), each opening its record. A column shows a hundred boxes at a time; Gaps only fades what is off its paths.
import { useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { kindLabel, type RecordIndex } from '../exploring/record-summaries/record-index';
import { stageFor } from '../graph/model';
import { Button } from '../components/Button';
import { ALL_COLUMN_LABELS, ALL_COLUMNS, GAP_WORDS, keptBy, LINK_LABELS, type AllGraph, type LinkKind } from './all';
import { TRACE_PAGE } from './views';

export interface AllListProps {
  index: RecordIndex;
  graph: AllGraph;
  focus: string;
  gapsOnly: boolean;
  hrefFor: (id: string) => string;
  onNavigate: (id: string) => void;
}

/** What a link is called seen from each end: from the left ("Serves"), and from the right ("Served by"). */
const FROM_RIGHT: Record<LinkKind, string> = { serves: 'Serves', reaches: 'Reached by', built: 'Builds', proved: 'Proves' };

const plain = (e: MouseEvent) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

export function AllList({ index, graph, focus, gapsOnly, hrefFor, onNavigate }: AllListProps) {
  const own = graph.nodes.get(focus);
  const [chosen, setChosen] = useState<{ focus: string; column: number; shown: number } | null>(null);
  const column = chosen?.focus === focus ? chosen.column : own?.column ?? 0;
  const shown = chosen?.focus === focus && chosen.column === column ? chosen.shown : TRACE_PAGE;
  const kept = useMemo(() => (gapsOnly ? keptBy(graph, null, true) : null), [graph, gapsOnly]);
  const keys = graph.columns[column] ?? [];

  const go = (id: string) => (e: MouseEvent) => { if (!plain(e)) return; e.preventDefault(); onNavigate(id); };
  const row = (key: string, current: boolean): ReactNode => {
    const n = graph.nodes.get(key)!;
    const record = index.byId.get(key);
    const faded = kept !== null && !kept.keys.has(key);
    if (n.gap) {
      return (
        <div className={`trace-col-row is-gap${faded ? ' is-faded' : ''}`}>
          <small className="trace-col-meta">Gap · {n.gap.obligation}</small>
          <span className="trace-col-title">{GAP_WORDS[n.gap.missing]}</span>
        </div>
      );
    }
    const stage = record ? stageFor(index, key, record.kind) : 'structural';
    return (
      <a className={`trace-col-row stage-${stage}${faded ? ' is-faded' : ''}`} href={hrefFor(key)} aria-current={current ? 'page' : undefined} data-trace-id={key} onClick={go(key)}>
        <small className="trace-col-meta">{record ? `${kindLabel(index, record.kind)} · ${key}` : key}{n.under ? '' : ' · not under an outcome'}</small>
        <span className="trace-col-title">{record?.title ?? key}</span>
      </a>
    );
  };

  // The focus's links, by kind: those from its left, then those to its right.
  const links: { words: string; keys: string[] }[] = [];
  if (own) {
    const by = (list: readonly number[] | undefined, end: 'from' | 'to', words: (k: LinkKind) => string) => {
      const groups = new Map<string, string[]>();
      for (const l of list ?? []) { const link = graph.links[l]; const w = words(link.kind); (groups.get(w) ?? groups.set(w, []).get(w)!).push(link[end]); }
      for (const [w, ks] of groups) links.push({ words: w, keys: ks });
    };
    by(graph.into.get(focus), 'from', (k) => FROM_RIGHT[k]);
    by(graph.out.get(focus), 'to', (k) => LINK_LABELS[k]);
  }

  return (
    <div className="trace-scroll trace-col-list" role="region" aria-label="Trace columns" tabIndex={0}>
      <div className="trace-col-tabs" role="group" aria-label="Column">
        {ALL_COLUMNS.map((c, i) => (
          <button key={c} type="button" aria-pressed={i === column} onClick={() => setChosen({ focus, column: i, shown: TRACE_PAGE })}>
            {ALL_COLUMN_LABELS[c]} <span className="section-count">{graph.columns[i].filter((k) => graph.nodes.get(k)!.role === 'record').length}</span>
          </button>
        ))}
      </div>
      {own && (
        <section className="trace-col-focus" aria-label="The focus's links">
          {row(focus, true)}
          {links.length === 0 ? <p className="hint">Nothing links to it.</p> : (
            <dl className="trace-col-links">
              {links.map((g) => (
                <div key={g.words}>
                  <dt>{g.words} <span className="section-count">{g.keys.length}</span></dt>
                  <dd>
                    <ul className="trace-col-rows">{g.keys.map((k) => <li key={k}>{row(k, false)}</li>)}</ul>
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      )}
      <h3 className="trace-col-head">{ALL_COLUMN_LABELS[ALL_COLUMNS[column]]}</h3>
      <ul className="trace-col-rows">
        {keys.slice(0, shown).map((key) => <li key={key}>{row(key, key === focus)}</li>)}
      </ul>
      {shown < keys.length && (
        <p className="trace-more">
          <Button onClick={() => setChosen({ focus, column, shown: shown + TRACE_PAGE })}>Show {Math.min(TRACE_PAGE, keys.length - shown)} more</Button>
          <span className="hint"> {shown} of {keys.length} shown</span>
        </p>
      )}
    </div>
  );
}
