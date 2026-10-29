// The Trace stage of an address, /<id>?stage=trace (LA-TRC-UC10, LA-V98).
import { lazy, Suspense, useLayoutEffect, useMemo, useState, type FocusEvent, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import { Button } from '../components/Button';
import { mapRootOf } from '../graph/map';
import { groupName, isGroup } from '../graph/model';
import { kindLabel, type SpecIndex } from '../specs/data';
import { TRACE_COLUMN_LABELS, TRACE_COLUMNS, traceChain, traceShape, untracedUnder, type GapColumn, type TraceColumn, type TraceFile, type TraceGroup, type TraceRow } from './chain';
import { plural } from '../plural';
import { Card, CardGrid } from '../shell/Card';
import { useNarrow } from '../shell/useNarrow';
import type { OpenSpaceStore } from '../views/openSpace';
import { traceMap } from './lanes';
import { useStepWalk } from '../graph/steps';

// What the product owes and how far it has come, drawn on the canvas with the graph's renderer
// (TraceCanvas.tsx) as one map per product (lanes.ts, LA-PAT-APP-UX-R19): a "why" tree on the left
// and one lane per obligation on the right, gaps as dashed empty boxes and the Untraced records in a
// lane of their own. Focusing anything moves the camera to frame it and fades the rest; Gaps only
// fades the complete lanes; the map never changes with either. It works on every focus
// (LA-PAT-APP-UX-R17), and the stage stays mounted while the focus moves within its product.
//
// The table is its accessible layer and its phone form, listing what is under the focus, the way the
// graph keeps a layer of its boxes for the keyboard and assistive technology: on a wide screen it is
// visually hidden under the canvas, its links carrying keyboard focus (the canvas rings the box a focused link stands for and
// brings it into view) and the arrow keys walking it; on a phone it is the stage. By the shape
// chain.ts's traceShape gives the focus:
// - an obligation: its chain, each column a list of cards;
// - a record or group with obligations under it: a traceability matrix, one row per obligation
//   grouped by its parent, each gap coverage reports visible in its cell, and under it the Untraced
//   section (the records under the focus coverage reports untraced);
// - a design, build or test record a chain holds: the rows it belongs to, the record marked;
// - a record nothing traces to: the untraced state, with the matrix of the nearest container with
//   obligations below it, the record marked; any other record: that container's matrix, marked.
// Every cell shows each record's ID and title and links to it; a file links to the record that
// names it. Long matrices show a page of rows at a time. It never reads the address. Its tools (the
// "Gaps only" filter, a note on why it shows what it shows, Show more) float at the top of the open
// space (openSpace.ts); what it holds is told to the header strip.

const TraceCanvas = lazy(() => import('./TraceCanvas').then((m) => ({ default: m.TraceCanvas })));

export interface TraceViewProps {
  index: SpecIndex;
  focus: string;
  onNavigate: (id: string) => void;
  hrefFor: (id: string) => string;
  /** Called with the record under the pointer or keyboard focus, for the chat's app_focus. */
  onPeek?: (kind: 'hover' | 'selected', id: string | null) => void;
  /** Called with what the trace holds, for the header strip: "12 obligations · 3 with gaps · 4 untraced". */
  onCounts?: (counts: string) => void;
  /** The open space the host's floating panels leave over the stage, where the canvas frames the focus. */
  space?: OpenSpaceStore;
}

/** How many matrix rows show before "Show more". */
export const TRACE_PAGE = 100;

/** A gap coverage reports, in words, by its column. */
const MISSING: Record<GapColumn, string> = { design: 'Not designed', build: 'Not built', tests: 'Not proved' };

/** Whether coverage reports a gap in a row's column. */
const isGap = (row: TraceRow, column: TraceColumn) => (row.gaps as readonly TraceColumn[]).includes(column);

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The items of one column of a row. */
const itemsOf = (row: TraceRow, column: TraceColumn): number => (column === 'files' ? row.files.length : row[column].length);

/** What a matrix shows, from the focus's shape: its groups, its label, its Untraced section's owner, its caption and its note. */
interface MatrixSpec { groups: TraceGroup[]; label: string; untracedOf?: string; caption?: string; lead?: ReactNode }

function matrixSpec(index: SpecIndex, focus: string): MatrixSpec | null {
  const shape = traceShape(index, focus);
  const nameOf = (id: string) => index.byId.get(id)?.title ?? (isGroup(index, id) ? groupName(index, id) : id);
  const name = nameOf(focus);
  switch (shape.shape) {
    case 'chain': return null;
    case 'matrix': return { groups: shape.groups, untracedOf: focus, label: `Traceability matrix of ${name}` };
    case 'rows': {
      const n = shape.groups.reduce((s, g) => s + g.rows.length, 0);
      return {
        groups: shape.groups,
        label: `The obligations whose chains hold ${name}`,
        caption: `${count(n, 'obligation')} ${n === 1 ? 'holds' : 'hold'} this record`,
        lead: <p className="trace-note">Each requirement or rule whose chain holds this record, the record marked.</p>,
      };
    }
    case 'context': {
      const scopeName = shape.scope ? nameOf(shape.scope) : '';
      return {
        groups: shape.groups,
        untracedOf: shape.scope ?? undefined,
        label: shape.scope ? `Traceability matrix of ${scopeName}` : `Trace of ${name}`,
        caption: shape.untraced ? 'Untraced' : shape.scope ? `Outside the chains · matrix of ${scopeName}` : 'Outside the chains',
        lead: (
          <p className={`trace-note${shape.untraced ? ' is-untraced' : ''}`}>
            {shape.untraced ? 'Nothing traces to this record: it serves no requirement or rule.' : 'This record sits outside every chain: no requirement or rule names it.'}
            {shape.scope && <> Around it, the trace of <strong>{scopeName}</strong>.</>}
          </p>
        ),
      };
    }
  }
}

/** A page of a matrix: the rows the filter keeps, then the first `shown` of them, each group with its heading. */
interface MatrixPage { visible: TraceGroup[]; matching: number; drawn: number; withGaps: number }

function pageOf(groups: readonly TraceGroup[], gapsOnly: boolean, shown: number): MatrixPage {
  let left = shown;
  const visible: TraceGroup[] = [];
  let matching = 0;
  let withGaps = 0;
  for (const g of groups) {
    const gapped = g.rows.filter((r) => r.gaps.length > 0);
    withGaps += gapped.length;
    const kept = gapsOnly ? gapped : g.rows;
    matching += kept.length;
    if (left <= 0) continue;
    const rows = kept.slice(0, left);
    if (rows.length === 0) continue;
    visible.push({ parent: g.parent, rows });
    left -= rows.length;
  }
  return { visible, matching, drawn: visible.reduce((n, g) => n + g.rows.length, 0), withGaps };
}

/** The record and lane a link in the table stands for: its `data-trace-id`, and its row's `data-trace-lane` (the focus, in a chain). */
function linkTarget(el: Element | null, focus: string): { id: string; lane: string | null } | null {
  const link = el?.closest<HTMLElement>('[data-trace-id]');
  if (!link) return null;
  const lane = link.closest<HTMLElement>('[data-trace-lane]')?.dataset.traceLane ?? (link.closest('.trace-chain') ? focus : null);
  return { id: link.dataset.traceId!, lane };
}

/**
 * The arrow keys in the table: Left and Right to the link before or after, Up and Down to the same cell of the row
 * above or below (outside the table's rows, to the link before or after).
 */
function walk(e: KeyboardEvent<HTMLElement>) {
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
  const from = (e.target as HTMLElement).closest?.<HTMLElement>('a[data-trace-id]');
  if (!from) return;
  const links = [...e.currentTarget.querySelectorAll<HTMLElement>('a[data-trace-id]')];
  const row = from.closest('tr');
  let to: HTMLElement | null | undefined;
  if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && row) {
    const column = [...row.children].indexOf(from.closest('td, th')!);
    const rows = [...row.closest('table')!.querySelectorAll('tr')].filter((r) => r.querySelector('a[data-trace-id]'));
    const next = rows[rows.indexOf(row) + (e.key === 'ArrowDown' ? 1 : -1)];
    if (next) to = next.children[Math.min(column, next.children.length - 1)]?.querySelector<HTMLElement>('a[data-trace-id]') ?? next.querySelector<HTMLElement>('a[data-trace-id]');
  } else {
    to = links[links.indexOf(from) + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1)];
  }
  e.preventDefault();
  to?.focus();
}

/** The Trace stage: one per product, so moving the focus within it keeps its map, its camera and its filter. */
export function TraceView(props: TraceViewProps) {
  const product = mapRootOf(props.index, props.focus);
  return <TraceStage key={product} {...props} product={product} />;
}

function TraceStage(props: TraceViewProps & { product: string }) {
  const { index, focus, onCounts, product } = props;
  const narrow = useNarrow();
  const spec = useMemo(() => matrixSpec(index, focus), [index, focus]);
  const [gapsOnly, setGapsOnly] = useState(false);
  // The table's page and the keyboard's ring are the focus's: a new focus starts them again.
  const [paging, setPaging] = useState({ focus, shown: TRACE_PAGE });
  const shown = paging.focus === focus ? paging.shown : TRACE_PAGE;
  const page = useMemo(() => (spec ? pageOf(spec.groups, gapsOnly, shown) : null), [spec, gapsOnly, shown]);
  // The product's one map: laid out once per product and data change, whatever the focus or the filter.
  const map = useMemo(() => (narrow ? null : traceMap(index, product)), [narrow, index, product]);
  const [ringAt, setRing] = useState<{ focus: string; at: { id: string; lane: string | null } | null }>({ focus, at: null });
  const ring = ringAt.focus === focus ? ringAt.at : null;
  // The plain arrows step the focus through the tree from anywhere, by the Tree view's keys (LA-V93-R19): the lanes, like
  // the Tree, run from a record to what serves it, left to right; the camera follows the focus on the one map. The table
  // under the canvas keeps its own arrows (walk).
  useStepWalk(index, focus, 'tree', props.onNavigate);

  // What the header strip says.
  const untraced = useMemo(() => (spec?.untracedOf ? untracedUnder(index, spec.untracedOf) : []), [index, spec]);
  const untracedCount = untraced.reduce((n, g) => n + g.ids.length, 0);
  const total = spec ? spec.groups.reduce((n, g) => n + g.rows.length, 0) : 0;
  const caption = useMemo(() => {
    if (!spec) {
      const row = traceChain(index, focus)!;
      const gaps = row.gaps;
      return `${kindLabel(index, index.byId.get(focus)!.kind)} · ${TRACE_COLUMNS.map((c) => `${itemsOf(row, c)} ${TRACE_COLUMN_LABELS[c].toLowerCase()}`).join(' · ')}${gaps.length > 0 ? ` · ${count(gaps.length, 'gap')}` : ''}`;
    }
    return spec.caption ?? `${count(total, 'obligation')} · ${page!.withGaps} with gaps · ${untracedCount} untraced`;
  }, [spec, index, focus, total, page, untracedCount]);
  useLayoutEffect(() => { onCounts?.(caption); }, [caption, onCounts]);

  const drawn = !narrow && map !== null;
  // Show more pages the table. Under the canvas, which draws every lane, it is for the keyboard alone: hidden until focused.
  const more = page && page.drawn < page.matching ? (
    <p className={`trace-more${drawn ? ' is-keys' : ''}`}>
      <Button onClick={() => setPaging({ focus, shown: shown + TRACE_PAGE })}>Show {Math.min(TRACE_PAGE, page.matching - page.drawn)} more</Button>
      <span className="hint"> {page.drawn} of {page.matching} shown</span>
    </p>
  ) : null;
  const filter = total > 0 || (drawn && map.counts.obligations > 0) ? (
    <label className="trace-filter">
      <input type="checkbox" checked={gapsOnly} onChange={(e) => { setGapsOnly(e.target.checked); setPaging({ focus, shown: TRACE_PAGE }); }} />
      Gaps only
    </label>
  ) : null;
  const table = spec && page
    ? <TraceMatrix {...props} spec={spec} page={page} untraced={untraced} access={drawn} more={drawn ? null : more} />
    : <TraceChainCards {...props} access={drawn} />;

  if (!drawn) {
    return (
      <section className="trace-page" aria-label="Trace" {...peekHandlers(props)}>
        {filter && <div className="trace-tools stage-tools" data-stage-tools="top">{filter}</div>}
        {table}
      </section>
    );
  }
  const onFocus = (e: FocusEvent<HTMLElement>) => setRing({ focus, at: linkTarget(e.target as Element, focus) });
  const onBlur = (e: FocusEvent<HTMLElement>) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setRing({ focus, at: null }); };
  return (
    <section className="trace-page is-drawn" aria-label="Trace" {...peekHandlers(props)}>
      {(filter || spec?.lead || more) && (
        <div className="trace-tools stage-tools" data-stage-tools="top">
          {filter}
          {spec?.lead}
          {more}
        </div>
      )}
      <Suspense fallback={<div className="graph-flow trace-flow" aria-busy="true" />}>
        <TraceCanvas index={index} focus={focus} map={map} gapsOnly={gapsOnly} onNavigate={props.onNavigate} onPeek={props.onPeek} space={props.space} ring={ring} />
      </Suspense>
      <div className="trace-access" data-arrows="own" onFocus={onFocus} onBlur={onBlur} onKeyDown={walk}>
        {table}
      </div>
    </section>
  );
}

/**
 * A link to a record: a real address for new tabs, onNavigate on a plain click. Its `data-trace-id` lets the
 * view's one set of listeners (peekHandlers) tell the page what is under the pointer, so a matrix of
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

/** The view's listeners that tell the page which record the pointer or keyboard focus is on. */
function peekHandlers(props: TraceViewProps) {
  const peek = (id: string | null) => props.onPeek?.('hover', id);
  return {
    onPointerOver: (e: PointerEvent) => { const id = tracedAt(e.target); if (id) peek(id); },
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

/** What an empty cell says: the gap coverage reports there, or that nothing is owed or listed. */
function Empty({ row, column }: { row: TraceRow; column: TraceColumn }) {
  if (column !== 'files' && isGap(row, column)) return <span className="trace-missing">{MISSING[column]}</span>;
  return <span className="trace-not-owed">{row.proofOnly && column !== 'tests' && column !== 'files' ? 'Proved only' : 'None'}</span>;
}

/** A gap in a cell that holds records: a test that does not count as proof yet, a technical record whose file is missing. */
function GapNote({ row, column }: { row: TraceRow; column: TraceColumn }) {
  return column !== 'files' && isGap(row, column) ? <span className="trace-missing">{MISSING[column]}</span> : null;
}

// ---------- One obligation's chain ----------

/** The scrolling region the table sits in: a focus stop on a phone, where it scrolls; only a landmark under the canvas. */
function Region({ label, access, children }: { label: string; access: boolean; children: ReactNode }) {
  return <div className="trace-scroll" role="region" tabIndex={access ? undefined : 0} aria-label={label}>{children}</div>;
}

function TraceChainCards(props: TraceViewProps & { access: boolean }) {
  const { index, focus, access } = props;
  const row = useMemo(() => traceChain(index, focus)!, [index, focus]);
  const column = (c: TraceColumn): ReactNode => {
    if (itemsOf(row, c) === 0) return <p className="trace-cell-empty"><Empty row={row} column={c} /></p>;
    return (
      <>
      {isGap(row, c) && <p className="trace-cell-empty"><GapNote row={row} column={c} /></p>}
      <CardGrid stack label={TRACE_COLUMN_LABELS[c]}>
        {c === 'files'
          ? row.files.map((f) => <FileCard key={f.path} file={f} props={props} />)
          : row[c].map((id) => <RecordCard key={id} id={id} props={props} />)}
      </CardGrid>
      </>
    );
  };
  return (
    <Region label="Traceability chain" access={access}>
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
    </Region>
  );
}

// ---------- A matrix: of the obligations under a record or group, of the rows holding a record, or around it ----------

interface MatrixProps extends TraceViewProps {
  spec: MatrixSpec;
  page: MatrixPage;
  untraced: { kind: string; ids: string[] }[];
  /** Under the canvas: no focus stop of its own, and its note and paging float with the stage's tools instead. */
  access: boolean;
  more: ReactNode;
}

function TraceMatrix(props: MatrixProps) {
  const { index, spec, page, untraced, access, more } = props;
  const { label, untracedOf, lead } = spec;
  const total = spec.groups.reduce((n, g) => n + g.rows.length, 0);
  const untracedCount = untraced.reduce((n, g) => n + g.ids.length, 0);
  return (
    <Region label={label} access={access}>
      {access ? null : lead}
      {total === 0 ? null : page.matching === 0 ? <p className="hint trace-none">No gaps: every obligation here is designed, built and proved.</p> : (
        <table className="data-table trace-matrix">
          <caption className="sr-only">{label}</caption>
          <thead>
            <tr>
              <th scope="col">Obligation</th>
              {TRACE_COLUMNS.map((c) => <th key={c} scope="col">{TRACE_COLUMN_LABELS[c]}</th>)}
            </tr>
          </thead>
          {page.visible.map((g) => (
            <tbody key={g.parent?.id ?? ''}>
              <tr className="group-row">
                <th scope="colgroup" colSpan={TRACE_COLUMNS.length + 1}>
                  {g.parent ? <Ref id={g.parent.id} props={props} className="trace-ref trace-parent" /> : 'No parent'}
                </th>
              </tr>
              {g.rows.map((row) => (
                <tr key={row.obligation} className={row.gaps.length > 0 ? 'has-gap' : undefined} data-trace-lane={row.obligation}>
                  <th scope="row"><Ref id={row.obligation} props={props} /></th>
                  {TRACE_COLUMNS.map((c) => (
                    <td key={c} className={isGap(row, c) ? 'is-gap' : undefined}>
                      {itemsOf(row, c) === 0 ? <Empty row={row} column={c} /> : (
                        <span className="trace-refs">
                          {c === 'files'
                            ? row.files.map((f) => <FileRef key={f.path} file={f} props={props} />)
                            : row[c].map((id) => <Ref key={id} id={id} props={props} />)}
                          <GapNote row={row} column={c} />
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
      {more}
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
    </Region>
  );
}
