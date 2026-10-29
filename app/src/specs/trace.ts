import { textOf, byIdOrder, provedByOf, type SpecIndex, type SpecLink, type SpecRecord } from './data';
import { linkLabel } from './labels';
import { isTestKind } from './parts';

// What a record's Traceability section shows (LA-TRC-UC14), on the new model's tree: an obligation
// (a constraint, invariant, specification, policy, domain service, UC requirement, view or API
// requirement, pattern or standard rule, or a product's own obligation kind) is designed, built and
// proved by what its chain holds, as the engine works it out (Workspace.chains, the chain the Trace
// stage draws): this only reads it. A build record is marked built when it names a file that exists.
// Its other links follow, titled by their labels, but for those to what its chain already shows. A use case lists its UC
// requirements, each judged; a test shows what it proves (its parent) and how it is run. Coverage's
// gaps, where the engine reports them, decide designed and built, and its proved_by decides proved and
// names the proof, so this section never disagrees with the coverage marks or the checks. Pure logic,
// tested directly; Traceability.tsx draws it.

export type TraceRole = 'design' | 'build' | 'proof' | 'plain';

export interface TraceGroup {
  /** Stable: the direction and the label. */
  key: string;
  /** The group's title, read from this record's end: "Designed by", "Built by", "Proved by", "Hears". */
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
  /** Its chain's design records. */
  designedBy: string[];
  /** Its chain's build records that name a file that exists. */
  builtBy: string[];
  /** The tests that count as its proof there, as the engine's coverage says. */
  provedBy: string[];
  /** Its tests not automated yet: they do not count as proof. */
  notAutomatedBy: string[];
  gaps: TraceGap[];
}

const sortIds = (ids: Iterable<string>) => [...new Set(ids)].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
const childrenOfKind = (index: SpecIndex, id: string, kind: string) => (index.children.get(id) ?? []).filter((c) => c.kind === kind);
const childrenInStage = (index: SpecIndex, id: string, stage: string) => (index.children.get(id) ?? []).filter((c) => index.kinds.get(c.kind)?.stage === stage);

/** A technical record counts as built when it names a file and no check reports that file missing. */
export function isBuilt(index: SpecIndex, id: string): boolean {
  const record = index.byId.get(id);
  if (!record || !textOf(record.row, 'file').trim()) return false;
  return !(index.problemsFor.get(id) ?? []).some((p) => p.check === 'technical-file-missing');
}

/** An obligation's chain as the engine works it out (Workspace.chains): what designs, builds and proves it. */
const chainOf = (index: SpecIndex, id: string) => index.chains.get(id) ?? { design: [], build: [], tests: [] };

/** The tests of an obligation (its children of the test plan); for a pattern rule with a domain given, those naming that domain. */
const testsOf = (index: SpecIndex, record: SpecRecord, domain?: string) =>
  childrenInStage(index, record.id, 'test-plan').filter((t) => !domain || record.kind !== 'pattern_rule' || textOf(t.row, 'domain_id') === domain);

/** An obligation's tests not automated yet (in one domain, for a pattern rule): meant as proof, not proof yet. */
export const notAutomatedTestsOf = (index: SpecIndex, record: SpecRecord, domain?: string): string[] =>
  sortIds(testsOf(index, record, domain).filter((t) => textOf(t.row, 'state') === 'not automated yet').map((t) => t.id));

/**
 * Where an obligation is owed: its own domain (for one under a record with no owner, the one domain using it); for
 * what the product shares (a standard rule, a view requirement of a view two domains use) its product; for a pattern
 * rule each domain where the engine's coverage says it is owed (Coverage.pattern_rules).
 */
export function owingDomains(index: SpecIndex, record: SpecRecord): string[] {
  if (record.domain) return [record.domain];
  if (record.kind !== 'pattern_rule') return record.product ? [record.product] : [];
  return index.workspace.coverage
    .filter((c) => c.domain !== null && c.product === record.product && c.pattern_rules[record.id] === 'owed')
    .map((c) => c.domain as string)
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
}

/** How one domain stands on an obligation, with the gaps coverage reports there (or the tree shows, when coverage has none). */
export function judge(index: SpecIndex, record: SpecRecord, domain: string): Judgment {
  const needsDesign = record.kind !== 'pattern_rule';
  const chain = chainOf(index, record.id);
  const designedBy = needsDesign ? chain.design : [];
  const builtBy = needsDesign ? chain.build.filter((id) => isBuilt(index, id)) : [];
  const provedBy = provedByOf(index, record.id, domain);
  const notAutomatedBy = notAutomatedTestsOf(index, record, domain);
  const coverage = index.coverage.get(domain);
  const missing = new Set((coverage?.gaps ?? []).filter((g) => g.id === record.id).map((g) => g.missing));
  const designed = coverage ? !missing.has('designed') : designedBy.length + chain.build.length > 0;
  const built = coverage ? !missing.has('built') : builtBy.length > 0;
  const proved = provedBy.length > 0;
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
  runBy: {
    level: string; state: string; file: string | null; missing: boolean; manualReason: string | null;
    /** Its size: small when the test gives none, volume or worst case. */
    size: string;
    /** Its markers, smoke and external, those it sets. */
    markers: string[];
  } | null;
}

/**
 * A record's traceability, by kind:
 * - an obligation: Designed by, Built by (Met by, for a standard rule) and Proved by, from its chain, then its other
 *   links in and out to what the chain does not show;
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
    // Its chain as groups, then the links to what the chain does not hold.
    const chain = chainOf(index, record.id);
    const held = new Set([...chain.design, ...chain.build, ...chain.tests]);
    const group = (key: TraceRole, label: string, ids: string[]): TraceGroup[] => (ids.length > 0 ? [{ key, label, role: key, ids }] : []);
    trace.groups = [
      ...group('design', 'Designed by', chain.design),
      // A standard rule is met, in its relation's own words, by what follows it.
      ...group('build', record.kind === 'standard_rule' ? 'Met by' : 'Built by', chain.build),
      ...group('proof', 'Proved by', chain.tests),
      ...grouped(index, into.filter((l) => !held.has(l.source)), 'target'),
      ...grouped(index, out.filter((l) => !held.has(l.target)), 'source'),
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

  if (isTestKind(index, record.kind)) {
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
      size: textOf(record.row, 'size').trim() || 'small',
      markers: (['smoke', 'external'] as const).filter((m) => record.row[m] === true),
    };
    return trace;
  }

  trace.groups = [...grouped(index, out, 'source'), ...grouped(index, into, 'target')];
  return trace;
}

/** Whether a trace has nothing to show. */
export const traceEmpty = (t: Trace) => t.groups.length === 0 && t.judgments.length === 0 && t.requirements.length === 0 && !t.runBy;