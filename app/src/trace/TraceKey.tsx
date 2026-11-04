import { type RecordIndex } from '../exploring/record-summaries/record-index';
import type { Stage } from '../../../lathe/src/platform/data/schema';
import type { KeyEntry } from '../views/StageChrome';
import { stageFor } from '../graph/model';
import { TRACE_COLUMN_LABELS, TRACE_COLUMNS, type TraceGraph } from './trace';

// The Trace stage's key (LA-V98), the entries of the stage's key bar (views/StageChrome.tsx StageKey): the columns, the
// stage colors of the records it draws, the serves line, a journey's line with its steps' numbers and the selection's path, a stage's status and its gap, the
// toggle that opens a box, the mark over the rows serving no outcome, the focus and, while a selection lights a path,
// what is faded off it.

const STAGE_ORDER: readonly Stage[] = ['discovery', 'domain-model', 'use-cases', 'interface-design', 'technical-specification', 'test-plan'];

const stagesOf = new WeakMap<TraceGraph, Set<string>>();
/** The stages of the records the view draws, worked out once per graph. */
function stages(index: RecordIndex, graph: TraceGraph): Set<string> {
  const known = stagesOf.get(graph);
  if (known) return known;
  const out = new Set<string>();
  for (const id of graph.boxesOf.keys()) { const record = index.byId.get(id); if (record) out.add(stageFor(index, id, record.kind)); }
  stagesOf.set(graph, out);
  return out;
}

/** The Trace stage's key entries, with whether a selection lights a path (the rest faded). */
export function traceKeyEntries(index: RecordIndex, graph: TraceGraph, faded: boolean): KeyEntry[] {
  const out: KeyEntry[] = [{
    id: 'columns', group: 'columns', sample: <svg className="trace-key-columns" width="22" height="12" viewBox="0 0 22 12" aria-hidden="true">{TRACE_COLUMNS.map((c, i) => <rect key={c} x={i * 3.6 + 0.5} y="0.5" width="2.6" height="11" rx="0.5" />)}</svg>, words: 'Rows',
    meaning: `One row per use case, each once; left to right: ${TRACE_COLUMNS.map((c) => TRACE_COLUMN_LABELS[c]).join(', ')}`,
  }];
  const drawn = stages(index, graph);
  for (const stage of STAGE_ORDER) {
    if (!drawn.has(stage)) continue;
    const name = index.meta.stages.find((s) => s.stage === stage)?.label ?? stage;
    out.push({ id: `stage-${stage}`, group: 'colors', sample: <span className={`graph-swatch stage-${stage}`} />, words: name, meaning: `A record of the ${name.toLowerCase()} stage, in its color` });
  }
  if (graph.serves.length + graph.journeyServes.length > 0) out.push({ id: 'link-serves', group: 'links', sample: <svg className="trace-key-link is-serves" width="22" height="12" viewBox="0 0 22 12" aria-hidden="true"><path d="M1 10 C 11 10, 11 2, 21 2" /></svg>, words: 'Serves', meaning: 'An outcome to each use case whose capability serves it, and to each journey serving it' });
  if (graph.carries.length > 0) out.push({ id: 'link-carries', group: 'links', sample: <svg className="trace-key-link is-serves" width="22" height="12" viewBox="0 0 22 12" aria-hidden="true"><path d="M1 10 C 11 10, 11 2, 21 2" /><text className="trace-key-number" x="11" y="8.5" textAnchor="middle">1</text></svg>, words: 'Carries out', meaning: "A journey to each use case its steps carry out, labeled with the steps' numbers (alt for an alternate path)" });
  out.push({ id: 'link-path', group: 'links', sample: <svg className="trace-key-link is-path" width="22" height="12" viewBox="0 0 22 12" aria-hidden="true"><path d="M1 10 C 11 10, 11 2, 21 2" /></svg>, words: 'Path', meaning: "The selection's path across its row: a requirement, the steps fulfilling it, their technical chain and the tests proving it" });
  out.push({ id: 'status', group: 'boxes', sample: <span className="graph-swatch stage-use-cases" />, words: 'Status', meaning: "A stage's status in a closed row: its flows designed, its handlers built, its tests proved" });
  if (graph.counts.gapped > 0) out.push({ id: 'gap', group: 'boxes', sample: <span className="graph-swatch is-gap" />, words: 'Gap', meaning: 'A stage with a gap, or what is missing, dashed: not designed, not built, not proved' });
  out.push({ id: 'toggle', group: 'boxes', sample: <span className="trace-key-toggle" aria-hidden="true">▸</span>, words: 'Open', meaning: "A box with children: ▸ opens it, ▾ closes it; a column's name opens its stage in every row" });
  if (graph.counts.outside > 0) out.push({ id: 'outside', group: 'boxes', sample: <span className="trace-key-outside" aria-hidden="true" />, words: 'No outcome', meaning: 'Under the dashed mark: the use cases whose capability serves no business outcome' });
  out.push({ id: 'focus', group: 'focus', sample: <span className="graph-swatch is-focus" />, words: 'Focus', meaning: 'The selection, ringed; it and its path across its row lit' });
  if (faded) out.push({ id: 'faded', group: 'focus', sample: <span className="graph-swatch stage-use-cases is-faded" />, words: 'Faded', meaning: "Off the selection's path: faded back" });
  return out;
}
