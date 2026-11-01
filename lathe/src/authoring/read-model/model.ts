// The Read model aggregate (LA-AUT-A10): a shape of a domain's data for reading, with its fields in order, the
// aggregates it reads, the domain services it calls and the events that feed it; its queries (each with the
// specifications it selects by and the domain services it calls), its projection and its query handlers (each with the
// standard rules it meets and the packages it uses), and its reader, through which the query handlers read it (with the
// standard rules it meets and the packages it uses). One instance is one read model, whole; it holds only the links its
// own records start. Where it is stored is its table's, an aggregate of its own (A18).
import { bySource, groupBy, groupOf } from '../../platform/data/grouped.ts';
import type { Row, Value } from '../../platform/data/rows.ts';
import type { ProjectionRow, QueryHandlerRow, QueryRow, ReadModelFieldRow, ReadModelRow, ReaderRow } from '../../platform/data/tables.ts';

/** The aggregate's record ID in Lathe's own spec. */
export const READ_MODEL_AGGREGATE = 'LA-AUT-A10';

/**
 * The row with the changes applied: a value sets its column, null clears it, and a column left out keeps its value.
 * Only the columns named in `columns` are taken from the changes.
 */
export function changed<R extends object>(row: R, changes: object, columns: readonly string[]): R {
  const next = { ...row } as Record<string, unknown>;
  for (const [column, value] of Object.entries(changes)) {
    if (!columns.includes(column) || value === undefined) continue;
    if (value === null) delete next[column];
    else next[column] = value as Value;
  }
  return next as R;
}

/** The columns of a field a command gives: its read model and its position follow from the list it is in. */
export const FIELD_COLUMNS = ['name', 'meaning', 'type', 'type_value_object_id', 'type_aggregate_id', 'required', 'column_name', 'example'] as const;

/** One field of a read model. Its position is its place in the read model's list. */
export type ReadModelField = Omit<ReadModelFieldRow, 'read_model_id' | 'position'>;

/** A technical record with the standard rules it meets and the packages it uses. */
export interface Technical<T> {
  row: T;
  meets: string[];
  packages: string[];
}

/** A query with the specifications it selects by and the domain services it calls. */
export interface Query {
  row: QueryRow;
  selectsBy: string[];
  calls: string[];
}

/** One read model, whole. */
export interface ReadModel {
  /** The read model's ID: the aggregate's root. */
  readonly root: string;
  readModel: ReadModelRow;
  /** Its fields, in order. */
  fields: ReadModelField[];
  /** The aggregates it reads. */
  reads: string[];
  /** The domain services its projection calls. */
  calls: string[];
  /** The events that keep it current. */
  fedBy: string[];
  queries: Query[];
  /** Its projection, if written: one at most. */
  projection: Technical<ProjectionRow> | null;
  /** Its reader, if written: one at most, with the data store it reads the table in. */
  reader: (Technical<ReaderRow> & { storedIn: string | null }) | null;
  queryHandlers: Technical<QueryHandlerRow>[];
}

/** The tables the Read model aggregate keeps its rows in: its kinds, its part, and the relations and parts its records start. */
export const READ_MODEL_TABLES = ['read_model', 'read_model_field', 'query', 'projection', 'reader', 'query_handler', 'reads', 'calls', 'fed_by', 'selects_by', 'meets', 'package_use', 'stored_in'] as const;

/** The kinds of the aggregate's records, each with the column that names its parent inside the aggregate. */
export const READ_MODEL_KINDS = {
  read_model: null,
  query: 'read_model_id',
  projection: 'read_model_id',
  reader: 'read_model_id',
  query_handler: 'query_id',
} as const;

export type ReadModelKind = keyof typeof READ_MODEL_KINDS;

/** A new read model with its fields and links, and no queries or projection yet. */
export function newReadModel(readModel: ReadModelRow, parts: Pick<ReadModel, 'fields' | 'reads' | 'calls' | 'fedBy'>): ReadModel {
  return { root: readModel.id, readModel, ...parts, queries: [], projection: null, reader: null, queryHandlers: [] };
}

/** The read models in the data, each whole, built from the aggregate's tables; only the one given, when given. */
export function readModelsFrom(rows: (table: string) => Row[], only?: string): ReadModel[] {
  const readModels = rows('read_model').filter((r) => only === undefined || r.id === only) as unknown as ReadModelRow[];
  if (!readModels.length) return [];
  const ids = new Set(readModels.map((r) => r.id));
  const fields = (rows('read_model_field') as unknown as ReadModelFieldRow[]).filter((f) => ids.has(f.read_model_id));
  const queries = (rows('query') as unknown as QueryRow[]).filter((q) => ids.has(q.read_model_id));
  const readModelOf = new Map(queries.map((q) => [q.id, q.read_model_id]));
  const projectionsOf = groupBy((rows('projection') as unknown as ProjectionRow[]).filter((p) => ids.has(p.read_model_id)), (p) => p.read_model_id);
  const readersOf = groupBy((rows('reader') as unknown as ReaderRow[]).filter((r) => ids.has(r.read_model_id)), (r) => r.read_model_id);
  const handlersOf = groupBy((rows('query_handler') as unknown as QueryHandlerRow[]).filter((h) => readModelOf.has(h.query_id)), (h) => readModelOf.get(h.query_id));
  const fieldsOf = groupBy(fields, (f) => f.read_model_id);
  const queriesOf = groupBy(queries, (q) => q.read_model_id);
  const [reads, calls, fedBy, selectsBy, meets, storedIn] = ['reads', 'calls', 'fed_by', 'selects_by', 'meets', 'stored_in'].map((table) => bySource(rows(table)));
  const packages = bySource(rows('package_use'), 'record_id', 'package');
  const technical = <T extends { id: string }>(row: T): Technical<T> => ({ row, meets: groupOf(meets, row.id), packages: groupOf(packages, row.id) });
  return readModels.map((readModel) => {
    const projection = groupOf(projectionsOf, readModel.id)[0];
    const reader = groupOf(readersOf, readModel.id)[0];
    return {
      root: readModel.id,
      readModel,
      fields: [...groupOf(fieldsOf, readModel.id)]
        .sort((a, b) => a.position - b.position)
        .map(({ read_model_id: _owner, position: _at, ...field }) => field),
      reads: groupOf(reads, readModel.id),
      calls: groupOf(calls, readModel.id),
      fedBy: groupOf(fedBy, readModel.id),
      queries: groupOf(queriesOf, readModel.id).map((row) => ({ row, selectsBy: groupOf(selectsBy, row.id), calls: groupOf(calls, row.id) })),
      projection: projection ? technical(projection) : null,
      reader: reader ? { ...technical(reader), storedIn: groupOf(storedIn, reader.id)[0] ?? null } : null,
      queryHandlers: groupOf(handlersOf, readModel.id).map(technical),
    };
  });
}

const links = (source: string, ids: string[]): Row[] => ids.map((target) => ({ source_id: source, target_id: target }));

/** The instance's rows, by table. */
export function readModelRows(readModel: ReadModel): Map<string, Row[]> {
  const asRow = <T extends object>(row: T) => row as unknown as Row;
  const technical = [...(readModel.projection ? [readModel.projection] : []), ...(readModel.reader ? [readModel.reader] : []), ...readModel.queryHandlers];
  return new Map<string, Row[]>([
    ['read_model', [asRow(readModel.readModel)]],
    ['read_model_field', readModel.fields.map((f, at) => asRow({ read_model_id: readModel.root, position: at + 1, ...f }))],
    ['query', readModel.queries.map((q) => asRow(q.row))],
    ['projection', readModel.projection ? [asRow(readModel.projection.row)] : []],
    ['reader', readModel.reader ? [asRow(readModel.reader.row)] : []],
    ['stored_in', readModel.reader?.storedIn ? links(readModel.reader.row.id, [readModel.reader.storedIn]) : []],
    ['query_handler', readModel.queryHandlers.map((h) => asRow(h.row))],
    ['reads', links(readModel.root, readModel.reads)],
    ['calls', [...links(readModel.root, readModel.calls), ...readModel.queries.flatMap((q) => links(q.row.id, q.calls))]],
    ['fed_by', links(readModel.root, readModel.fedBy)],
    ['selects_by', readModel.queries.flatMap((q) => links(q.row.id, q.selectsBy))],
    ['meets', technical.flatMap((t) => links(t.row.id, t.meets))],
    ['package_use', technical.flatMap((t) => t.packages.map((name) => ({ record_id: t.row.id, package: name })))],
  ]);
}

/** The kind of the record with this ID inside the read model, or undefined. */
export function kindInside(readModel: ReadModel, id: string): ReadModelKind | undefined {
  if (readModel.root === id) return 'read_model';
  if (readModel.queries.some((q) => q.row.id === id)) return 'query';
  if (readModel.projection?.row.id === id) return 'projection';
  if (readModel.reader?.row.id === id) return 'reader';
  if (readModel.queryHandlers.some((h) => h.row.id === id)) return 'query_handler';
  return undefined;
}
