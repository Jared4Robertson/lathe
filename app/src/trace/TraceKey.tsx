import { type RecordIndex } from '../exploring/record-summaries/record-index';
import type { Stage } from '../../../lathe/src/platform/data/schema';
import type { KeyEntry } from '../views/StageChrome';
import { stageFor } from '../graph/model';
import { ALL_COLUMN_LABELS, ALL_COLUMNS, LINK_KINDS, LINK_LABELS, type AllGraph, type LinkKind } from './all';

// The Trace stage's key (LA-V98), the entries of the stage's key bar (views/StageChrome.tsx StageKey) for its All-at-once
// view: the columns, the stage colors of the records it draws, each kind of link in its color, a gap's dashed box, the
// mark over what no outcome reaches, the focus and, while a focus or Gaps only keeps a path, what is faded off it.

const STAGE_ORDER: readonly Stage[] = ['discovery', 'domain-model', 'use-cases', 'interaction-design', 'technical-specification', 'test-plan'];

const LINK_MEANING: Record<LinkKind, string> = {
  serves: 'An outcome to each use case whose capability serves it',
  reaches: 'A use case to each obligation it reaches: its requirements, and the rules, invariants and requirements its steps reach',
  built: 'An obligation to each record that builds it',
  proved: 'An obligation to each test that proves it, behind the Built by column',
};

/** A link's sample: a short curve in its kind's color (its class sets the color, as the canvas draws it). */
const LinkSample = ({ kind }: { kind: LinkKind }) => (
  <svg className={`trace-key-link is-${kind}`} width="22" height="12" viewBox="0 0 22 12" aria-hidden="true"><path d="M1 10 C 11 10, 11 2, 21 2" /></svg>
);

const stagesOf = new WeakMap<AllGraph, Set<string>>();
/** The stages of the records the view draws, worked out once per graph. */
function stages(index: RecordIndex, graph: AllGraph): Set<string> {
  const known = stagesOf.get(graph);
  if (known) return known;
  const out = new Set<string>();
  for (const n of graph.nodes.values()) {
    const record = n.role === 'record' ? index.byId.get(n.key) : undefined;
    if (record) out.add(stageFor(index, n.key, record.kind));
  }
  stagesOf.set(graph, out);
  return out;
}

/** The All-at-once view's key entries, with whether a focus or Gaps only keeps a path (the rest faded). */
export function allKeyEntries(index: RecordIndex, graph: AllGraph, faded: boolean): KeyEntry[] {
  const out: KeyEntry[] = [{
    id: 'columns', group: 'columns', sample: <svg className="trace-key-columns" width="22" height="12" viewBox="0 0 22 12" aria-hidden="true">{[0, 1, 2, 3, 4].map((i) => <rect key={i} x={i * 4.5 + 0.5} y="0.5" width="3" height="11" rx="0.5" />)}</svg>, words: 'Columns',
    meaning: `Left to right: ${ALL_COLUMNS.map((c) => ALL_COLUMN_LABELS[c]).join(', ')}; each record once`,
  }];
  const drawn = stages(index, graph);
  for (const stage of STAGE_ORDER) {
    if (!drawn.has(stage)) continue;
    const name = index.meta.stages.find((s) => s.stage === stage)?.label ?? stage;
    out.push({ id: `stage-${stage}`, group: 'colors', sample: <span className={`graph-swatch stage-${stage}`} />, words: name, meaning: `A record of the ${name.toLowerCase()} stage, in its color` });
  }
  const kinds = new Set(graph.links.map((l) => l.kind));
  for (const kind of LINK_KINDS) if (kinds.has(kind)) out.push({ id: `link-${kind}`, group: 'links', sample: <LinkSample kind={kind} />, words: LINK_LABELS[kind], meaning: LINK_MEANING[kind] });
  if (graph.counts.withGaps > 0) out.push({ id: 'gap', group: 'boxes', sample: <span className="graph-swatch is-gap" />, words: 'Gap', meaning: 'A gap coverage reports, dashed, in the column of what is missing: not designed or not built under Built by, not proved under Proved by' });
  if (graph.counts.outside > 0) out.push({ id: 'outside', group: 'boxes', sample: <span className="trace-key-outside" aria-hidden="true" />, words: 'Not under an outcome', meaning: 'Under the dashed mark at the bottom of each column: the records no business outcome reaches by these links' });
  out.push({ id: 'focus', group: 'focus', sample: <span className="graph-swatch is-focus" />, words: 'Focus', meaning: 'The focus, ringed; it and its whole path, back to its outcomes and on to its tests, lit' });
  if (faded) out.push({ id: 'faded', group: 'focus', sample: <span className="graph-swatch stage-use-cases is-faded" />, words: 'Faded', meaning: 'Off the path the focus or Gaps only keeps: faded back' });
  return out;
}
