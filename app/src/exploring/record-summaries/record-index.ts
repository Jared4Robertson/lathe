import type { RecordSummaries, RecordSummary, SummaryLink } from '../../../../lathe/src/exploring/record-summaries/read-model';
import type { ListedProblem, ProductProblems } from '../../../../lathe/src/checking/problems/read-model';
import type { ProductCoverage, ScopeCoverage } from '../../../../lathe/src/traceability/coverage/read-model';
import type { FolderTree } from '../../../../lathe/src/exploring/folder-tree/read-model';
import type { MetaIndex } from '../../platform/meta-model/reads';

export type { ListedProblem, RecordSummary, SummaryLink };

// A product's space as its pages name its records (the Record page pattern): the records of the Record summaries read
// (LA-EXP-RM01, list-record-summaries) by ID, with their children and their links both ways; each record's problems
// from the Problems read (LA-CHK-RM01, list-problems) and its gaps from the Coverage read (LA-TRC-RM01, get-coverage);
// the meta model (LA-PLT-RM08) that names their kinds; and the Folder tree (LA-EXP-RM02) the nav and the graph read. It holds no column of a record beyond its summary: a page
// reads its record's fields through its aggregate's own query, a stage its own read (the folder tree, the ERD, the
// traces). Built once per answer, so a page that passes it as its reads' version reads again after every reload.

export interface RecordIndex {
  /** The product whose space this is. */
  product: string;
  meta: MetaIndex;
  byId: Map<string, RecordSummary>;
  /** Each record's children, in ID order. */
  children: Map<string, RecordSummary[]>;
  outgoing: Map<string, SummaryLink[]>;
  incoming: Map<string, SummaryLink[]>;
  /** Each record's problems, errors first. */
  problemsFor: Map<string, ListedProblem[]>;
  /** Each record's gaps as coverage names them (designed, built, proved, or a gap rule's name). */
  gapsFor: Map<string, string[]>;
  /** The product's coverage, by scope: its own (the product's ID) and each domain's. */
  coverage: Map<string, ScopeCoverage>;
  /** The space's domains, in ID order. */
  domains: RecordSummary[];
  /** The space's folder tree (LA-EXP-RM02, get-folder-tree): what the nav, Quick open and the graph's tree read. */
  folders: FolderTree;
}

const push = <K, V>(map: Map<K, V[]>, key: K, value: V) => {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
};

// ID order, with the numbers inside IDs compared by value (UC2 before UC10): one collator, made once, since
// `localeCompare` with options builds one on every comparison.
const idCollator = new Intl.Collator('en', { numeric: true });

/** Two IDs in ID order. */
export const compareIds = (a: string, b: string): number => idCollator.compare(a, b);

export const byIdOrder = (a: { id: string }, b: { id: string }) => idCollator.compare(a.id, b.id);

/** The answer's records, each as its summary: the answer names its columns once and gives each record's values in their order. */
function summariesOf(answer: RecordSummaries): RecordSummary[] {
  return answer.records.map((values) => {
    const summary: Record<string, unknown> = {};
    answer.columns.forEach((column, at) => { summary[column] = values[at]; });
    return summary as unknown as RecordSummary;
  });
}

/** The space's index from its reads; problems and coverage are empty until they are read. */
export function buildRecordIndex(meta: MetaIndex, summaries: RecordSummaries, folders: FolderTree, problems: ProductProblems | null, coverage: ProductCoverage | null): RecordIndex {
  const records = summariesOf(summaries);
  const byId = new Map(records.map((r) => [r.id, r]));
  const children = new Map<string, RecordSummary[]>();
  for (const r of records) if (r.parent) push(children, r.parent, r);
  const outgoing = new Map<string, SummaryLink[]>();
  const incoming = new Map<string, SummaryLink[]>();
  for (const l of summaries.links) { push(outgoing, l.source, l); push(incoming, l.target, l); }
  const problemsFor = new Map<string, ListedProblem[]>();
  for (const group of [...(problems?.own ?? []), ...(problems?.workspace ?? [])]) for (const p of group.problems) if (p.record) push(problemsFor, p.record, p);
  for (const list of problemsFor.values()) list.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1));
  const gapsFor = new Map<string, string[]>();
  const scopes = new Map<string, ScopeCoverage>();
  for (const s of coverage?.scopes ?? []) {
    scopes.set(s.domain ?? summaries.product, s);
    for (const g of s.gaps) push(gapsFor, g.id, g.missing);
  }
  return {
    product: summaries.product,
    meta,
    byId,
    children,
    outgoing,
    incoming,
    problemsFor,
    gapsFor,
    coverage: scopes,
    domains: records.filter((r) => r.kind === 'domain' && r.product === summaries.product),
    folders,
  };
}

/** A kind's label ("Use case"), or its name in words for a kind the meta model does not know. */
export const kindLabel = (index: RecordIndex, kind: string): string => index.meta.kinds.get(kind)?.label ?? kind.replaceAll('_', ' ');

/** The gaps coverage records for one record. */
export const gapsOf = (index: RecordIndex, id: string): string[] => index.gapsFor.get(id) ?? [];

/** Errors before warnings, then by check name and record. */
export const problemOrder = (a: ListedProblem, b: ListedProblem) =>
  (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1) ||
  a.check.localeCompare(b.check) ||
  compareIds(a.record ?? '', b.record ?? '');

/** The product an ID belongs to: the longest product ID it is or starts with (followed by a hyphen), or null. */
export function productOfId(products: readonly string[], id: string): string | null {
  return products.filter((p) => id === p || id.startsWith(`${p}-`)).sort((a, b) => b.length - a.length)[0] ?? null;
}
