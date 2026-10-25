import { byIdOrder, type SpecIndex, type SpecLink, type SpecRecord } from './data';
import { linkLabel, roleOf } from './labels';
import { patternsFollowedBy, ruleStatus } from './patterns';
import { SUPPORT_RELATIONS } from './folders';

// What a record's Traceability section shows (LA-BRW-UC118): its links grouped and titled by their
// labels, in an order that depends only on the meta-model (the relations' `design` and `proof`
// roles, and whether the kind is an obligation), and, for an obligation, the gaps coverage finds in
// it. The gaps are coverage's own judgment (its gaps per domain, and a component's file found or
// not), so this section never disagrees with the coverage marks or the checks. Pure logic, tested
// directly; Traceability.tsx draws it.

export type TraceRole = 'design' | 'proof' | 'support' | 'plain';

export interface TraceGroup {
  /** Stable: the direction and the label. */
  key: string;
  /** The links' label, read from this record's end: "Designed by", "Proves". */
  label: string;
  /** What the group's rows show besides the record: a built mark, a test's state. */
  role: TraceRole;
  ids: string[];
}

export type GapKind = 'not-designed' | 'not-built' | 'not-proved' | 'only-planned';

export interface TraceGap {
  kind: GapKind;
  /** The check that reports the gap, whose page the callout links to. */
  check: string;
}

/** An obligation as one domain owes it: what in that domain (or anywhere, for its own domain) designs, builds and proves it. */
export interface Judgment {
  domain: string;
  needsDesign: boolean;
  designedBy: string[];
  builtBy: string[];
  provedBy: string[];
  plannedBy: string[];
  gaps: TraceGap[];
}

const sortIds = (ids: Iterable<string>) => [...new Set(ids)].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

/** A component counts as built when it names a file and the component-file-missing check does not report it. */
export function isBuilt(index: SpecIndex, id: string): boolean {
  const record = index.byId.get(id);
  if (!record || record.kind !== 'component' || !record.fields.file?.trim()) return false;
  return !(index.problemsFor.get(id) ?? []).some((p) => p.check === 'component-file-missing');
}

const stateOf = (r: SpecRecord) => r.fields.state?.trim().toLowerCase() || 'automated';

/** The domains that owe an obligation: its own, or for a pattern rule each domain following its pattern where it applies. */
export function owingDomains(index: SpecIndex, record: SpecRecord): string[] {
  if (record.domain) return [record.domain];
  if (record.kind !== 'pattern_rule' || !record.parent) return [];
  const domains = index.workspace.records.filter((d) => d.kind === 'domain');
  return domains
    .filter((d) => {
      const followed = patternsFollowedBy(index, d.id).find((f) => f.pattern.id === record.parent);
      return followed && ruleStatus(index, record, d.id, followed.byDomain ? [] : followed.useCases).applies;
    })
    .map((d) => d.id)
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
}

/** How one domain stands on an obligation, with the gaps coverage reports there. */
export function judge(index: SpecIndex, record: SpecRecord, domain: string): Judgment {
  const kind = index.kinds.get(record.kind);
  const needsDesign = !!kind?.obligation && !kind.proof_only;
  // An obligation in a domain may be designed and proved from anywhere; a pattern rule only from within each domain owing it.
  const perDomain = !record.domain;
  const designedBy: string[] = [];
  const provedBy: string[] = [];
  const plannedBy: string[] = [];
  for (const l of index.incoming.get(record.id) ?? []) {
    const source = index.byId.get(l.source);
    if (!source || (perDomain && source.domain !== domain)) continue;
    const role = roleOf(index, l);
    if (role === 'design') designedBy.push(source.id);
    if (role === 'proof') (stateOf(source) === 'planned' ? plannedBy : provedBy).push(source.id);
  }
  const builtBy = designedBy.filter((id) => isBuilt(index, id));
  const coverage = index.coverage.get(domain);
  // Coverage's gaps decide designed and proved (they count only proof a test's file backs); with no
  // coverage for the domain, the links decide.
  const missing = new Set((coverage?.gaps ?? []).filter((g) => g.id === record.id).map((g) => g.missing));
  const designed = coverage ? !missing.has('satisfies') : designedBy.length > 0;
  const proved = coverage ? !missing.has('proves') : provedBy.length > 0;
  const gaps: TraceGap[] = [];
  if (needsDesign && !designed) gaps.push({ kind: 'not-designed', check: 'unsatisfied' });
  if (needsDesign && designed && builtBy.length === 0) gaps.push({ kind: 'not-built', check: 'component-file-missing' });
  if (!proved) gaps.push({ kind: plannedBy.length > 0 ? 'only-planned' : 'not-proved', check: 'unproved' });
  return { domain, needsDesign, designedBy: sortIds(designedBy), builtBy: sortIds(builtBy), provedBy: sortIds(provedBy), plannedBy: sortIds(plannedBy), gaps };
}

/** What a role ranks as in an obligation's groups: design, proof, support, carried out in, applied by, then the rest. */
function incomingRank(index: SpecIndex, l: SpecLink): { rank: number; role: TraceRole } {
  const role = roleOf(index, l);
  if (role === 'design') return { rank: 0, role: 'design' };
  if (role === 'proof') return { rank: 1, role: 'proof' };
  if (SUPPORT_RELATIONS.has(l.relation)) return { rank: 2, role: 'support' };
  if (l.relation === 'fulfills') return { rank: 3, role: 'plain' };
  if (l.relation === 'applies') return { rank: 4, role: 'plain' };
  return { rank: 5, role: 'plain' };
}

/**
 * Links grouped by their label read from this record's end, ranked: groups of a lower rank first,
 * then by label. An empty group never appears.
 */
function grouped(index: SpecIndex, links: readonly SpecLink[], from: 'source' | 'target', rankOf: (l: SpecLink) => { rank: number; role: TraceRole }): TraceGroup[] {
  const groups = new Map<string, { label: string; rank: number; role: TraceRole; ids: Set<string> }>();
  for (const l of links) {
    const label = linkLabel(index, l, from);
    const { rank, role } = rankOf(l);
    const g = groups.get(label) ?? { label, rank, role, ids: new Set<string>() };
    g.rank = Math.min(g.rank, rank);
    g.ids.add(from === 'source' ? l.target : l.source);
    groups.set(label, g);
  }
  return [...groups.values()]
    .sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label))
    .map((g) => ({ key: `${from === 'source' ? 'out' : 'in'}:${g.label}`, label: g.label, role: g.role, ids: sortIds(g.ids) }));
}

const plain = () => ({ rank: 0, role: 'plain' as TraceRole });

export interface Trace {
  groups: TraceGroup[];
  /** For an obligation: how each owing domain stands on it. */
  judgments: Judgment[];
  /** For a use case: its UC requirements, each judged in the use case's domain. */
  requirements: { record: SpecRecord; judgment: Judgment | null }[];
  /** For a test: the file that runs it. */
  runBy: { file: string; missing: boolean } | null;
}

/**
 * A record's traceability, by kind:
 * - an obligation: Designed by, Proved by, Supported by, Carried out in, Applied by, then its other
 *   incoming links; and its judgment in each domain owing it;
 * - a use case: its requirements (judged), then Carried out by flow, Follows, Applies, then the rest;
 * - a component: Satisfies (what it designs), Proved through (the tests proving those), then the rest;
 * - a test: Proves, Supports, and the file that runs it, then the rest;
 * - anything else: links out under their forward labels, then links in under their reverse labels.
 * `skip` leaves out relations a page already shows in a section of its own.
 */
export function traceOf(index: SpecIndex, record: SpecRecord, skip: ReadonlySet<string> = new Set()): Trace {
  const kind = index.kinds.get(record.kind);
  const out = (index.outgoing.get(record.id) ?? []).filter((l) => !skip.has(`out:${l.relation}`));
  const into = (index.incoming.get(record.id) ?? []).filter((l) => !skip.has(`in:${l.relation}`));
  const trace: Trace = { groups: [], judgments: [], requirements: [], runBy: null };

  if (kind?.obligation) {
    trace.groups = grouped(index, into, 'target', (l) => incomingRank(index, l));
    trace.judgments = owingDomains(index, record).map((d) => judge(index, record, d));
    return trace;
  }

  if (record.kind === 'use_case') {
    trace.requirements = (index.children.get(record.id) ?? [])
      .filter((c) => index.kinds.get(c.kind)?.obligation)
      .sort(byIdOrder)
      .map((r) => ({ record: r, judgment: r.domain ? judge(index, r, r.domain) : null }));
    const outRank = (l: SpecLink) => ({ rank: l.relation === 'follows' ? 1 : l.relation === 'applies' ? 2 : 3, role: 'plain' as TraceRole });
    // Carried out by flow comes first, then what it follows and applies, then the rest.
    trace.groups = [
      ...grouped(index, into.filter((l) => l.relation === 'carries_out'), 'target', plain),
      ...grouped(index, out, 'source', outRank),
      ...grouped(index, into.filter((l) => l.relation !== 'carries_out'), 'target', plain),
    ];
    return trace;
  }

  if (record.kind === 'component') {
    const designs = out.filter((l) => roleOf(index, l) === 'design');
    const satisfies = grouped(index, designs, 'source', plain);
    const proving = new Set<string>();
    for (const l of designs) {
      for (const p of index.incoming.get(l.target) ?? []) if (roleOf(index, p) === 'proof') proving.add(p.source);
    }
    trace.groups = [
      ...satisfies,
      ...(proving.size > 0 ? [{ key: 'through:proof', label: 'Proved through', role: 'proof' as TraceRole, ids: sortIds(proving) }] : []),
      ...grouped(index, out.filter((l) => roleOf(index, l) !== 'design'), 'source', plain),
      ...grouped(index, into, 'target', plain),
    ];
    return trace;
  }

  if (record.kind === 'test') {
    const rank = (l: SpecLink) => ({ rank: roleOf(index, l) === 'proof' ? 0 : SUPPORT_RELATIONS.has(l.relation) ? 1 : 2, role: 'plain' as TraceRole });
    trace.groups = [...grouped(index, out, 'source', rank), ...grouped(index, into, 'target', plain)];
    const file = record.fields.run_by?.trim();
    if (file) trace.runBy = { file, missing: (index.problemsFor.get(record.id) ?? []).some((p) => p.check === 'test-file-missing') };
    return trace;
  }

  trace.groups = [...grouped(index, out, 'source', plain), ...grouped(index, into, 'target', plain)];
  return trace;
}

/** Whether a trace has nothing to show. */
export const traceEmpty = (t: Trace) => t.groups.length === 0 && t.judgments.length === 0 && t.requirements.length === 0 && !t.runBy;
