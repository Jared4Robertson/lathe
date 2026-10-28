// The Trace stage of an address, /<id>?stage=trace (LA-TRC-UC10).
import { useLayoutEffect, useMemo, useState, type FocusEvent, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import { Button } from '../components/Button';
import { groupName, isGroup } from '../graph/model';
import { kindLabel, type SpecIndex } from '../specs/data';
import { gapColumns, TRACE_COLUMN_LABELS, TRACE_COLUMNS, traceChain, traceShape, untracedUnder, type TraceColumn, type TraceFile, type TraceGroup, type TraceRow } from './chain';
import { plural } from '../plural';
import { Card, CardGrid } from '../shell/Card';

// What the focus owes and how far it has come, as columns left to right: obligation, design, build,
// tests, files (chain.ts). It works on every focus (LA-PAT-APP-UX-R16), by the shape chain.ts's
// traceShape gives it:
// - an obligation: its chain, each column a list of cards;
// - a record or group with obligations under it: a traceability matrix, one row per obligation
//   grouped by its parent, each empty cell a visible gap, with a "Gaps only" filter, and under it the
//   Untraced section (the design, build and test records under the focus no chain reaches);
// - a design, build or test record a chain holds: the rows it belongs to, the record marked;
// - a record nothing traces to: the untraced state, with the matrix of the nearest container with
//   obligations below it, the record marked; any other record: that container's matrix, marked.
// Every cell shows each record's ID and title and links to it; a file links to the record that
// names it. Long matrices show a page of rows at a time, so a product's stays fast. It never reads
// the address. It scrolls under the floating panels, its content padded to the open space
// (openSpace.ts); what it holds is told to the header strip, and the "Gaps only" filter floats at
// the top of the open space.

export interface TraceViewProps {
  index: SpecIndex;
  focus: string;
  onNavigate: (id: string) => void;
  hrefFor: (id: string) => string;
  /** Called with the record under the pointer or keyboard focus, for the side bar's Details. */
  onPeek?: (kind: 'hover' | 'selected', id: string | null) => void;
  /** Called with what the trace holds, for the header strip: "12 obligations · 3 with gaps · 4 untraced". */
  onCounts?: (counts: string) => void;
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

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function TraceView(props: TraceViewProps) {
  const { index, focus } = props;
  const shape = useMemo(() => traceShape(index, focus), [index, focus]);
  const nameOf = (id: string) => index.byId.get(id)?.title ?? (isGroup(index, id) ? groupName(index, id) : id);
  const name = nameOf(focus);
  switch (shape.shape) {
    case 'chain': return <TraceChainView key={focus} {...props} />;
    case 'matrix':
      return <TraceMatrixView key={focus} {...props} groups={shape.groups} untracedOf={focus} label={`Traceability matrix of ${name}`} />;
    case 'rows': {
      const n = shape.groups.reduce((s, g) => s + g.rows.length, 0);
      return (
        <TraceMatrixView
          key={focus}
          {...props}
          groups={shape.groups}
          label={`The obligations whose chains hold ${name}`}
          caption={`${count(n, 'obligation')} ${n === 1 ? 'holds' : 'hold'} this record`}
          lead={<p className="trace-note">The rows this record belongs to: each requirement or rule whose chain holds it, the record marked in its cell.</p>}
        />
      );
    }
    case 'context': {
      const scopeName = shape.scope ? nameOf(shape.scope) : '';
      const lead = (
        <p className={`trace-note${shape.untraced ? ' is-untraced' : ''}`}>
          {shape.untraced ? 'Nothing traces to this record: it serves no requirement or rule.' : 'This record sits outside every chain: no requirement or rule names it.'}
          {shape.scope && <> Below, the matrix of <strong>{scopeName}</strong>, around it.</>}
        </p>
      );
      return (
        <TraceMatrixView
          key={focus}
          {...props}
          groups={shape.groups}
          untracedOf={shape.scope ?? undefined}
          label={shape.scope ? `Traceability matrix of ${scopeName}` : `Trace of ${name}`}
          caption={shape.untraced ? 'Untraced' : shape.scope ? `Outside the chains · matrix of ${scopeName}` : 'Outside the chains'}
          lead={lead}
        />
      );
    }
  }
}

/**
 * A link to a record: a real address for new tabs, onNavigate on a plain click. Its `data-trace-id` lets the
 * view's one set of listeners (peekHandlers) tell the side bar what is under the pointer, so a matrix of
 * many links draws no listeners of its own. The focus itself is marked as the current page.
 */
function TraceLink({ id, props, title, className, children }: { id: string; props: TraceViewProps; title: string; className: string; children: ReactNode }) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    props.onNavigate(id);
  };
  const current = id === props.focus;
  return (
    <a href={props.hrefFor(id)} onClick={onClick} title={title} className={`${className}${current ? ' is-focus' : ''}`} aria-current={current ? 'page' : undefined} data-trace-id={id}>
      {children}
    </a>
  );
}

/** The record a pointer or focus event is on, by its link's `data-trace-id`. */
const tracedAt = (target: EventTarget | null) => (target instanceof Element ? target.closest<HTMLElement>('[data-trace-id]')?.dataset.traceId ?? null : null);

/** The view's listeners that tell the side bar which record the pointer or keyboard focus is on. */
function peekHandlers(props: TraceViewProps) {
  const peek = (id: string | null) => props.onPeek?.('hover', id);
  return {
    onPointerOver: (e: PointerEvent) => peek(tracedAt(e.target)),
    onPointerLeave: () => peek(null),
    onFocus: (e: FocusEvent) => peek(tracedAt(e.target)),
    onBlur: () => peek(null),
  };
}

/** A link to a record in a matrix cell: its ID, which never wraps, and its title, cut with an ellipsis (whole in its tooltip). */
function Ref({ id, props, className = 'trace-ref' }: { id: string; props: TraceViewProps; className?: string }) {
  const record = props.index.byId.get(id);
  return (
    <TraceLink id={id} props={props} title={record ? `${record.title} (${id})` : id} className={className}>
      <code className="trace-id">{id}</code>
      {record && <span className="trace-title">{record.title}</span>}
    </TraceLink>
  );
}

/** A record's card in a chain's column: its kind, ID and title; anywhere on it opens the record. */
function RecordCard({ id, props, current = false }: { id: string; props: TraceViewProps; current?: boolean }) {
  const record = props.index.byId.get(id);
  return (
    <Card
      look="compact"
      href={props.hrefFor(id)}
      onFollow={() => props.onNavigate(id)}
      current={current}
      hint={record ? `${record.title} (${id})` : id}
      data={{ 'data-trace-id': id }}
      title={<><small className="meta">{record ? kindLabel(props.index, record.kind) : ''}</small><code className="trace-id">{id}</code><span className="trace-ref-title">{record?.title ?? ''}</span></>}
    />
  );
}

/** A file, linked to the first record that names it. */
function FileRef({ file, props }: { file: TraceFile; props: TraceViewProps }) {
  const title = `${file.path}, named by ${file.namedBy.join(', ')}`;
  return <TraceLink id={file.namedBy[0]} props={props} title={title} className="trace-ref trace-file"><code className="trace-id">{file.path}</code></TraceLink>;
}

/** A file's card in a chain's column, opening the first record that names it. */
function FileCard({ file, props }: { file: TraceFile; props: TraceViewProps }) {
  const id = file.namedBy[0];
  return (
    <Card
      look="compact"
      href={props.hrefFor(id)}
      onFollow={() => props.onNavigate(id)}
      hint={`${file.path}, named by ${file.namedBy.join(', ')}`}
      data={{ 'data-trace-id': id }}
      title={<><code className="trace-file">{file.path}</code><small className="meta">Named by {file.namedBy.join(', ')}</small></>}
    />
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
  const { index, focus, onCounts } = props;
  const row = useMemo(() => traceChain(index, focus)!, [index, focus]);
  const gaps = gapColumns(row);
  const record = index.byId.get(focus)!;
  const caption = `${kindLabel(index, record.kind)} · ${TRACE_COLUMNS.map((c) => `${itemsOf(row, c)} ${TRACE_COLUMN_LABELS[c].toLowerCase()}`).join(' · ')}${gaps.length > 0 ? ` · ${count(gaps.length, 'gap')}` : ''}`;
  useLayoutEffect(() => { onCounts?.(caption); }, [caption, onCounts]);
  const column = (c: TraceColumn): ReactNode => {
    if (itemsOf(row, c) === 0) return <p className="trace-cell-empty"><Empty row={row} column={c} /></p>;
    return (
      <CardGrid stack label={TRACE_COLUMN_LABELS[c]}>
        {c === 'files'
          ? row.files.map((f) => <FileCard key={f.path} file={f} props={props} />)
          : row[c].map((id) => <RecordCard key={id} id={id} props={props} />)}
      </CardGrid>
    );
  };
  return (
    <section className="trace-page" aria-label="Trace" {...peekHandlers(props)}>
      <div className="trace-scroll" role="region" tabIndex={0} aria-label="Traceability chain">
        <ol className="trace-chain">
          <li className="trace-column">
            <h3 className="trace-column-name">Obligation</h3>
            <CardGrid stack label="Obligation"><RecordCard id={focus} props={props} current /></CardGrid>
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

// ---------- A matrix: of the obligations under a record or group, of the rows holding a record, or around it ----------

interface MatrixProps extends TraceViewProps {
  groups: TraceGroup[];
  /** The table's accessible name. */
  label: string;
  /** Whose Untraced section shows under the matrix; none when absent. */
  untracedOf?: string;
  /** What the header strip says, when not the matrix's own counts. */
  caption?: string;
  /** A note above the matrix: why it shows what it shows. */
  lead?: ReactNode;
}

function TraceMatrixView(props: MatrixProps) {
  const { index, groups, label, untracedOf, caption: given, lead, onCounts } = props;
  const untraced = useMemo(() => (untracedOf ? untracedUnder(index, untracedOf) : []), [index, untracedOf]);
  const untracedCount = untraced.reduce((n, g) => n + g.ids.length, 0);
  const [gapsOnly, setGapsOnly] = useState(false);
  const [shown, setShown] = useState(TRACE_PAGE);
  const total = groups.reduce((n, g) => n + g.rows.length, 0);
  const withGaps = useMemo(() => groups.reduce((n, g) => n + g.rows.filter((r) => gapColumns(r).length > 0).length, 0), [groups]);
  // The rows the filter keeps, then the first `shown` of them, each group with its heading.
  const visible = useMemo(() => {
    let left = shown;
    const out: TraceGroup[] = [];
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
  const caption = given ?? `${count(total, 'obligation')} · ${withGaps} with gaps · ${untracedCount} untraced`;
  useLayoutEffect(() => { onCounts?.(caption); }, [caption, onCounts]);
  return (
    <section className="trace-page" aria-label="Trace" {...peekHandlers(props)}>
      {total > 0 && (
        <div className="trace-tools stage-tools" data-stage-tools="top">
          <label className="trace-filter">
            <input type="checkbox" checked={gapsOnly} onChange={(e) => { setGapsOnly(e.target.checked); setShown(TRACE_PAGE); }} />
            Gaps only
          </label>
        </div>
      )}
      <div className="trace-scroll" role="region" tabIndex={0} aria-label={label}>
        {lead}
        {total === 0 ? null : matching === 0 ? <p className="hint trace-none">No gaps: every obligation here is designed, built, tested and named in a file.</p> : (
          <table className="data-table trace-matrix">
            <caption className="sr-only">{label}</caption>
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
                    <th scope="row"><Ref id={row.obligation} props={props} /></th>
                    {TRACE_COLUMNS.map((c) => (
                      <td key={c} className={itemsOf(row, c) === 0 && !row.notOwed.has(c) ? 'is-gap' : undefined}>
                        {itemsOf(row, c) === 0 ? <Empty row={row} column={c} /> : (
                          <span className="trace-refs">
                            {c === 'files'
                              ? row.files.map((f) => <FileRef key={f.path} file={f} props={props} />)
                              : row[c].map((id) => <Ref key={id} id={id} props={props} />)}
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
        {untracedOf && (
          <section className="trace-untraced" aria-labelledby="trace-untraced">
            <h3 id="trace-untraced">Untraced <span className="section-count">{untracedCount}</span></h3>
            {untracedCount === 0 ? <p className="hint">Everything here serves a requirement or rule.</p> : (
              <dl className="trace-untraced-kinds">
                {untraced.map((g) => (
                  <div key={g.kind}>
                    <dt>{plural(kindLabel(index, g.kind))} <span className="section-count">{g.ids.length}</span></dt>
                    <dd><span className="trace-refs">{g.ids.map((id) => <Ref key={id} id={id} props={props} />)}</span></dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        )}
      </div>
    </section>
  );
}
