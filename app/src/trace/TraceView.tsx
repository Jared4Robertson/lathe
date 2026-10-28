// The Trace view of an address, /<id>?view=trace (LA-TRC-UC10).
import { useMemo, useState, type ReactNode } from 'react';
import { Button } from '../components/Button';
import { NodeLink } from '../graph/panel';
import { groupName, isGroup } from '../graph/model';
import { kindLabel, type SpecIndex } from '../specs/data';
import { gapColumns, isObligation, TRACE_COLUMN_LABELS, TRACE_COLUMNS, traceChain, traceMatrix, type TraceColumn, type TraceFile, type TraceRow } from './chain';

// What the focus owes and how far it has come, as columns left to right: obligation, design, build,
// tests, files (chain.ts). On an obligation it is that obligation's chain, each column a list of
// cards. On a record or group with obligations under it (a use case, an aggregate, a view, a domain,
// a stage, a product) it is a traceability matrix: one row per obligation, grouped by its parent,
// each empty cell a visible gap, with a "Gaps only" filter. Every cell links to its record; a file
// links to the record that names it. Long matrices show a page of rows at a time, so a product's
// stays fast. Like the graph it never reads the address, so it can sit in any pane.

export interface TraceViewProps {
  index: SpecIndex;
  focus: string;
  onNavigate: (id: string) => void;
  hrefFor: (id: string) => string;
  /** Called with the record under the pointer or keyboard focus, for the side bar's Details. */
  onPeek?: (kind: 'hover' | 'selected', id: string | null) => void;
}

/** How many matrix rows show before "Show more". */
export const TRACE_PAGE = 100;

/** Why a column is not owed, for its cell. */
const NOT_OWED: Record<'design' | 'build', string> = {
  design: 'Designed by its technical records',
  build: 'Proved only',
};

/** A column's empty cell, as a gap in words. */
const MISSING: Record<TraceColumn, string> = { design: 'No design', build: 'Not built', tests: 'No tests', files: 'No files' };

export function TraceView(props: TraceViewProps) {
  const { index, focus } = props;
  if (isObligation(index, focus)) return <TraceChainView key={focus} {...props} />;
  return <TraceMatrixView key={focus} {...props} />;
}

/** A link to a record in a cell or card: its ID, and its title where there is room. */
function Ref({ id, props, compact, className }: { id: string; props: TraceViewProps; compact?: boolean; className?: string }) {
  const record = props.index.byId.get(id);
  const title = record ? `${record.title} (${id})` : id;
  return (
    <span onPointerEnter={() => props.onPeek?.('hover', id)} onPointerLeave={() => props.onPeek?.('hover', null)} onFocus={() => props.onPeek?.('hover', id)} onBlur={() => props.onPeek?.('hover', null)}>
      <NodeLink id={id} onNavigate={props.onNavigate} hrefFor={props.hrefFor} title={title} className={className ?? 'trace-ref'}>
        {compact ? <code>{id}</code> : (
          <>
            <small className="meta">{record ? kindLabel(props.index, record.kind) : ''}</small>
            <code>{id}</code>
            <span className="trace-card-title">{record?.title ?? ''}</span>
          </>
        )}
      </NodeLink>
    </span>
  );
}

/** A file, linked to the first record that names it. */
function FileRef({ file, props, compact }: { file: TraceFile; props: TraceViewProps; compact?: boolean }) {
  const title = `${file.path}, named by ${file.namedBy.join(', ')}`;
  return (
    <NodeLink id={file.namedBy[0]} onNavigate={props.onNavigate} hrefFor={props.hrefFor} title={title} className={compact ? 'trace-ref trace-file' : 'trace-card trace-file'}>
      <code>{file.path}</code>
      {!compact && <small className="meta">Named by {file.namedBy.join(', ')}</small>}
    </NodeLink>
  );
}

/** What an empty cell says: a gap, or why the column is not owed. */
function Empty({ row, column }: { row: TraceRow; column: TraceColumn }) {
  if (row.notOwed.has(column)) return <span className="trace-not-owed">{NOT_OWED[column as 'design' | 'build']}</span>;
  return <span className="trace-missing">{MISSING[column]}</span>;
}

/** The items of one column of a row. */
const itemsOf = (row: TraceRow, column: TraceColumn): number => (column === 'files' ? row.files.length : row[column].length);

// ---------- One obligation's chain ----------

function TraceChainView(props: TraceViewProps) {
  const { index, focus } = props;
  const row = useMemo(() => traceChain(index, focus)!, [index, focus]);
  const gaps = gapColumns(row);
  const record = index.byId.get(focus)!;
  const caption = `${kindLabel(index, record.kind)} · ${TRACE_COLUMNS.map((c) => `${itemsOf(row, c)} ${TRACE_COLUMN_LABELS[c].toLowerCase()}`).join(' · ')}${gaps.length > 0 ? ` · ${gaps.length} ${gaps.length === 1 ? 'gap' : 'gaps'}` : ''}`;
  const column = (c: TraceColumn): ReactNode => {
    if (itemsOf(row, c) === 0) return <p className="trace-cell-empty"><Empty row={row} column={c} /></p>;
    return (
      <ul className="trace-cards" aria-label={TRACE_COLUMN_LABELS[c]}>
        {c === 'files'
          ? row.files.map((f) => <li key={f.path}><FileRef file={f} props={props} /></li>)
          : row[c].map((id) => <li key={id}><Ref id={id} props={props} className="trace-card" /></li>)}
      </ul>
    );
  };
  return (
    <section className="trace-page" aria-label="Trace">
      <header className="trace-header">
        <p className="trace-caption" title={caption}>{caption}</p>
      </header>
      <div className="trace-scroll" role="region" tabIndex={0} aria-label="Traceability chain">
        <ol className="trace-chain">
          <li className="trace-column">
            <h3 className="trace-column-name">Obligation</h3>
            <div className="trace-card is-focus" aria-current="page">
              <small className="meta">{kindLabel(index, record.kind)}</small>
              <code>{focus}</code>
              <span className="trace-card-title">{record.title}</span>
            </div>
          </li>
          {TRACE_COLUMNS.map((c) => (
            <li key={c} className="trace-column">
              <h3 className="trace-column-name">{TRACE_COLUMN_LABELS[c]} <span className="section-count">{itemsOf(row, c)}</span></h3>
              {column(c)}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ---------- The matrix of every obligation under a record or group ----------

function TraceMatrixView(props: TraceViewProps) {
  const { index, focus } = props;
  const groups = useMemo(() => traceMatrix(index, focus), [index, focus]);
  const [gapsOnly, setGapsOnly] = useState(false);
  const [shown, setShown] = useState(TRACE_PAGE);
  const total = groups.reduce((n, g) => n + g.rows.length, 0);
  const withGaps = useMemo(() => groups.reduce((n, g) => n + g.rows.filter((r) => gapColumns(r).length > 0).length, 0), [groups]);
  // The rows the filter keeps, then the first `shown` of them, each group with its heading.
  const visible = useMemo(() => {
    let left = shown;
    const out: typeof groups = [];
    for (const g of groups) {
      if (left <= 0) break;
      const rows = (gapsOnly ? g.rows.filter((r) => gapColumns(r).length > 0) : g.rows).slice(0, left);
      if (rows.length === 0) continue;
      out.push({ parent: g.parent, rows });
      left -= rows.length;
    }
    return out;
  }, [groups, gapsOnly, shown]);
  const matching = gapsOnly ? withGaps : total;
  const drawn = visible.reduce((n, g) => n + g.rows.length, 0);
  const name = index.byId.get(focus)?.title ?? (isGroup(index, focus) ? groupName(index, focus) : focus);
  if (total === 0) return <p className="hint trace-none">Nothing under this page owes a design, a build or a test.</p>;
  const caption = `${total} ${total === 1 ? 'obligation' : 'obligations'} · ${withGaps} with gaps`;
  return (
    <section className="trace-page" aria-label="Trace">
      <header className="trace-header">
        <p className="trace-caption" title={caption}>{caption}</p>
        <label className="trace-filter">
          <input type="checkbox" checked={gapsOnly} onChange={(e) => { setGapsOnly(e.target.checked); setShown(TRACE_PAGE); }} />
          Gaps only
        </label>
      </header>
      <div className="trace-scroll" role="region" tabIndex={0} aria-label="Traceability matrix">
        {matching === 0 ? <p className="hint trace-none">No gaps: every obligation here is designed, built, tested and named in a file.</p> : (
          <table className="data-table trace-matrix">
            <caption className="sr-only">Traceability matrix of {name}</caption>
            <thead>
              <tr>
                <th scope="col">Obligation</th>
                {TRACE_COLUMNS.map((c) => <th key={c} scope="col">{TRACE_COLUMN_LABELS[c]}</th>)}
              </tr>
            </thead>
            {visible.map((g) => (
              <tbody key={g.parent?.id ?? ''}>
                <tr className="group-row">
                  <th scope="colgroup" colSpan={TRACE_COLUMNS.length + 1}>
                    {g.parent ? <Ref id={g.parent.id} props={props} className="trace-ref trace-parent" /> : 'No parent'}
                  </th>
                </tr>
                {g.rows.map((row) => (
                  <tr key={row.obligation} className={gapColumns(row).length > 0 ? 'has-gap' : undefined}>
                    <th scope="row"><Ref id={row.obligation} props={props} compact /> <span className="trace-row-title">{index.byId.get(row.obligation)?.title}</span></th>
                    {TRACE_COLUMNS.map((c) => (
                      <td key={c} className={itemsOf(row, c) === 0 && !row.notOwed.has(c) ? 'is-gap' : undefined}>
                        {itemsOf(row, c) === 0 ? <Empty row={row} column={c} /> : (
                          <span className="trace-refs">
                            {c === 'files'
                              ? row.files.map((f) => <FileRef key={f.path} file={f} props={props} compact />)
                              : row[c].map((id) => <Ref key={id} id={id} props={props} compact />)}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        )}
        {drawn < matching && (
          <p className="trace-more">
            <Button onClick={() => setShown((n) => n + TRACE_PAGE)}>Show {Math.min(TRACE_PAGE, matching - drawn)} more</Button>
            <span className="hint"> {drawn} of {matching} shown</span>
          </p>
        )}
      </div>
    </section>
  );
}
