// The Trace stage's Delivery view (LA-V98): one row per use case, from the business outcomes it serves to its acceptance
// tests (delivery.ts), read from the Delivery read model (list-delivery, LA-TRC-RM13) again after every reload. Its
// toolbar is every stage's (views/StageChrome.tsx), with the view switch, Expand row (the focus's row, every stage),
// Expand all (one stage, every row) and Tidy up; its key; the canvas (TraceDelivery.tsx) with its accessible layer
// under it (DeliveryList.tsx, visually hidden); and on a phone the list alone, one use case at a time. What each place
// opens is its own (delivery-open.ts). What it holds is told to the header strip.
import './delivery.css';
import { useCallback, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import type { ProductDelivery } from '../../../../lathe/src/traceability/delivery/read-model';
import { Button } from '../../components/Button';
import type { RecordIndex } from '../../exploring/record-summaries/record-index';
import { readState } from '../../record/page-parts';
import { useCommand, useStageWalk } from '../../shell/commands';
import { Tooltip } from '../../shell/Tooltip';
import { useNarrow } from '../../shell/useNarrow';
import { useChangesKey } from '../../changes/ChangesKey';
import { useDelivery } from '../../traceability/delivery/reads';
import type { Move } from '../../views/levels';
import type { OpenSpaceStore } from '../../views/openSpace';
import { StageKey, StageToolbar, TidyUp } from '../../views/StageChrome';
import { cellKey, DELIVERY_COLUMN_LABELS, DELIVERY_STAGES, deliveryGraph, everyStepKey, rowsOf, type DeliveryGraph, type DeliveryStage, type Openness } from './delivery';
import { shownOrder } from './delivery-order';
import { layOutDelivery } from './delivery-layout';
import { useOpenness } from './delivery-open';
import { DELIVERY_WALK_LABELS, deliveryTarget, deliveryWords } from './delivery-walk';
import { deliveryKeyEntries } from './DeliveryKey';
import { DeliveryList } from './DeliveryList';
import { TraceDelivery } from './TraceDelivery';

export interface DeliveryTraceProps {
  index: RecordIndex;
  focus: string;
  product: string;
  onNavigate: (id: string) => void;
  hrefFor: (id: string) => string;
  onPeek?: (kind: 'hover' | 'selected', id: string | null) => void;
  onCounts?: (counts: string) => void;
  space?: OpenSpaceStore;
  cameraKey?: string;
  onOpenNew?: (id: string, background: boolean) => void;
  /** The All at once | Delivery switch, as the Trace stage draws it. */
  viewSwitch: (narrow: boolean) => ReactNode;
}

/** The Delivery view once its read answers for the product; until then, that it is reading (or why it could not). */
export function DeliveryTrace(props: DeliveryTraceProps) {
  const { index, product } = props;
  const read = readState(index, product, useDelivery(product, index), (answer) => answer.product === product, false);
  if ('shown' in read) return <section className="trace-page" aria-label="Trace">{read.shown}</section>;
  return <DeliveryStage {...props} delivery={read.answer} />;
}

/** The stage names Expand all says, short for the toolbar. */
const SHORT: Record<DeliveryStage, string> = { 'use-case': 'Use case', design: 'Design', technical: 'Technical', suite: 'Suite' };

/** Whether every row has the stage open. */
const everyOpen = (graph: DeliveryGraph, open: ReadonlySet<string>, stage: DeliveryStage) =>
  graph.rows.length > 0 && graph.rows.every((r) => open.has(cellKey(r.useCase, stage)) && (stage !== 'technical' || open.has(everyStepKey(r.useCase))));

function DeliveryStage(props: DeliveryTraceProps & { delivery: ProductDelivery }) {
  const { index, focus, product, delivery, onCounts } = props;
  const narrow = useNarrow();
  const graph = useMemo(() => deliveryGraph(index, delivery), [index, delivery]);
  const [open, setOpen] = useOpenness(props.cameraKey);
  // The step whose chain the Technical flow column shows: the last step selected.
  const [step, setStep] = useState<string | null>(null);
  const focusIsStep = index.byId.get(focus)?.kind === 'flow_step';
  if (focusIsStep && step !== focus) setStep(focus);
  const openness = useMemo<Openness>(() => ({ open, step: focusIsStep ? focus : step }), [open, step, focus, focusIsStep]);
  // Tidy up (LA-PAT-APP-UX-R22): the rows ordered afresh, gaps closed, by the stage's shared command and button.
  const [tidy, setTidy] = useState(0);
  useCommand('stageTidy', () => setTidy((t) => t + 1), !narrow);
  // The box the walk or a click stands on, for the focus it left there (a record may show in several boxes).
  const [walked, setWalked] = useState<{ focus: string; key: string } | null>(null);
  const at = walked?.focus === focus && graph.items.has(walked.key) ? walked.key : null;
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
  const every = useMemo(() => Object.fromEntries(DELIVERY_STAGES.map((s) => [s, everyOpen(graph, open, s)])) as Record<DeliveryStage, boolean>, [graph, open]);
  const setEvery = useCallback((stage: DeliveryStage) => {
    const next = new Set(open);
    for (const r of graph.rows) {
      const keys = [cellKey(r.useCase, stage), ...(stage === 'technical' ? [everyStepKey(r.useCase)] : [])];
      for (const k of keys) if (every[stage]) next.delete(k); else next.add(k);
    }
    setOpen(next);
  }, [graph, open, every, setOpen]);
  // Expand row: the focus's row (or the walk's), every stage.
  const row = atItem?.row ?? rowsOf(graph, focus)[0]?.useCase ?? null;
  const rowOpen = !!row && DELIVERY_STAGES.every((s) => open.has(cellKey(row, s)));
  const expandRow = useCallback(() => {
    if (!row) return;
    const next = new Set(open);
    for (const s of DELIVERY_STAGES) if (rowOpen) { next.delete(cellKey(row, s)); if (s === 'technical') next.delete(everyStepKey(row)); } else next.add(cellKey(row, s));
    setOpen(next);
  }, [row, rowOpen, open, setOpen]);

  // The stage walk (delivery-walk.ts, LA-V61-R49): on a record the focus moves there, as a click does, and the camera
  // follows; on another box the ring does. In and Out open and close on the way. Each step is announced.
  const laidNow = useCallback(() => { const order = shownOrder(product); return order ? layOutDelivery(graph, order, openness) : null; }, [product, graph, openness]);
  const fromBox = at ?? graph.boxesOf.get(focus)?.[0] ?? (graph.items.has(`outcome/${focus}`) ? `outcome/${focus}` : null);
  const targetOf = useCallback((move: Move) => { const laid = laidNow(); return laid ? deliveryTarget(graph, laid, openness, fromBox, move) : null; }, [laidNow, graph, openness, fromBox]);
  const walkMap = useCallback((move: Move) => {
    const to = targetOf(move);
    if (!to) return null;
    if (to.toggle) toggle(to.toggle);
    const item = graph.items.get(to.to)!;
    const id = item.id && (item.role === 'record' || item.role === 'heading') ? item.id : null;
    setWalked({ focus: id ?? focus, key: to.to });
    if (id && id !== focus) props.onNavigate(id);
    return deliveryWords(index, graph, to.to);
  }, [targetOf, toggle, graph, focus, index, props.onNavigate]);
  useStageWalk(walkMap, !narrow);
  const onBox = useCallback((key: string) => {
    const item = graph.items.get(key)!;
    const id = item.id && (item.role === 'record' || item.role === 'heading') ? item.id : null;
    setWalked({ focus: id ?? focus, key });
  }, [graph, focus]);

  // What the header strip says.
  const caption = `${graph.rows.length} use case${graph.rows.length === 1 ? '' : 's'} · ${graph.counts.gapped} with gaps · ${graph.counts.outside} serve${graph.counts.outside === 1 ? 's' : ''} no outcome`;
  useLayoutEffect(() => { onCounts?.(caption); }, [caption, onCounts]);

  const changesKey = useChangesKey();
  const faded = rowsOf(graph, focus).length > 0 || graph.items.has(`outcome/${focus}`);
  const keyEntries = useMemo(() => (narrow ? [] : [...deliveryKeyEntries(index, graph, faded), ...changesKey]), [narrow, index, graph, faded, changesKey]);
  const secondary = narrow ? null : (
    <>
      <Tooltip label={row ? `${rowOpen ? 'Close' : 'Open'} every stage of ${index.byId.get(row)?.title ?? row}` : 'Select a use case or a box in its row first'}>
        <Button aria-pressed={rowOpen} disabled={!row} onClick={expandRow}>Expand row</Button>
      </Tooltip>
      <div className="graph-depth graph-layout delivery-every" role="group" aria-label="Expand all">
        <span className="graph-depth-name" aria-hidden="true">Expand all</span>
        {DELIVERY_STAGES.map((s) => (
          <Tooltip key={s} label={`${every[s] ? 'Close' : 'Open'} ${DELIVERY_COLUMN_LABELS[s]} in every row`}>
            <button type="button" aria-pressed={every[s]} onClick={() => setEvery(s)}>{SHORT[s]}</button>
          </Tooltip>
        ))}
      </div>
    </>
  );
  const toolbar = (
    <StageToolbar
      can={(move) => !narrow && targetOf(move) !== null}
      walkLabels={DELIVERY_WALK_LABELS}
      own={(n) => ({ primary: <>{props.viewSwitch(n)}{!narrow && <TidyUp />}</>, secondary })}
    />
  );
  const order = shownOrder(product)?.rows ?? graph.rows.map((r) => r.useCase);
  const list = (access: boolean) => <DeliveryList index={index} graph={graph} order={order} open={openness} focus={focus} hrefFor={props.hrefFor} onNavigate={props.onNavigate} onToggle={toggle} access={access} />;
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
      <TraceDelivery
        index={index} focus={focus} graph={graph} open={openness} at={at} every={every} tidy={tidy}
        onToggle={toggle} onEvery={setEvery} onBox={onBox} onNavigate={props.onNavigate} onPeek={props.onPeek}
        space={props.space} ring={ring} cameraKey={props.cameraKey} onOpenNew={props.onOpenNew}
      />
      <div className="trace-access" data-arrows="own">{list(true)}</div>
    </section>
  );
}
