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
// traces). Built by layer (the records, the problems, the coverage), each when its own read changes, so a page that passes it as its reads' version reads again after every reload.

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

/** The space's records and links, the layer of the index that only the record summaries read decides. */
export interface Records {
  product: string;
  byId: Map<string, RecordSummary>;
  children: Map<string, RecordSummary[]>;
  outgoing: Map<string, SummaryLink[]>;
  incoming: Map<string, SummaryLink[]>;
  domains: RecordSummary[];
  /** The answer's links, kept to tell a later answer's links are the same. */
  links: readonly SummaryLink[];
}

const sameLink = (a: SummaryLink, b: SummaryLink) => a.source === b.source && a.relation === b.relation && a.target === b.target;

function linksOf(links: readonly SummaryLink[]): Pick<Records, 'outgoing' | 'incoming'> {
  const outgoing = new Map<string, SummaryLink[]>();
  const incoming = new Map<string, SummaryLink[]>();
  for (const l of links) { push(outgoing, l.source, l); push(incoming, l.target, l); }
  return { outgoing, incoming };
}

/**
 * The space's records from the record summaries answer, by what changed since the records of the answer before
 * (`previous`): a record whose every column is the same stays the very object it was, so what is keyed by it stays
 * valid; when only such records changed, in place (same ID, parent, kind, product), the lookups are the earlier ones
 * with those records put in their places, not built again, and when nothing changed the earlier records are returned
 * as they were. Any other change (a record added or removed, one moved under another parent) builds the lookups afresh,
 * still reusing the unchanged records. The result is the same as building from the answer alone.
 */
export function recordsOf(answer: RecordSummaries, previous: Records | null): Records {
  const before = previous?.product === answer.product ? previous : null;
  const { columns } = answer;
  const idAt = columns.indexOf('id');
  const parentAt = columns.indexOf('parent');
  const kindAt = columns.indexOf('kind');
  const productAt = columns.indexOf('product');
  const records: RecordSummary[] = new Array(answer.records.length);
  const replaced: RecordSummary[] = [];
  let added = before ? 0 : 1;
  const width = columns.length;
  for (let row = 0; row < answer.records.length; row++) {
    const values = answer.records[row];
    const old = before?.byId.get(values[idAt] as string);
    if (old) {
      let at = 0;
      while (at < width && old[columns[at]] === values[at]) at++;
      if (at === width) { records[row] = old; continue; }
    }
    const summary: Record<string, unknown> = {};
    for (let at = 0; at < width; at++) summary[columns[at]] = values[at];
    const record = summary as unknown as RecordSummary;
    records[row] = record;
    if (!old || old.parent !== values[parentAt] || old.kind !== values[kindAt] || old.product !== values[productAt]) added++;
    else replaced.push(record);
  }
  let sameLinks = !!before && before.links.length === answer.links.length;
  for (let at = 0; sameLinks && at < answer.links.length; at++) sameLinks = sameLink(answer.links[at], before!.links[at]);
  const stays = !!before && added === 0 && records.length === before.byId.size;
  if (before && stays && replaced.length === 0 && sameLinks) return before;
  const lookups = sameLinks && before ? before : linksOf(answer.links);
  if (before && stays) {
    const byId = new Map(before.byId);
    const children = new Map(before.children);
    for (const r of replaced) {
      byId.set(r.id, r);
      if (r.parent) children.set(r.parent, children.get(r.parent)!.map((c) => (c.id === r.id ? r : c)));
    }
    const put = new Map(replaced.map((r) => [r.id, r]));
    const domains = replaced.some((r) => r.kind === 'domain') ? before.domains.map((d) => put.get(d.id) ?? d) : before.domains;
    return { product: answer.product, byId, children, outgoing: lookups.outgoing, incoming: lookups.incoming, domains, links: answer.links };
  }
  const children = new Map<string, RecordSummary[]>();
  for (const r of records) if (r.parent) push(children, r.parent, r);
  return {
    product: answer.product,
    byId: new Map(records.map((r) => [r.id, r])),
    children,
    outgoing: lookups.outgoing,
    incoming: lookups.incoming,
    domains: records.filter((r) => r.kind === 'domain' && r.product === answer.product),
    links: answer.links,
  };
}

/** Each record's problems, errors first. */
export function problemsOf(problems: ProductProblems | null): Map<string, ListedProblem[]> {
  const problemsFor = new Map<string, ListedProblem[]>();
  for (const group of [...(problems?.own ?? []), ...(problems?.workspace ?? [])]) for (const p of group.problems) if (p.record) push(problemsFor, p.record, p);
  for (const list of problemsFor.values()) list.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1));
  return problemsFor;
}

/** The product's coverage by scope and each record's gaps. */
export function coverageOf(product: string, coverage: ProductCoverage | null): { scopes: Map<string, ScopeCoverage>; gapsFor: Map<string, string[]> } {
  const gapsFor = new Map<string, string[]>();
  const scopes = new Map<string, ScopeCoverage>();
  for (const s of coverage?.scopes ?? []) {
    scopes.set(s.domain ?? product, s);
    for (const g of s.gaps) push(gapsFor, g.id, g.missing);
  }
  return { scopes, gapsFor };
}

/** The space's index from its layers: the records, the folder tree and the meta model, the problems and the coverage (empty until read). */
export function indexOf(meta: MetaIndex, records: Records, folders: FolderTree, problemsFor: RecordIndex['problemsFor'], coverage: ReturnType<typeof coverageOf>): RecordIndex {
  return {
    product: records.product,
    meta,
    byId: records.byId,
    children: records.children,
    outgoing: records.outgoing,
    incoming: records.incoming,
    problemsFor,
    gapsFor: coverage.gapsFor,
    coverage: coverage.scopes,
    domains: records.domains,
    folders,
  };
}

/** The space's index from its reads, all at once (the app builds it by layer, each when its read changes). */
export function buildRecordIndex(meta: MetaIndex, summaries: RecordSummaries, folders: FolderTree, problems: ProductProblems | null, coverage: ProductCoverage | null): RecordIndex {
  return indexOf(meta, recordsOf(summaries, null), folders, problemsOf(problems), coverageOf(summaries.product, coverage));
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
