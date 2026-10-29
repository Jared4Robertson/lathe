import type { SpecIndex, Stage } from '../specs/data';
import type { KeyEntry } from '../views/StageChrome';
import { stageFor } from '../graph/model';
import type { TraceFocus, TraceMap } from './lanes';

// The Trace stage's key (LA-V98), the entries of the stage's key bar (views/StageChrome.tsx StageKey): what the map's
// boxes, arrows and fades mean, each only while the map draws it in the focus's lanes (and the why tree); the Gaps only
// fade only while Gaps only is on.

const STAGE_ORDER: readonly Stage[] = ['discovery', 'domain-model', 'use-cases', 'interaction-design', 'technical-specification', 'test-plan'];

/** The Trace stage's key entries for its map, focus and filter. */
export function traceKeyEntries(index: SpecIndex, map: TraceMap, focused: Pick<TraceFocus, 'lanes'>, gapsOnly: boolean): KeyEntry[] {
  const stages = new Set<string>();
  const roles = new Set<string>();
  // What the focus keeps at full strength: the why tree and the focus's lanes (every lane on the product).
  for (const box of map.byKey.values()) {
    if (box.lane >= 0 && focused.lanes !== null && !focused.lanes.has(box.lane)) continue;
    roles.add(box.role);
    if (box.role === 'record') {
      const record = index.byId.get(box.id);
      if (record) stages.add(stageFor(index, box.id, record.kind));
    }
  }
  const out: KeyEntry[] = [];
  for (const stage of STAGE_ORDER) {
    if (!stages.has(stage)) continue;
    const name = index.workspace.stages.find((s) => s.stage === stage)?.label ?? stage;
    out.push({ id: `stage-${stage}`, group: 'colors', sample: <span className={`graph-swatch stage-${stage}`} />, words: name, meaning: `A record of the ${name.toLowerCase()} stage, in its color` });
  }
  if (stages.has('structural')) out.push({ id: 'stage-structural', group: 'colors', sample: <span className="graph-swatch stage-structural" />, words: 'Structural', meaning: 'A product or domain, in the structural colors' });
  if (roles.has('file')) out.push({ id: 'file', group: 'boxes', sample: <span className="graph-swatch stage-structural" />, words: 'File', meaning: 'A file the records in the chain name' });
  if (roles.has('gap')) out.push({ id: 'gap', group: 'boxes', sample: <span className="graph-swatch is-gap" />, words: 'Gap', meaning: 'A gap coverage reports, dashed: not designed, not built or not proved' });
  if (roles.has('more')) out.push({ id: 'more', group: 'boxes', sample: <span className="graph-swatch trace-key-more">+N</span>, words: 'More', meaning: '"+N more": a column holding more than it shows; it opens the lane in place' });
  if (roles.has('untraced')) out.push({ id: 'untraced', group: 'boxes', sample: <span className="graph-swatch stage-group" />, words: 'Untraced', meaning: 'The Untraced lane at the bottom: records no requirement or rule reaches' });
  if (map.lanes.length > 0) {
    out.push({
      id: 'link', group: 'lines', words: 'Link', meaning: 'An arrow for each actual link along an obligation\'s chain, left to right',
      sample: <svg className="trace-key-arrow" viewBox="0 0 22 10" width="22" height="10"><path d="M1 5h17" /><path d="M14 1.5 19 5l-5 3.5" /></svg>,
    });
  }
  if (map.tree.lines.length > 0) out.push({ id: 'why', group: 'lines', sample: <span className="graph-line" />, words: 'Why tree', meaning: 'The why tree\'s plain lines join each outcome, capability or parent to what hangs from it' });
  out.push({ id: 'focus', group: 'focus', sample: <span className="graph-swatch is-focus" />, words: 'Focus', meaning: 'The focus, ringed on every lane that holds it' });
  if (focused.lanes !== null && focused.lanes.size < map.lanes.length) out.push({ id: 'faded', group: 'focus', sample: <span className="graph-swatch stage-use-cases is-faded" />, words: 'Faded', meaning: 'Outside the focus' });
  if (gapsOnly && map.lanes.some((l) => l.obligation !== null && l.gaps.length === 0)) out.push({ id: 'complete', group: 'focus', sample: <span className="graph-swatch stage-use-cases is-faded" />, words: 'Complete', meaning: 'Gaps only: a lane with no gap, faded back' });
  return out;
}
