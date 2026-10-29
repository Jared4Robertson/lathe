// The Read model aggregate's read model (LA-AUT-RM30), shaped for its readers: the Read model page reads a read model
// whole (its fields in order, what it reads, calls and is fed by, its queries by ID each with what it selects by and
// calls and its handler, its projection and its reader, each piece of code with the standard rules it meets and the
// packages it uses) with the record the page is about, a domain's list reads each read model's ID and title, and the
// editor's next ID reads the IDs in use. The projection (readModelTableFrom) is the only code that reads the source
// rows and the only code that writes the read model's table; the query handlers read that table only through the
// reader (reader.ts). Nothing here is the aggregate's own instance type.
import type { ReadView } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { ProjectionRow, QueryHandlerRow, QueryRow, ReadModelFieldRow, ReadModelRow, ReaderRow } from '../../platform/data/tables.ts';
import type { ReadModelKind } from './model.ts';

/** A piece of code as the page shows it: its row, the standard rules it meets and the packages it uses. */
export interface CodeOnPage<T> {
  code: T;
  meets: string[];
  packages: string[];
}

/** A query as the page shows it: its row, the specifications it selects by, the domain services it calls, and its handler. */
export interface QueryOnPage {
  query: QueryRow;
  selectsBy: string[];
  calls: string[];
  handler: CodeOnPage<QueryHandlerRow> | null;
}

/** A read model whole, as its page shows it. */
export interface ReadModelTree {
  readModel: ReadModelRow;
  /** Its fields, in order. */
  fields: ReadModelFieldRow[];
  /** The aggregates it reads, the domain services its projection calls and the events that feed it, by ID. */
  reads: string[];
  calls: string[];
  fedBy: string[];
  /** Its queries, by ID. */
  queries: QueryOnPage[];
  /** Its projection and its reader, if written. */
  projection: CodeOnPage<ProjectionRow> | null;
  reader: CodeOnPage<ReaderRow> | null;
}

/** A read model as its page reads it, with the record of it the page is about. */
export interface ReadModelPage extends ReadModelTree {
  record: { id: string; kind: ReadModelKind };
}

/** A read model as a domain's list reads it. */
export interface ReadModelSummary {
  id: string;
  title: string;
}

/** The read model's table, kept in memory: what the reader reads, and all it reads. */
export interface ReadModelTable {
  /** Each read model whole, by its ID. */
  readModels: Map<string, ReadModelTree>;
  /** Each record inside a read model: the read model that holds it and its kind there. */
  holding: Map<string, { root: string; kind: ReadModelKind }>;
  /** Each domain's read models, by ID; a domain with none has an empty list. */
  domains: Map<string, ReadModelSummary[]>;
  /** Every record ID in use, with its kind: what a next ID is one past, and what a refusal names. */
  kinds: Map<string, string>;
}

const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id, 'en', { numeric: true });

/** Rows by a column's value, each list in the table's order. */
function grouped<T>(rows: Row[], column: string): Map<string, T[]> {
  const found = new Map<string, T[]>();
  for (const r of rows) found.set(String(r[column]), [...(found.get(String(r[column])) ?? []), r as unknown as T]);
  return found;
}

/** A link table's other ends by one column, each list sorted. */
function linked(rows: Row[], by: string, other: string): (id: string) => string[] {
  const found = grouped<Row>(rows, by);
  return (id) => (found.get(id) ?? []).map((l) => String(l[other])).sort();
}

/** Rows by their parent's ID: one each, as a read model has one projection and one reader and a query one handler. */
function byParent<T>(rows: Row[], column: string): Map<string, T> {
  return new Map(rows.map((r) => [String(r[column]), r as unknown as T]));
}

/** The projection: the read model's table, built from the rows on each read (in memory; nothing keeps it). */
export function readModelTableFrom(view: ReadView): ReadModelTable {
  const [reads, calls, fedBy, selectsBy, meets] = ['reads', 'calls', 'fed_by', 'selects_by', 'meets'].map((t) => linked(view.rows(t), 'source_id', 'target_id'));
  const packages = linked(view.rows('package_use'), 'record_id', 'package');
  const code = <T extends { id: string }>(row: T | undefined): CodeOnPage<T> | null => (row ? { code: row, meets: meets(row.id), packages: packages(row.id) } : null);
  const fields = grouped<ReadModelFieldRow>(view.rows('read_model_field'), 'read_model_id');
  const queries = grouped<QueryRow>(view.rows('query'), 'read_model_id');
  const handlers = byParent<QueryHandlerRow>(view.rows('query_handler'), 'query_id');
  const projections = byParent<ProjectionRow>(view.rows('projection'), 'read_model_id');
  const readers = byParent<ReaderRow>(view.rows('reader'), 'read_model_id');
  const readModels = new Map<string, ReadModelTree>();
  const holding = new Map<string, { root: string; kind: ReadModelKind }>();
  const domains = new Map<string, ReadModelSummary[]>(view.rows('domain').map((d) => [String(d.id), []]));
  for (const readModel of view.rows('read_model') as unknown as ReadModelRow[]) {
    const root = readModel.id;
    const tree: ReadModelTree = {
      readModel,
      fields: [...(fields.get(root) ?? [])].sort((a, b) => a.position - b.position),
      reads: reads(root),
      calls: calls(root),
      fedBy: fedBy(root),
      queries: [...(queries.get(root) ?? [])].sort(byId).map((query) => ({ query, selectsBy: selectsBy(query.id), calls: calls(query.id), handler: code(handlers.get(query.id)) })),
      projection: code(projections.get(root)),
      reader: code(readers.get(root)),
    };
    readModels.set(root, tree);
    holding.set(root, { root, kind: 'read_model' });
    for (const q of tree.queries) {
      holding.set(q.query.id, { root, kind: 'query' });
      if (q.handler) holding.set(q.handler.code.id, { root, kind: 'query_handler' });
    }
    if (tree.projection) holding.set(tree.projection.code.id, { root, kind: 'projection' });
    if (tree.reader) holding.set(tree.reader.code.id, { root, kind: 'reader' });
    domains.get(readModel.domain_id)?.push({ id: root, title: readModel.title });
  }
  for (const list of domains.values()) list.sort(byId);
  const kinds = new Map<string, string>();
  for (const kind of Object.keys(view.schema.kinds)) for (const row of view.rows(kind)) kinds.set(String(row.id), kind);
  return { readModels, holding, domains, kinds };
}
