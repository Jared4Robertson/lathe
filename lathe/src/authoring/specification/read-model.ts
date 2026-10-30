// The Specification aggregate's read model (LA-AUT-RM25), shaped for its readers: the Specification page reads a
// specification whole (the aggregates it reads, its predicate with the standard rules it meets and the packages it
// uses, its test with the test data sets it starts from) with the record the page is about, a domain's list reads each
// specification's ID and title, and the editor's next ID reads the IDs in use. The projection (specificationTableFrom)
// is the only code that reads the source rows and the only code that writes the read model's table; the query
// handlers read that table only through the reader (reader.ts). Nothing here is the aggregate's own instance type.
import type { ReadView } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { PredicateRow, SpecificationRow, SpecificationTestRow } from '../../platform/data/tables.ts';
import type { SpecificationKind } from './model.ts';
import { byRecordId } from '../../platform/data/ids.ts';

/** The predicate as the page shows it: its row, the standard rules it meets and the packages it uses. */
export interface PredicateOnPage {
  predicate: PredicateRow;
  meets: string[];
  packages: string[];
}

/** The specification test as the page shows it: its row and the test data sets it starts from. */
export interface SpecificationTestOnPage {
  test: SpecificationTestRow;
  startsFrom: string[];
}

/** A specification whole, as its page shows it. */
export interface SpecificationTree {
  specification: SpecificationRow;
  /** The domain its ID names. */
  domain: string;
  /** The aggregates it reads, by ID. */
  reads: string[];
  /** Its predicate in code, if written. */
  predicate: PredicateOnPage | null;
  /** Its test, if written. */
  test: SpecificationTestOnPage | null;
}

/** A specification as its page reads it, with the record of it the page is about. */
export interface SpecificationPage extends SpecificationTree {
  record: { id: string; kind: SpecificationKind };
}

/** A specification as a domain's list reads it. */
export interface SpecificationSummary {
  id: string;
  title: string;
}

/** The read model's table, kept in memory: what the reader reads, and all it reads. */
export interface SpecificationTable {
  /** Each specification whole, by its ID. */
  specifications: Map<string, SpecificationTree>;
  /** Each record inside a specification: the specification that holds it and its kind there. */
  holding: Map<string, { root: string; kind: SpecificationKind }>;
  /** Each domain's specifications, by ID; a domain with none has an empty list. */
  domains: Map<string, SpecificationSummary[]>;
  /** Every record ID in use, with its kind: what a next ID is one past, and what a refusal names. */
  kinds: Map<string, string>;
}

/** A link table's other ends by one column, each list sorted. */
function linked(rows: Row[], by: string, other: string): (id: string) => string[] {
  const found = new Map<string, string[]>();
  for (const r of rows) found.set(String(r[by]), [...(found.get(String(r[by])) ?? []), String(r[other])]);
  return (id) => [...(found.get(id) ?? [])].sort();
}

/** Rows by their parent's ID: one each, as a specification has one predicate and one test. */
function byParent<T>(rows: Row[], column: string): Map<string, T> {
  return new Map(rows.map((r) => [String(r[column]), r as unknown as T]));
}

/** The projection: the read model's table, built from the rows on each read (in memory; nothing keeps it). */
export function specificationTableFrom(view: ReadView): SpecificationTable {
  const reads = linked(view.rows('reads'), 'source_id', 'target_id');
  const meets = linked(view.rows('meets'), 'source_id', 'target_id');
  const startsFrom = linked(view.rows('starts_from'), 'source_id', 'target_id');
  const packages = linked(view.rows('package_use'), 'record_id', 'package');
  const predicates = byParent<PredicateRow>(view.rows('predicate'), 'specification_id');
  const tests = byParent<SpecificationTestRow>(view.rows('specification_test'), 'specification_id');
  // A specification's domain is the longest domain ID its own ID starts with, and a hyphen.
  const domainIds = view.rows('domain').map((d) => String(d.id)).sort((a, b) => b.length - a.length);
  const domainOf = (id: string) => domainIds.find((d) => id.startsWith(`${d}-`)) ?? '';
  const specifications = new Map<string, SpecificationTree>();
  const holding = new Map<string, { root: string; kind: SpecificationKind }>();
  const domains = new Map<string, SpecificationSummary[]>(domainIds.map((d) => [d, []]));
  for (const specification of view.rows('specification') as unknown as SpecificationRow[]) {
    const root = specification.id;
    const predicate = predicates.get(root);
    const test = tests.get(root);
    const tree: SpecificationTree = {
      specification,
      domain: domainOf(root),
      reads: reads(root),
      predicate: predicate ? { predicate, meets: meets(predicate.id), packages: packages(predicate.id) } : null,
      test: test ? { test, startsFrom: startsFrom(test.id) } : null,
    };
    specifications.set(root, tree);
    holding.set(root, { root, kind: 'specification' });
    if (predicate) holding.set(predicate.id, { root, kind: 'predicate' });
    if (test) holding.set(test.id, { root, kind: 'specification_test' });
    domains.get(tree.domain)?.push({ id: root, title: specification.title });
  }
  for (const list of domains.values()) list.sort(byRecordId);
  const kinds = new Map<string, string>();
  for (const kind of Object.keys(view.schema.kinds)) for (const row of view.rows(kind)) kinds.set(String(row.id), kind);
  return { specifications, holding, domains, kinds };
}
