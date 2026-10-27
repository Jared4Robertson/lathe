import { textOf, byIdOrder, type SpecIndex, type SpecLink, type SpecRecord } from './data';
import { linkLabel } from './labels';
import { patternsFollowedBy, ruleStatus } from './patterns';

// What a record's Traceability section shows (LA-TRC-UC14), on the new model's tree: an obligation
// (a constraint, invariant, specification, policy, domain service, UC requirement, view or API
// requirement, pattern or standard rule, or a product's own obligation kind) is designed by what
// specifies its implementation, built when that names a file that exists, and proved by its tests,
// which sit under it. Its other links follow, titled by their labels. A use case lists its UC
// requirements, each judged; a test shows what it proves (its parent) and how it is run. Coverage's
// gaps, where the engine reports them, decide designed and proved, so this section never disagrees
// with the coverage marks or the checks. Pure logic, tested directly; Traceability.tsx draws it.

export type TraceRole = 'design' | 'proof' | 'plain';

export interface TraceGroup {
  /** Stable: the direction and the label. */
  key: string;
  /** The group's title, read from this record's end: "Designed by", "Proved by", "Hears". */
  label: string;
  /** What the group's rows show besides the record: a built mark, a test's state. */
  role: TraceRole;
  ids: string[];
}

export type GapKind = 'not-designed' | 'not-built' | 'not-proved' | 'not-automated';

export interface TraceGap {
  kind: GapKind;
  /** The check that reports the gap, whose page the callout links to. */
  check: string;
}

/** An obligation as one domain owes it: what designs, builds and proves it there. */
export interface Judgment {
  domain: string;
  /** Whether it must be designed and built (a pattern rule is proved only). */
  needsDesign: boolean;
  designedBy: string[];
  builtBy: string[];
  provedBy: string[];
  /** Its tests not automated yet: they do not count as proof. */
  notAutomatedBy: string[];
  gaps: TraceGap[];
}

const sortIds = (ids: Iterable<string>) => [...new Set(ids)].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
const childrenOfKind = (index: SpecIndex, id: string, kind: string) => (index.children.get(id) ?? []).filter((c) => c.kind === kind);
const childrenInStage = (index: SpecIndex, id: string, stage: string) => (index.children.get(id) ?? []).filter((c) => index.kinds.get(c.kind)?.stage === stage);
const linked = (index: SpecIndex, id: string, relation: string, way: 'out' | 'in') =>
  (way === 'out' ? index.outgoing.get(id) ?? [] : index.incoming.get(id) ?? []).filter((l) => l.relation === relation).map((l) => (way === 'out' ? l.target : l.source));

/** A technical record counts as built when it names a file and no check reports that file missing. */
export function isBuilt(index: SpecIndex, id: string): boolean {
  const record = index.byId.get(id);
  if (!record || !textOf(record.row, 'file').trim()) return false;
  return !(index.problemsFor.get(id) ?? []).some((p) => p.check === 'technical-file-missing');
}

/**
 * What specifies an obligation's implementation:
 * - a UC requirement: the flow steps that fulfill it;
 * - a constraint: its value object's value type; an invariant: its aggregate's repository and the tables whose unique
 *   key names it; a specification, policy or domain service: its predicate, event handler or service;
 * - a view requirement: the UI components rendering its view; an API requirement: its endpoint's handler;
 * - a standard rule: the technical records and tests that meet it;
 * - any other obligation (a product's own kind): its children of the technical specification stage.
 */
export function designersOf(index: SpecIndex, record: SpecRecord): string[] {
  const parent = record.parent ? index.byId.get(record.parent) : undefined;
  const technical = (id: string) => childrenInStage(index, id, 'technical-specification').map((r) => r.id);
  switch (record.kind) {
    case 'uc_requirement': return sortIds(linked(index, record.id, 'fulfills', 'in'));
    case 'constraint': return parent ? sortIds(childrenOfKind(index, parent.id, 'value_type').map((r) => r.id)) : [];
    case 'invariant': {
      const keyed = index.workspace.parts.filter((p) => p.table === 'table_key' && p.row.invariant_id === record.id).map((p) => p.owner);
      return sortIds([...(parent ? childrenOfKind(index, parent.id, 'repository').map((r) => r.id) : []), ...keyed]);
    }
    case 'view_requirement': return parent ? sortIds(linked(index, parent.id, 'renders', 'in')) : [];
    case 'api_requirement': return parent ? sortIds(childrenOfKind(index, parent.id, 'endpoint_handler').map((r) => r.id)) : [];
    case 'standard_rule': return sortIds(linked(index, record.id, 'meets', 'in'));
    case 'pattern_rule': return [];
    default: return sortIds(technical(record.id));
  }
}

/**
 * What builds an obligation: of what designs it, the technical records that name a file that exists. A UC requirement
 * is built through its steps: the handlers of the commands and queries they invoke.
 */
export function buildersOf(index: SpecIndex, record: SpecRecord, designers: readonly string[]): string[] {
  const technical = record.kind === 'uc_requirement'
    ? designers.flatMap((step) => linked(index, step, 'invokes', 'out')).flatMap((op) => childrenInStage(index, op, 'technical-specification').map((r) => r.id))
    : designers;
  return sortIds(technical.filter((id) => isBuilt(index, id)));
}

/** The tests of an obligation (its children of the test plan), split into proof and those not automated yet; for a pattern rule, those in one domain. */
export function testsOf(index: SpecIndex, record: SpecRecord, domain?: string): { proved: string[]; notAutomated: string[] } {
  const tests = childrenInStage(index, record.id, 'test-plan').filter((t) => !domain || record.kind !== 'pattern_rule' || textOf(t.row, 'domain_id') === domain);
  const notAutomated = tests.filter((t) => textOf(t.row, 'state') === 'not automated yet');
  return { proved: sortIds(tests.filter((t) => !notAutomated.includes(t)).map((t) => t.id)), notAutomated: sortIds(notAutomated.map((t) => t.id)) };
}

/**
 * Where an obligation is owed: its own domain; at product level (a view requirement, a constraint, a standard rule)
 * its product; for a pattern rule each domain following its pattern where it applies.
 */
export function owingDomains(index: SpecIndex, record: SpecRecord): string[] {
  if (record.domain) return [record.domain];
  if (record.kind !== 'pattern_rule') return record.product ? [record.product] : [];
  if (!record.parent) return [];
  const domains = index.workspace.records.filter((d) => d.kind === 'domain' && d.product === record.product);
  return domains
    .filter((d) => {
      const followed = patternsFollowedBy(index, d.id).find((f) => f.pattern.id === record.parent);
      return followed && ruleStatus(index, record, d.id, followed).applies;
    })
    .map((d) => d.id)
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
}

/** How one domain stands on an obligation, with the gaps coverage reports there (or the tree shows, when coverage has none). */
export function judge(index: SpecIndex, record: SpecRecord, domain: string): Judgment {
  const needsDesign = record.kind !== 'pattern_rule';
  const designedBy = needsDesign ? designersOf(index, record) : [];
  const builtBy = buildersOf(index, record, designedBy);
  const { proved: provedBy, notAutomated: notAutomatedBy } = testsOf(index, record, domain);
  const coverage = index.coverage.get(domain);
  const missing = new Set((coverage?.gaps ?? []).filter((g) => g.id === record.id).map((g) => g.missing));
  const designed = coverage ? !missing.has('designed') : designedBy.length > 0;
  const built = coverage ? !missing.has('built') : builtBy.length > 0;
  const proved = coverage ? !missing.has('proved') : provedBy.length > 0;
  const gaps: TraceGap[] = [];
  if (needsDesign && !designed) gaps.push({ kind: 'not-designed', check: 'not-designed' });
  if (needsDesign && designed && !built) gaps.push({ kind: 'not-built', check: 'not-built' });
  if (!proved) gaps.push({ kind: notAutomatedBy.length > 0 ? 'not-automated' : 'not-proved', check: 'not-proved' });
  return { domain, needsDesign, designedBy, builtBy, provedBy, notAutomatedBy, gaps };
}

/** Links grouped by their label read from this record's end, in label order; an empty group never appears. */
function grouped(index: SpecIndex, links: readonly SpecLink[], from: 'source' | 'target'): TraceGroup[] {
  const groups = new Map<string, Set<string>>();
  for (const l of links) {
    const label = linkLabel(index, l, from);
    groups.set(label, (groups.get(label) ?? new Set<string>()).add(from === 'source' ? l.target : l.source));
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, ids]) => ({ key: `${from === 'source' ? 'out' : 'in'}:${label}`, label, role: 'plain' as TraceRole, ids: sortIds(ids) }));
}

export interface Trace {
  groups: TraceGroup[];
  /** For an obligation: how each owing domain stands on it. */
  judgments: Judgment[];
  /** For a use case: its UC requirements, each judged in the use case's domain. */
  requirements: { record: SpecRecord; judgment: Judgment | null }[];
  /** For a test: how it is run: its level and state, and its file or why it is manual. */
  runBy: { level: string; state: string; file: string | null; missing: boolean; manualReason: string | null } | null;
}

/**
 * A record's traceability, by kind:
 * - an obligation: Designed by and Proved by (as the domain owing it judges them), then its other links in and out;
 * - a use case: its UC requirements (judged), then its links;
 * - a test: Proves (its parent), its run by, then its links;
 * - anything else: links out under their forward labels, then links in under their reverse labels.
 * `skip` leaves out relations a page already shows in a section of its own ("out:hears", "in:fulfills").
 */
export function traceOf(index: SpecIndex, record: SpecRecord, skip: ReadonlySet<string> = new Set()): Trace {
  const kind = index.kinds.get(record.kind);
  const out = (index.outgoing.get(record.id) ?? []).filter((l) => !skip.has(`out:${l.relation}`));
  const into = (index.incoming.get(record.id) ?? []).filter((l) => !skip.has(`in:${l.relation}`));
  const trace: Trace = { groups: [], judgments: [], requirements: [], runBy: null };

  if (kind?.obligation) {
    trace.judgments = owingDomains(index, record).map((d) => judge(index, record, d));
    // A record's own domain (or the product, for a standard rule): Designed by and Proved by as groups, then the rest.
    const designers = record.kind === 'pattern_rule' ? [] : designersOf(index, record);
    const { proved, notAutomated } = testsOf(index, record);
    const own = new Set(['fulfills', 'meets']);
    trace.groups = [
      // A standard rule is met, in its relation's own words, by what follows it.
      ...(designers.length > 0 ? [{ key: 'design', label: record.kind === 'standard_rule' ? 'Met by' : 'Designed by', role: 'design' as TraceRole, ids: designers }] : []),
      ...(proved.length + notAutomated.length > 0 ? [{ key: 'proof', label: 'Proved by', role: 'proof' as TraceRole, ids: sortIds([...proved, ...notAutomated]) }] : []),
      ...grouped(index, into.filter((l) => !own.has(l.relation)), 'target'),
      ...grouped(index, out, 'source'),
    ];
    return trace;
  }

  if (record.kind === 'use_case') {
    trace.requirements = childrenOfKind(index, record.id, 'uc_requirement')
      .sort(byIdOrder)
      .map((r) => ({ record: r, judgment: r.domain ? judge(index, r, r.domain) : null }));
    trace.groups = [...grouped(index, out, 'source'), ...grouped(index, into, 'target')];
    return trace;
  }

  if (kind?.stage === 'test-plan') {
    const state = textOf(record.row, 'state');
    const file = textOf(record.row, 'file').trim() || null;
    trace.groups = [
      ...(record.parent ? [{ key: 'proves', label: 'Proves', role: 'plain' as TraceRole, ids: [record.parent] }] : []),
      ...grouped(index, out, 'source'),
      ...grouped(index, into, 'target'),
    ];
    trace.runBy = {
      level: textOf(record.row, 'level'),
      state,
      file,
      missing: !!file && (index.problemsFor.get(record.id) ?? []).some((p) => p.check === 'test-file-missing'),
      manualReason: textOf(record.row, 'manual_reason').trim() || null,
    };
    return trace;
  }

  trace.groups = [...grouped(index, out, 'source'), ...grouped(index, into, 'target')];
  return trace;
}

/** Whether a trace has nothing to show. */
export const traceEmpty = (t: Trace) => t.groups.length === 0 && t.judgments.length === 0 && t.requirements.length === 0 && !t.runBy;