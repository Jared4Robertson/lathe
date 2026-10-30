// The Trace stage of an address, /<id>?stage=trace (LA-TRC-UC10, LA-V98).
import { lazy, Suspense, useCallback, useLayoutEffect, useMemo, useState, type FocusEvent, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import type { ProductTraces } from '../../../lathe/src/traceability/trace/read-model';
import { Button } from '../components/Button';
import { mapRootOf } from '../graph/map';
import { groupName, isGroup } from '../graph/model';
import { kindLabel, type RecordIndex } from '../exploring/record-summaries/record-index';
import { TRACE_COLUMN_LABELS, TRACE_COLUMNS, traceChain, traceShape, untracedUnder, type GapColumn, type TraceColumn, type TraceFile, type TraceGroup, type TraceRow } from './chain';
import { plural } from '../plural';
import { Card, CardGrid } from '../shell/Card';
import { useNarrow } from '../shell/useNarrow';
import type { OpenSpaceStore } from '../views/openSpace';
import { useCommand, useStageWalk } from '../shell/commands';
import { Tooltip } from '../shell/Tooltip';
import type { Move } from '../views/levels';
import { StageKey, StageToolbar, TidyUp } from '../views/StageChrome';
import { allKeyEntries } from './TraceKey';
import { AllList } from './AllList';
import { allGraph } from './all';
import { shownLayout } from './all-laid';
import { ALL_WALK_LABELS, allTarget, allWords } from './all-walk';
import { TRACE_PAGE, TRACE_VIEWS, type TraceViewName } from './views';
import { useChangesKey } from '../changes/ChangesKey';
import { useTraces } from '../traceability/trace/reads';
import { readState } from '../record/page-parts';

// What the product owes and how far it has come. Its toolbar switches, per place, between two views (views.ts):
// - All at once (TraceAll.tsx, all.ts): the product's whole trace in five fixed columns, Outcomes, Use cases,
//   Obligations, Built by and Proved by, each record once with a line for each link between them; focusing a record
//   lights its whole path and fades the rest, Gaps only keeps the obligations with a gap and their paths, and the walk
//   goes up and down a column and along the links left and right. On a phone, one column at a time (AllList.tsx).
// - Delivery (trace/delivery): one row per use case, from its outcome to its acceptance tests.
// It works on every focus (LA-PAT-APP-UX-R17), and the stage stays mounted while the focus moves within its product.
//
// The table is the canvas's accessible layer, listing what is under the focus, the way the
// graph keeps a layer of its boxes for the keyboard and assistive technology: visually hidden under the canvas, its links
// carrying keyboard focus (the canvas rings the box a focused link stands for and brings it into view) and the arrow keys
// walking it. By the shape chain.ts's traceShape gives the focus:
// - an obligation: its chain, each column a list of cards;
// - a record or group with obligations under it: a traceability matrix, one row per obligation
//   grouped by its parent, each gap coverage reports visible in its cell, and under it the Untraced
//   section (the records under the focus coverage reports untraced);
// - a design, build or test record a chain holds: the rows it belongs to, the record marked;
// - a record nothing traces to: the untraced state, with the matrix of the nearest container with
//   obligations below it, the record marked; any other record: that container's matrix, marked.
// Every cell shows each record's ID and title and links to it; a file links to the record that
// names it. Long matrices show a page of rows at a time. It never reads the address. Its toolbar is every stage's
// (views/StageChrome.tsx), floating at the top of the open space (openSpace.ts) with the view switch, its own "Gaps
// only" filter and Tidy up, and its key; what it holds is told to the header strip. Everything it draws is the Trace
// read model's (list-traces, LA-TRC-RM11): each obligation's chain, its gaps and whether only proof is asked of it, the
// untraced records and the Serves links, read again after every reload; titles and kinds are the index's.

const TraceAll = lazy(() => import('./TraceAll').then((m) => ({ default: m.TraceAll })));
const DeliveryTrace = lazy(() => import('./delivery/DeliveryTrace').then((m) => ({ default: m.DeliveryTrace })));

export interface TraceViewProps {
  index: RecordIndex;
  focus: string;
  onNavigate: (id: string) => void;
  hrefFor: (id: string) => string;
  /** Called with the record under the pointer or keyboard focus, for the chat's app_focus. */
  onPeek?: (kind: 'hover' | 'selected', id: string | null) => void;
  /** Called with what the trace holds, for the header strip: "12 obligations · 3 with gaps · 4 untraced". */
  onCounts?: (counts: string) => void;
  /** The open space the host's floating panels leave over the stage, where the canvas frames the focus. */
  space?: OpenSpaceStore;
  /** The place the Trace shows (the Tab set's cameras, exploring/tab-set): its camera is kept as the place is left and taken back as it shows again. */
  cameraKey?: string;
  /** Opens a record in a new place (Cmd or Ctrl+click, or a middle-click for the background), when the host has places. */
  onOpenNew?: (id: string, background: boolean) => void;
  /** The place's view (views.ts), and the switch's setter. */
  view: TraceViewName;
  onView: (view: TraceViewName) => void;
}

/** A gap coverage reports, in words, by its column. */
const MISSING: Record<GapColumn, string> = { design: 'Not designed', build: 'Not built', tests: 'Not proved' };

/** Whether coverage reports a gap in a row's column. */
const isGap = (row: TraceRow, column: TraceColumn) => (row.gaps as readonly TraceColumn[]).includes(column);

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The items of one column of a row. */
const itemsOf = (row: TraceRow, column: TraceColumn): number => (column === 'files' ? row.files.length : row[column].length);

/** What a matrix shows, from the focus's shape: its groups, its label, its Untraced section's owner, its caption and its note. */
interface MatrixSpec { groups: TraceGroup[]; label: string; untracedOf?: string; caption?: string; lead?: ReactNode; /** What the obligations are counted as, after their count: " under this outcome". */ under?: string; /** What comes before the counts, for a record outside the chains: "Outside the chains · Loan: ". */ before?: string }

function matrixSpec(index: RecordIndex, traces: ProductTraces, focus: string): MatrixSpec | null {
  const shape = traceShape(index, traces, focus);
  const nameOf = (id: string) => index.byId.get(id)?.title ?? (isGroup(index, id) ? groupName(index, id) : id);
  const name = nameOf(focus);
  switch (shape.shape) {
    case 'chain': return null;
    case 'matrix': {
      // An outcome's obligations sit under the capabilities serving it, not under it in the record tree: nothing is untraced under it.
      const outcome = index.byId.get(focus)?.kind === 'business_outcome';
      return { groups: shape.groups, untracedOf: outcome ? undefined : focus, label: `Traceability matrix of ${name}`, under: outcome ? ' under this outcome' : undefined };
    }
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
        // Around a record outside the chains, what the scope it sits in holds, as an outcome's or a domain's matrix says it.
        ...(shape.scope ? { before: `${shape.untraced ? 'Untraced' : 'Outside the chains'} · ${scopeName}: ` } : { caption: shape.untraced ? 'Untraced' : 'Outside the chains' }),
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

/** The record a link in the table stands for, by its `data-trace-id`, and the chain its row traces (`data-trace-chain`; the focus's, in a chain). */
function linkTarget(el: Element | null, focus: string): { id: string; chain: string | null } | null {
  const link = el?.closest<HTMLElement>('[data-trace-id]');
  if (!link) return null;
  const chain = link.closest<HTMLElement>('[data-trace-chain]')?.dataset.traceChain ?? (link.closest('.trace-chain') ? focus : null);
  return { id: link.dataset.traceId!, chain };
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
  if (props.view === 'delivery') {
    return (
      <Suspense fallback={<section className="trace-page" aria-label="Trace" aria-busy="true" />}>
        <DeliveryTrace key={product} {...props} product={product} viewSwitch={(narrow) => <ViewSwitch view={props.view} onChange={props.onView} narrow={narrow} />} />
      </Suspense>
    );
  }
  return <ProductTrace key={product} {...props} product={product} />;
}

/** A product's Trace stage once its Trace read answers for it; until then, that it is reading (or why it could not). */
function ProductTrace(props: TraceViewProps & { product: string }) {
  const { index, product } = props;
  const read = readState(index, product, useTraces(product, index), (answer) => answer.product === product, false);
  if ('shown' in read) return <section className="trace-page" aria-label="Trace">{read.shown}</section>;
  return <TraceStage {...props} traces={read.answer} />;
}

/** The props of the stage and of its table: the view's, with the product's traces as its Trace read answers them. */
type StageProps = TraceViewProps & { traces: ProductTraces };

function TraceStage(props: StageProps & { product: string }) {
  const { index, focus, onCounts, product, traces, view } = props;
  const narrow = useNarrow();
  const spec = useMemo(() => matrixSpec(index, traces, focus), [index, traces, focus]);
  const [gapsOnly, setGapsOnly] = useState(false);
  // Tidy up: each press lays the columns out afresh once (a data change keeps every box where it was, all-layout.ts).
  const [tidy, setTidy] = useState(0);
  // The table's page and the keyboard's ring are the focus's: a new focus starts them again.
  const [paging, setPaging] = useState({ focus, shown: TRACE_PAGE });
  const shown = paging.focus === focus ? paging.shown : TRACE_PAGE;
  const page = useMemo(() => (spec ? pageOf(spec.groups, gapsOnly, shown) : null), [spec, gapsOnly, shown]);
  // The product's All-at-once graph: worked out once per product and data change, whatever the focus or the filter.
  const graph = useMemo(() => allGraph(index, traces, product), [index, traces, product]);
  const [ringAt, setRing] = useState<{ focus: string; at: { id: string; chain: string | null } | null }>({ focus, at: null });
  // A gap the walk stands on, for the focus it left there: a gap is no record, so the focus stays and the ring moves.
  const [walked, setWalked] = useState<{ focus: string; key: string } | null>(null);
  const walkedKey = walked?.focus === focus && graph.nodes.has(walked.key) ? walked.key : null;
  /** The box the walk is on: a gap it stands on, else the focus's own box (none for a record the view does not draw). */
  const at = walkedKey ?? (graph.nodes.has(focus) ? focus : null);
  // The keyboard's ring: the table's focused link (its record's box), else the walk's gap.
  const linkRing = ringAt.focus === focus ? ringAt.at?.id ?? null : null;
  const ring = linkRing && graph.nodes.has(linkRing) ? linkRing : walkedKey;
  // The stage walk (all-walk.ts, LA-V61-R49): Up and Down within a column, Left and Right along the links. On a record
  // the focus moves there, as a click does, and the camera follows; on a gap the ring does. Each step is announced.
  const targetOf = useCallback((move: Move): string | null => allTarget(graph, shownLayout(product), at, move), [graph, product, at]);
  const walkMap = useCallback((move: Move) => {
    const to = targetOf(move);
    if (!to) return null;
    if (graph.nodes.get(to)!.role === 'record') { setWalked(null); if (to !== focus) props.onNavigate(to); } else setWalked({ focus, key: to });
    return allWords(index, graph, to);
  }, [targetOf, graph, focus, index, props.onNavigate]);
  useStageWalk(walkMap);

  // What the header strip says.
  const untraced = useMemo(() => (spec?.untracedOf ? untracedUnder(index, traces, spec.untracedOf) : []), [index, traces, spec]);
  const untracedCount = untraced.reduce((n, g) => n + g.ids.length, 0);
  const total = spec ? spec.groups.reduce((n, g) => n + g.rows.length, 0) : 0;
  const caption = useMemo(() => {
    if (!spec) {
      const row = traceChain(index, traces, focus)!;
      const gaps = row.gaps;
      return `${kindLabel(index, index.byId.get(focus)!.kind)} · ${TRACE_COLUMNS.map((c) => `${itemsOf(row, c)} ${TRACE_COLUMN_LABELS[c].toLowerCase()}`).join(' · ')}${gaps.length > 0 ? ` · ${count(gaps.length, 'gap')}` : ''}`;
    }
    return spec.caption ?? `${spec.before ?? ''}${count(total, 'obligation')}${spec.under ?? ''} · ${page!.withGaps} with gaps${spec.untracedOf ? ` · ${untracedCount} untraced` : ''}`;
  }, [spec, index, traces, focus, total, page, untracedCount]);
  useLayoutEffect(() => { onCounts?.(caption); }, [caption, onCounts]);

  const drawn = !narrow;
  // The key bar, while the view is drawn: what it draws, then the live marks.
  const changesKey = useChangesKey();
  const keyEntries = useMemo(() => (drawn ? [...allKeyEntries(index, graph, gapsOnly || graph.nodes.has(focus)), ...changesKey] : []), [drawn, index, graph, gapsOnly, focus, changesKey]);
  // Show more pages the table. Under the canvas, which draws every chain, it is for the keyboard alone, hidden with the table.
  const more = page && page.drawn < page.matching ? (
    <p className="trace-more">
      <Button onClick={() => setPaging({ focus, shown: shown + TRACE_PAGE })}>Show {Math.min(TRACE_PAGE, page.matching - page.drawn)} more</Button>
      <span className="hint"> {page.drawn} of {page.matching} shown</span>
    </p>
  ) : null;
  const filter = total > 0 || graph.counts.obligations > 0 ? (
    <label className="trace-filter">
      <input type="checkbox" checked={gapsOnly} onChange={(e) => { setGapsOnly(e.target.checked); setPaging({ focus, shown: TRACE_PAGE }); }} />
      Gaps only
    </label>
  ) : null;
  // Tidy up (LA-PAT-APP-UX-R22): the columns laid out afresh, by the stage's shared command and button.
  useCommand('stageTidy', () => setTidy((t) => t + 1), drawn);
  const toolbar = (
    <StageToolbar
      can={(move) => targetOf(move) !== null}
      walkLabels={ALL_WALK_LABELS}
      own={(n) => ({ primary: <><ViewSwitch view={view} onChange={props.onView} narrow={n} />{filter}{drawn && <TidyUp />}</> })}
    />
  );
  const table = spec && page
    ? <TraceMatrix {...props} spec={spec} page={page} untraced={untraced} access more={more} />
    : <TraceChainCards {...props} access />;

  if (narrow) {
    return (
      <section className="trace-page" aria-label="Trace" {...peekHandlers(props)}>
        {toolbar}
        <AllList index={index} graph={graph} focus={focus} gapsOnly={gapsOnly} hrefFor={props.hrefFor} onNavigate={props.onNavigate} />
      </section>
    );
  }
  const onFocus = (e: FocusEvent<HTMLElement>) => setRing({ focus, at: linkTarget(e.target as Element, focus) });
  const onBlur = (e: FocusEvent<HTMLElement>) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setRing({ focus, at: null }); };
  return (
    <section className="trace-page is-drawn" aria-label="Trace" {...peekHandlers(props)}>
      {toolbar}
      <StageKey entries={keyEntries} />
      <Suspense fallback={<div className="graph-flow trace-flow" aria-busy="true" />}>
        <TraceAll index={index} focus={focus} graph={graph} gapsOnly={gapsOnly} tidy={tidy} onNavigate={props.onNavigate} onPeek={props.onPeek} space={props.space} ring={ring} cameraKey={props.cameraKey} onOpenNew={props.onOpenNew} />
      </Suspense>
      <div className="trace-access" data-arrows="own" onFocus={onFocus} onBlur={onBlur} onKeyDown={walk}>
        {table}
      </div>
    </section>
  );
}

/** The All at once | Delivery switch (LA-V98), the place's own view (views.ts), each named in full in every toolbar. */
function ViewSwitch({ view, onChange, narrow }: { view: TraceViewName; onChange: (view: TraceViewName) => void; narrow: boolean }) {
  return (
    <div className={`graph-depth graph-layout trace-views${narrow ? ' is-narrow' : ''}`} role="group" aria-label="Trace view">
      {TRACE_VIEWS.map((v) => (
        <Tooltip key={v.view} label={v.tip}>
          <button type="button" aria-pressed={view === v.view} onClick={() => onChange(v.view)}>{v.label}</button>
        </Tooltip>
      ))}
    </div>
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

function TraceChainCards(props: StageProps & { access: boolean }) {
  const { index, traces, focus, access } = props;
  const row = useMemo(() => traceChain(index, traces, focus)!, [index, traces, focus]);
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

interface MatrixProps extends StageProps {
  spec: MatrixSpec;
  page: MatrixPage;
  untraced: { kind: string; ids: string[] }[];
  /** Under the canvas: no focus stop of its own. */
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
      {lead}
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
                <tr key={row.obligation} className={row.gaps.length > 0 ? 'has-gap' : undefined} data-trace-chain={row.obligation}>
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
