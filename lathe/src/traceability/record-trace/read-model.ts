// The Record trace read model (LA-TRC-RM06), shaped for the Record page pattern's Traceability section: for an
// obligation its chain as the engine works it out (what designs it, the technical records that build it, each marked
// built or not, and the tests that prove it) and how each domain owing it stands on it, with the gaps coverage reports
// there; for a use case its UC requirements, each judged in its domain; for a test what it proves and how it is run;
// and for every record its other links both ways, by relation, with their words. Chains, coverage and problems are the
// checks' run's, so the projection reads the run the query runner was given (`ReadView.checked`) and the rows. It is
// the only code that reads them for the query and the only code that writes the read model's table.
import type { ReadView } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import { placeRecords, type Placed } from '../../exploring/placement.ts';
import { compareIds } from '../../platform/data/ids.ts';

export type GapKind = 'not-designed' | 'not-built' | 'not-proved' | 'not-automated';

/** A gap and the check that reports it. */
export interface TraceGap { kind: GapKind; check: string }

/** An obligation as one domain (or the product) owes it. */
export interface Judgment {
  domain: string;
  /** Whether it must be designed and built (a pattern rule is proved only). */
  needsDesign: boolean;
  designedBy: string[];
  /** Its chain's build records that name a file that exists. */
  builtBy: string[];
  /** The tests that count as its proof there, as coverage says. */
  provedBy: string[];
  /** Its tests not automated yet. */
  notAutomatedBy: string[];
  gaps: TraceGap[];
}

/** One group of the chain: Designed by, Built by (Met by, for a standard rule), Proved by. */
export interface ChainGroup {
  role: 'design' | 'build' | 'proof';
  label: string;
  ids: string[];
}

/** One relation's links one way, with their words read from this record's end. */
export interface LinkGroup {
  direction: 'out' | 'in';
  relation: string;
  label: string;
  ids: string[];
}

/** How a test is run. */
export interface RunBy {
  level: string;
  state: string;
  file: string | null;
  missing: boolean;
  manualReason: string | null;
  size: string;
  markers: string[];
}

/** One record's traceability. */
export interface RecordTrace {
  id: string;
  /** For an obligation: its chain's groups. */
  chain: ChainGroup[];
  /** The technical records of its chain that are built: they name a file and no check reports it missing. */
  built: string[];
  /** For an obligation: how each owing domain stands on it. */
  judgments: Judgment[];
  /** For a use case: its UC requirements, each with its group heading and its judgment in the use case's domain. */
  requirements: { id: string; group: string | null; judgment: Judgment | null }[];
  /** For a test: what it proves (its parent), or null. */
  proves: string | null;
  runBy: RunBy | null;
  /** Its links to what its chain does not hold, by direction and relation. */
  links: LinkGroup[];
}

/** The read model's table, kept in memory: each record's trace, worked out when it is asked for. */
export interface RecordTraceTable {
  traceOf(id: string): RecordTrace | undefined;
}

const sortIds = (ids: Iterable<string>) => [...new Set(ids)].sort(compareIds);
const str = (row: Row, column: string) => (typeof row[column] === 'string' ? (row[column] as string) : '');

/** The projection: the read model's table over the rows and the checks' run (in memory; nothing keeps it). */
export function recordTraceTableFrom(view: ReadView): RecordTraceTable {
  const { schema } = view;
  const run = view.checked;
  let placed: Map<string, Placed> | null = null;
  let children: Map<string, Placed[]> | null = null;
  let links: { source: string; relation: string; target: string }[] | null = null;
  const load = () => {
    if (placed) return;
    placed = placeRecords(view);
    children = new Map();
    for (const r of placed.values()) if (r.parent) children.set(r.parent, [...(children.get(r.parent) ?? []), r]);
    links = Object.values(schema.tables).filter((t) => t.role === 'link').flatMap((t) => view.rows(t.name).map((row) => ({ source: String(row.source_id), relation: t.name, target: String(row.target_id) })));
  };
  const chains = new Map((run?.chains ?? []).map((c) => [c.obligation, c]));
  const coverage = new Map((run?.coverage ?? []).map((c) => [c.domain ?? c.product, c]));
  const problems = new Map<string, Set<string>>();
  for (const p of run?.problems ?? []) if (p.record) problems.set(p.record, (problems.get(p.record) ?? new Set()).add(p.check));
  // A test: a test-plan kind with a run by (a test data set is in the test plan, and not a test).
  const isTestKind = (kind: string) => schema.kinds[kind]?.stage === 'test-plan' && !!schema.tables[kind]?.columns.some((c) => c.name === 'state' && c.required);
  const relationLabel = (relation: string, from: 'out' | 'in') => {
    const r = schema.relations[relation];
    const words = from === 'out' ? r?.forwardLabel : r?.reverseLabel;
    if (words?.trim()) return words.trim();
    const code = relation.replaceAll('_', ' ');
    return code.charAt(0).toUpperCase() + code.slice(1);
  };

  const isBuilt = (id: string) => {
    const r = placed!.get(id);
    return !!r && str(r.row, 'file').trim() !== '' && !problems.get(id)?.has('technical-file-missing');
  };
  const testsOf = (record: Placed, domain?: string) =>
    (children!.get(record.id) ?? []).filter((c) => schema.kinds[c.kind]?.stage === 'test-plan' && (!domain || record.kind !== 'pattern_rule' || str(c.row, 'domain_id') === domain));
  const owingDomains = (record: Placed): string[] => {
    if (record.domain) return [record.domain];
    if (record.kind !== 'pattern_rule') return record.product ? [record.product] : [];
    return sortIds((run?.coverage ?? []).filter((c) => c.domain !== null && c.product === record.product && c.pattern_rules.includes(record.id)).map((c) => c.domain as string));
  };
  const judge = (record: Placed, domain: string): Judgment => {
    const needsDesign = record.kind !== 'pattern_rule';
    const chain = chains.get(record.id);
    const designedBy = needsDesign ? [...(chain?.design ?? [])] : [];
    const builtBy = needsDesign ? (chain?.build ?? []).filter(isBuilt) : [];
    const scope = coverage.get(domain);
    const provedBy = [...(scope?.proved_by[record.id] ?? [])];
    const notAutomatedBy = sortIds(testsOf(record, domain).filter((t) => str(t.row, 'state') === 'not automated yet').map((t) => t.id));
    const missing = new Set((scope?.gaps ?? []).filter((g) => g.id === record.id).map((g) => g.missing));
    const designed = scope ? !missing.has('designed') : designedBy.length + (chain?.build.length ?? 0) > 0;
    const built = scope ? !missing.has('built') : builtBy.length > 0;
    const gaps: TraceGap[] = [];
    if (needsDesign && !designed) gaps.push({ kind: 'not-designed', check: 'not-designed' });
    if (needsDesign && designed && !built) gaps.push({ kind: 'not-built', check: 'not-built' });
    if (provedBy.length === 0) gaps.push({ kind: notAutomatedBy.length > 0 ? 'not-automated' : 'not-proved', check: 'not-proved' });
    return { domain, needsDesign, designedBy, builtBy, provedBy, notAutomatedBy, gaps };
  };
  const linkGroups = (id: string, held: ReadonlySet<string>): LinkGroup[] => {
    const groups = new Map<string, LinkGroup>();
    for (const l of links!) {
      const direction = l.source === id ? 'out' : l.target === id ? 'in' : null;
      if (!direction) continue;
      const other = direction === 'out' ? l.target : l.source;
      if (held.has(other)) continue;
      const key = `${direction}:${l.relation}`;
      const group = groups.get(key) ?? { direction, relation: l.relation, label: relationLabel(l.relation, direction), ids: [] };
      group.ids.push(other);
      groups.set(key, group);
    }
    return [...groups.values()].map((g) => ({ ...g, ids: sortIds(g.ids) })).sort((a, b) => (a.direction === b.direction ? 0 : a.direction === 'in' ? -1 : 1) || a.label.localeCompare(b.label));
  };

  return {
    traceOf(id) {
      load();
      const record = placed!.get(id);
      if (!record) return undefined;
      const trace: RecordTrace = { id, chain: [], built: [], judgments: [], requirements: [], proves: null, runBy: null, links: [] };
      if (schema.kinds[record.kind]?.obligation) {
        const chain = chains.get(id);
        const group = (role: ChainGroup['role'], label: string, ids: readonly string[]): ChainGroup[] => (ids.length > 0 ? [{ role, label, ids: [...ids] }] : []);
        trace.chain = [
          ...group('design', 'Designed by', chain?.design ?? []),
          ...group('build', record.kind === 'standard_rule' ? 'Met by' : 'Built by', chain?.build ?? []),
          ...group('proof', 'Proved by', chain?.tests ?? []),
        ];
        trace.built = (chain?.build ?? []).filter(isBuilt);
        trace.judgments = owingDomains(record).map((d) => judge(record, d));
        trace.links = linkGroups(id, new Set([...(chain?.design ?? []), ...(chain?.build ?? []), ...(chain?.tests ?? [])]));
        return trace;
      }
      if (record.kind === 'use_case') {
        trace.requirements = sortIds((children!.get(id) ?? []).filter((c) => c.kind === 'uc_requirement').map((c) => c.id)).map((rid) => {
          const r = placed!.get(rid)!;
          return { id: rid, group: str(r.row, 'group_name').trim() || null, judgment: r.domain ? judge(r, r.domain) : null };
        });
      } else if (isTestKind(record.kind)) {
        const file = str(record.row, 'file').trim() || null;
        trace.proves = record.parent;
        trace.runBy = {
          level: str(record.row, 'level'),
          state: str(record.row, 'state'),
          file,
          missing: !!file && !!problems.get(id)?.has('test-file-missing'),
          manualReason: str(record.row, 'manual_reason').trim() || null,
          size: str(record.row, 'size').trim() || 'small',
          markers: (['smoke', 'external'] as const).filter((m) => record.row[m] === true),
        };
      }
      trace.links = linkGroups(id, new Set());
      return trace;
    },
  };
}
