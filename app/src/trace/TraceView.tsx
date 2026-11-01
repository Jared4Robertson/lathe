// The Trace stage of an address, /<id>?stage=trace (LA-TRC-UC10, LA-V98): one row per use case, from the business
// outcomes it serves and the journeys carrying it out to its acceptance tests (trace.ts), read from the Trace read model (list-traced-use-cases, LA-TRC-RM13)
// again after every reload. It works on every focus (LA-PAT-APP-UX-R17), and the stage stays mounted while the focus
// moves within its product. Its toolbar is every stage's (views/StageChrome.tsx), with Expand row (the focus's row,
// every stage), Expand all (one stage, every row) and Tidy up; its key; the canvas (TraceCanvas.tsx) with its
// accessible layer under it (TraceList.tsx, visually hidden); and on a phone the list alone, one use case at a time.
// What each place opens is its own (open.ts). What it holds is told to the header strip.
import './trace.css';
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import type { ProductTrace } from '../../../lathe/src/traceability/trace/read-model';
import { Button } from '../components/Button';
import type { RecordIndex } from '../exploring/record-summaries/record-index';
import { mapRootOf } from '../graph/map';
import { readState } from '../record/page-parts';
import { useCommand, useStageWalk } from '../shell/commands';
import { Tooltip } from '../shell/Tooltip';
import { useNarrow } from '../shell/useNarrow';
import { useChangesKey } from '../changes/ChangesKey';
import { useTraceRows } from '../traceability/trace/reads';
import type { Move } from '../views/levels';
import type { OpenSpaceStore } from '../views/openSpace';
import { StageKey, StageToolbar, TidyUp } from '../views/StageChrome';
import { cellKey, TRACE_COLUMN_LABELS, TRACE_STAGES, traceGraph, everyStepKey, rowsOf, type TraceGraph, type TraceStage, type Openness } from './trace';
import { shownOrder } from './order';
import { layOutTrace, outcomesBeside } from './layout';
import { useOpenness } from './open';
import { TRACE_WALK_LABELS, traceTarget, traceWords, type Along } from './walk';
import { traceKeyEntries } from './TraceKey';
import { TraceList } from './TraceList';
import { TraceCanvas } from './TraceCanvas';

export interface TraceViewProps {
  index: RecordIndex;
  focus: string;
  onNavigate: (id: string) => void;
  hrefFor: (id: string) => string;
  onPeek?: (kind: 'hover' | 'selected', id: string | null) => void;
  /** Called with what the trace holds, for the header strip: "12 use cases · 3 with gaps · 1 serves no outcome". */
  onCounts?: (counts: string) => void;
  /** The open space the host's floating panels leave over the stage, where the canvas frames the focus. */
  space?: OpenSpaceStore;
  /** The place the Trace shows (the Tab set's cameras, exploring/tab-set): its camera and what it opens are kept as the place is left and taken back as it shows again. */
  cameraKey?: string;
  /** Opens a record in a new place (Cmd or Ctrl+click, or a middle-click for the background), when the host has places. */
  onOpenNew?: (id: string, background: boolean) => void;
}

/** The Trace stage: one per product, so moving the focus within it keeps its order, its camera and what it opens. */
export function TraceView(props: TraceViewProps) {
  const product = mapRootOf(props.index, props.focus);
  return <ProductTrace key={product} {...props} product={product} />;
}

/** A product's Trace stage once its read answers for it; until then, that it is reading (or why it could not). */
function ProductTrace(props: TraceViewProps & { product: string }) {
  const { index, product } = props;
  const read = readState(index, product, useTraceRows(product, index), (answer) => answer.product === product, false);
  if ('shown' in read) return <section className="trace-page" aria-label="Trace">{read.shown}</section>;
  return <ProductTraceStage {...props} trace={read.answer} />;
}

/** The stage names Expand all says, short for the toolbar. */
const SHORT: Record<TraceStage, string> = { 'use-case': 'Use case', design: 'Design', technical: 'Technical', suite: 'Suite' };

/** Whether every row has the stage open. */
const everyOpen = (graph: TraceGraph, open: ReadonlySet<string>, stage: TraceStage) =>
  graph.rows.length > 0 && graph.rows.every((r) => open.has(cellKey(r.useCase, stage)) && (stage !== 'technical' || open.has(everyStepKey(r.useCase))));

function ProductTraceStage(props: TraceViewProps & { product: string; trace: ProductTrace }) {
  const { index, focus, product, trace, onCounts } = props;
  const narrow = useNarrow();
  const graph = useMemo(() => traceGraph(index, trace), [index, trace]);
  const [open, setOpen] = useOpenness(props.cameraKey);
  // The step whose chain the Technical flow column shows: the last step selected. A journey step focused shows its
  // journey open, as a flow step its chain.
  const [step, setStep] = useState<string | null>(null);
  const focusKind = index.byId.get(focus)?.kind;
  const focusIsStep = focusKind === 'flow_step';
  if (focusIsStep && step !== focus) setStep(focus);
  const journey = focusKind === 'journey_step' ? graph.journeyOf.get(focus)?.id ?? null : null;
  const openness = useMemo<Openness>(() => ({ open, step: focusIsStep ? focus : step, journey }), [open, step, focus, focusIsStep, journey]);
  // Tidy up (LA-PAT-APP-UX-R22): the rows ordered afresh, gaps closed, by the stage's shared command and button.
  const [tidy, setTidy] = useState(0);
  useCommand('stageTidy', () => setTidy((t) => t + 1), !narrow);
  // The box the walk or a click stands on, for the focus it left there (a record may show in several boxes), and the
  // journey the walk is along (walk.ts), if any.
  const [walked, setWalked] = useState<{ focus: string; key: string; along: Along | null } | null>(null);
  const at = walked?.focus === focus && graph.items.has(walked.key) ? walked.key : null;
  const along = at ? walked!.along : null;
  const atItem = at ? graph.items.get(at) : undefined;
  /** The ring: the walk's box when it is no record (a status, a gap, a heading). */
  const ring = atItem && (atItem.role !== 'record' || atItem.id !== focus) ? at : null;

  const toggle = useCallback((key: string) => {
    const next = new Set(open);
    if (next.has(key)) {
      next.delete(key);
      // A Technical flow cell closed lets go of every step's chain too.
      const [row, stage] = key.split('|');
      if (stage === 'technical' && key === cellKey(row, 'technical')) next.delete(everyStepKey(row));
    } else next.add(key);
    setOpen(next);
  }, [open, setOpen]);
  const every = useMemo(() => Object.fromEntries(TRACE_STAGES.map((s) => [s, everyOpen(graph, open, s)])) as Record<TraceStage, boolean>, [graph, open]);
  const setEvery = useCallback((stage: TraceStage) => {
    const next = new Set(open);
    for (const r of graph.rows) {
      const keys = [cellKey(r.useCase, stage), ...(stage === 'technical' ? [everyStepKey(r.useCase)] : [])];
      for (const k of keys) if (every[stage]) next.delete(k); else next.add(k);
    }
    setOpen(next);
  }, [graph, open, every, setOpen]);
  // Expand row: the focus's row (or the walk's), every stage.
  const row = atItem?.row ?? rowsOf(graph, focus)[0]?.useCase ?? null;
  const rowOpen = !!row && TRACE_STAGES.every((s) => open.has(cellKey(row, s)));
  const expandRow = useCallback(() => {
    if (!row) return;
    const next = new Set(open);
    for (const s of TRACE_STAGES) if (rowOpen) { next.delete(cellKey(row, s)); if (s === 'technical') next.delete(everyStepKey(row)); } else next.add(cellKey(row, s));
    setOpen(next);
  }, [row, rowOpen, open, setOpen]);

  // The row whose outcomes slide beside it (LA-V98-R22): the focused row; on an outcome, the row it is beside while that
  // row serves it, so stepping Left onto it leaves it there; else none, and every outcome glides home.
  const [beside, setBeside] = useState<string | null>(null);
  const onOutcome = (atItem ? atItem.column === 0 : true) && graph.items.has(`outcome/${focus}`);
  const besideNow = !onOutcome ? row : beside && graph.serves.some(([o, u]) => o === focus && u === beside) ? beside : null;
  if (besideNow !== beside) setBeside(besideNow);

  // The stage walk (walk.ts, LA-V61-R49): on a record the focus moves there, as a click does, and the camera
  // follows; on another box the ring does. In and Out open and close on the way. Each step is announced.
  const laidNow = useCallback(() => { const order = shownOrder(product); return order ? outcomesBeside(layOutTrace(graph, order, openness), graph.serves, besideNow) : null; }, [product, graph, openness, besideNow]);
  const fromBox = at ?? graph.boxesOf.get(focus)?.[0] ?? (graph.items.has(`outcome/${focus}`) ? `outcome/${focus}` : null);
  const targetOf = useCallback((move: Move) => { const laid = laidNow(); return laid ? traceTarget(graph, laid, openness, fromBox, move, along) : null; }, [laidNow, graph, openness, fromBox, along]);
  const walkMap = useCallback((move: Move) => {
    const to = targetOf(move);
    if (!to) return null;
    if (to.toggle) toggle(to.toggle);
    const item = graph.items.get(to.to)!;
    const id = item.id && (item.role === 'record' || item.role === 'heading') ? item.id : null;
    setWalked({ focus: id ?? focus, key: to.to, along: to.along ?? null });
    if (id && id !== focus) props.onNavigate(id);
    return traceWords(index, graph, to.to);
  }, [targetOf, toggle, graph, focus, index, props.onNavigate]);
  useStageWalk(walkMap, !narrow);
  const onBox = useCallback((key: string) => {
    const item = graph.items.get(key)!;
    const id = item.id && (item.role === 'record' || item.role === 'heading') ? item.id : null;
    setWalked({ focus: id ?? focus, key, along: null });
  }, [graph, focus]);

  // What the header strip says.
  const caption = `${graph.rows.length} use case${graph.rows.length === 1 ? '' : 's'} · ${graph.counts.gapped} with gaps · ${graph.counts.outside} serve${graph.counts.outside === 1 ? 's' : ''} no outcome`;
  useLayoutEffect(() => { onCounts?.(caption); }, [caption, onCounts]);

  const changesKey = useChangesKey();
  const faded = rowsOf(graph, focus).length > 0 || graph.items.has(`outcome/${focus}`) || graph.journeyOf.has(focus);
  const keyEntries = useMemo(() => (narrow ? [] : [...traceKeyEntries(index, graph, faded), ...changesKey]), [narrow, index, graph, faded, changesKey]);
  const secondary = narrow ? null : (
    <>
      <Tooltip label={row ? `${rowOpen ? 'Close' : 'Open'} every stage of ${index.byId.get(row)?.title ?? row}` : 'Select a use case or a box in its row first'}>
        <Button aria-pressed={rowOpen} disabled={!row} onClick={expandRow}>Expand row</Button>
      </Tooltip>
      <div className="graph-depth graph-layout trace-every" role="group" aria-label="Expand all">
        <span className="graph-depth-name" aria-hidden="true">Expand all</span>
        {TRACE_STAGES.map((s) => (
          <Tooltip key={s} label={`${every[s] ? 'Close' : 'Open'} ${TRACE_COLUMN_LABELS[s]} in every row`}>
            <button type="button" aria-pressed={every[s]} onClick={() => setEvery(s)}>{SHORT[s]}</button>
          </Tooltip>
        ))}
      </div>
    </>
  );
  const toolbar = (
    <StageToolbar
      can={(move) => !narrow && targetOf(move) !== null}
      walkLabels={TRACE_WALK_LABELS}
      own={() => ({ primary: narrow ? null : <TidyUp />, secondary })}
    />
  );
  const order = shownOrder(product)?.rows ?? graph.rows.map((r) => r.useCase);
  const list = (access: boolean) => <TraceList index={index} graph={graph} order={order} open={openness} focus={focus} hrefFor={props.hrefFor} onNavigate={props.onNavigate} onToggle={toggle} access={access} />;
  if (narrow) {
    return (
      <section className="trace-page" aria-label="Trace">
        {toolbar}
        {list(false)}
      </section>
    );
  }
  return (
    <section className="trace-page is-drawn" aria-label="Trace">
      {toolbar}
      <StageKey entries={keyEntries} />
      <TraceCanvas
        index={index} focus={focus} graph={graph} open={openness} at={at} beside={besideNow} every={every} tidy={tidy}
        onToggle={toggle} onEvery={setEvery} onBox={onBox} onNavigate={props.onNavigate} onPeek={props.onPeek}
        space={props.space} ring={ring} cameraKey={props.cameraKey} onOpenNew={props.onOpenNew}
      />
      <div className="trace-access" data-arrows="own">{list(true)}</div>
    </section>
  );
}
