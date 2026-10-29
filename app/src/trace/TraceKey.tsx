import type { SpecIndex, Stage } from '../specs/data';
import type { KeyEntry } from '../views/StageChrome';
import { stageFor } from '../graph/model';
import type { TraceMap } from './tree';

// The Trace stage's key (LA-V98), the entries of the stage's key bar (views/StageChrome.tsx StageKey): what the tree's
// boxes, arrows and fades mean, each only while the tree draws it at full strength under the focus; the Gaps only fade
// only while Gaps only is on.

const STAGE_ORDER: readonly Stage[] = ['discovery', 'domain-model', 'use-cases', 'interaction-design', 'technical-specification', 'test-plan'];

/** The Trace stage's key entries for its tree, the keys its focus keeps at full strength (null for all) and its filter. */
export function traceKeyEntries(index: SpecIndex, map: TraceMap, kept: ReadonlySet<string> | null, gapsOnly: boolean): KeyEntry[] {
  const stages = new Set<string>();
  const roles = new Set<string>();
  let links = false;
  let lines = false;
  // What the focus keeps at full strength: every node under its kept nodes (the whole tree for the product).
  const queue = kept ? [...kept] : [map.product];
  for (let i = 0; i < queue.length; i++) {
    const key = queue[i];
    const node = map.nodes.get(key)!;
    roles.add(node.role);
    if (node.role === 'record') {
      const record = index.byId.get(node.id);
      if (record) stages.add(stageFor(index, node.id, record.kind));
    }
    for (const child of map.map.nodes.get(key)?.children ?? []) {
      if (map.links.has(child)) links = true; else lines = true;
      queue.push(child);
    }
  }
  const out: KeyEntry[] = [];
  for (const stage of STAGE_ORDER) {
    if (!stages.has(stage)) continue;
    const name = index.workspace.stages.find((s) => s.stage === stage)?.label ?? stage;
    out.push({ id: `stage-${stage}`, group: 'colors', sample: <span className={`graph-swatch stage-${stage}`} />, words: name, meaning: `A record of the ${name.toLowerCase()} stage, in its color` });
  }
  if (stages.has('structural')) out.push({ id: 'stage-structural', group: 'colors', sample: <span className="graph-swatch stage-structural" />, words: 'Structural', meaning: 'A product or domain, in the structural colors' });
  if (roles.has('outside')) out.push({ id: 'outside', group: 'boxes', sample: <span className="graph-swatch stage-structural" />, words: 'Not under an outcome', meaning: 'After the outcomes: the obligations no business outcome reaches, by domain' });
  if (roles.has('file')) out.push({ id: 'file', group: 'boxes', sample: <span className="graph-swatch stage-structural" />, words: 'File', meaning: 'A file the records in the chain name' });
  if (roles.has('gap')) out.push({ id: 'gap', group: 'boxes', sample: <span className="graph-swatch is-gap" />, words: 'Gap', meaning: 'A gap coverage reports, dashed: not designed, not built or not proved' });
  if (roles.has('untraced')) out.push({ id: 'untraced', group: 'boxes', sample: <span className="graph-swatch is-gap" />, words: 'Untraced', meaning: 'Last under the product, dashed: the records no requirement or rule reaches' });
  if (links) {
    out.push({
      id: 'link', group: 'lines', words: 'Chain', meaning: 'An arrow for each actual link along an obligation\'s chain, left to right',
      sample: <svg className="trace-key-arrow" viewBox="0 0 22 10" width="22" height="10"><path d="M1 5h17" /><path d="M14 1.5 19 5l-5 3.5" /></svg>,
    });
  }
  if (lines) out.push({ id: 'parent', group: 'lines', sample: <span className="graph-line" />, words: 'Parent', meaning: 'A plain line joins each parent to what hangs from it, down to each obligation' });
  out.push({ id: 'focus', group: 'focus', sample: <span className="graph-swatch is-focus" />, words: 'Focus', meaning: 'The focus, ringed on every copy; a record several chains hold is drawn in each' });
  if (kept !== null) out.push({ id: 'faded', group: 'focus', sample: <span className="graph-swatch stage-use-cases is-faded" />, words: 'Faded', meaning: 'Outside the focus' });
  if (gapsOnly && map.counts.withGaps < map.counts.obligations) out.push({ id: 'complete', group: 'focus', sample: <span className="graph-swatch stage-use-cases is-faded" />, words: 'Complete', meaning: 'Gaps only: an obligation with no gap and its chain, faded back' });
  return out;
}
