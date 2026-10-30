// The Aggregate aggregate (LA-AUT-A6): an aggregate with its entities (each with its fields and the entities it holds
// by has_one and has_many), its entities' data models (with the standard rules they meet and the packages they use),
// and its invariants with the rule that enforces each (built the same way) and their tests. One instance is one aggregate, whole; it holds only the links its own records
// start.
import type { Slice } from '../../platform/commands/definition.ts';
import type { Row, Value } from '../../platform/data/rows.ts';
import type { AggregateRow, DataModelRow, EntityFieldRow, EntityRow, InvariantRow, InvariantTestRow, RuleRow } from '../../platform/data/tables.ts';

/** The aggregate's record ID in Lathe's own spec. */
export const AGGREGATE_AGGREGATE = 'LA-AUT-A6';

/** How the interfaces reach the aggregate's commands: `lathe aggregate`, the aggregate_ tools, /api/aggregate/. */
export const AGGREGATE_SLICE: Slice = { aggregate: AGGREGATE_AGGREGATE, name: 'aggregate' };

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

/** An entity field as a command gives it: its entity and position come from the entity and its place in the list. */
export type EntityFieldInput = Omit<EntityFieldRow, 'entity_id' | 'position'>;

/** An entity with its fields, in order, and the entities of its aggregate it holds. */
export interface Entity {
  row: EntityRow;
  fields: EntityFieldRow[];
  /** The entities it holds exactly one of. */
  hasOne: string[];
  /** The entities it holds any number of. */
  hasMany: string[];
}

/** A technical record with the standard rules it meets and the packages it uses. */
export interface Built<T> {
  row: T;
  meets: string[];
  packages: string[];
}

/** A test with the test data sets it starts from. */
export interface Tested<T> {
  row: T;
  startsFrom: string[];
}

/** One aggregate, whole. */
export interface Aggregate {
  /** The aggregate's ID: the instance's root. */
  readonly root: string;
  aggregate: AggregateRow;
  entities: Entity[];
  invariants: InvariantRow[];
  dataModels: Built<DataModelRow>[];
  /** The rule that enforces each invariant, one each. */
  rules: Built<RuleRow>[];
  invariantTests: Tested<InvariantTestRow>[];
}

/** The tables the Aggregate aggregate keeps its rows in: its kinds, its part, and the relations its records start. */
export const AGGREGATE_TABLES = [
  'aggregate',
  'entity',
  'entity_field',
  'invariant',
  'data_model',
  'rule',
  'invariant_test',
  'has_one',
  'has_many',
  'meets',
  'package_use',
  'starts_from',
] as const;

/** The kinds of the aggregate's records, each with the column that names its parent inside the aggregate. */
export const AGGREGATE_KINDS = {
  aggregate: null,
  entity: 'aggregate_id',
  invariant: 'aggregate_id',
  data_model: 'entity_id',
  rule: 'invariant_id',
  invariant_test: 'invariant_id',
} as const;

export type AggregateKind = keyof typeof AGGREGATE_KINDS;

/** A new aggregate, with nothing under it yet. */
export function newAggregate(aggregate: AggregateRow): Aggregate {
  return { root: aggregate.id, aggregate, entities: [], invariants: [], dataModels: [], rules: [], invariantTests: [] };
}

/** The entity's fields as rows, in the order given. */
export function fieldRows(entityId: string, fields: EntityFieldInput[]): EntityFieldRow[] {
  return fields.map((field, at) => ({ entity_id: entityId, position: at + 1, ...field }));
}

// A link table's targets by source, each list sorted.
function bySource(links: Row[]): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const l of links) found.set(String(l.source_id), [...(found.get(String(l.source_id)) ?? []), String(l.target_id)]);
  for (const list of found.values()) list.sort();
  return found;
}

// The packages each record uses, sorted.
function packagesOf(rows: Row[]): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const r of rows) found.set(String(r.record_id), [...(found.get(String(r.record_id)) ?? []), String(r.package)]);
  for (const list of found.values()) list.sort();
  return found;
}

/** The aggregates in the data, each whole, built from the aggregate's tables; only the one given, when given. */
export function aggregatesFrom(rows: (table: string) => Row[], only?: string): Aggregate[] {
  const aggregates = rows('aggregate').filter((r) => only === undefined || r.id === only) as unknown as AggregateRow[];
  if (!aggregates.length) return [];
  const ids = new Set(aggregates.map((a) => a.id));
  const entities = (rows('entity') as unknown as EntityRow[]).filter((e) => ids.has(e.aggregate_id));
  const entityIds = new Set(entities.map((e) => e.id));
  const invariants = (rows('invariant') as unknown as InvariantRow[]).filter((i) => ids.has(i.aggregate_id));
  const invariantIds = new Set(invariants.map((i) => i.id));
  const fields = (rows('entity_field') as unknown as EntityFieldRow[]).filter((f) => entityIds.has(f.entity_id)).sort((a, b) => a.position - b.position);
  const dataModels = (rows('data_model') as unknown as DataModelRow[]).filter((d) => entityIds.has(d.entity_id));
  const rules = (rows('rule') as unknown as RuleRow[]).filter((r) => invariantIds.has(r.invariant_id));
  const invariantTests = (rows('invariant_test') as unknown as InvariantTestRow[]).filter((t) => invariantIds.has(t.invariant_id));
  const [hasOne, hasMany, meets, startsFrom] = ['has_one', 'has_many', 'meets', 'starts_from'].map((table) => bySource(rows(table)));
  const packages = packagesOf(rows('package_use'));
  const targets = (links: Map<string, string[]>, source: string) => links.get(source) ?? [];
  return aggregates.map((aggregate) => {
    const own = entities.filter((e) => e.aggregate_id === aggregate.id);
    const ownIds = new Set(own.map((e) => e.id));
    const ownInvariants = invariants.filter((i) => i.aggregate_id === aggregate.id);
    const ownInvariantIds = new Set(ownInvariants.map((i) => i.id));
    return {
      root: aggregate.id,
      aggregate,
      entities: own.map((row) => ({ row, fields: fields.filter((f) => f.entity_id === row.id), hasOne: targets(hasOne, row.id), hasMany: targets(hasMany, row.id) })),
      invariants: ownInvariants,
      dataModels: dataModels.filter((d) => ownIds.has(d.entity_id)).map((row) => ({ row, meets: targets(meets, row.id), packages: targets(packages, row.id) })),
      rules: rules.filter((r) => ownInvariantIds.has(r.invariant_id)).map((row) => ({ row, meets: targets(meets, row.id), packages: targets(packages, row.id) })),
      invariantTests: invariantTests.filter((t) => ownInvariantIds.has(t.invariant_id)).map((row) => ({ row, startsFrom: targets(startsFrom, row.id) })),
    };
  });
}

const links = (source: string, ids: string[]): Row[] => ids.map((target) => ({ source_id: source, target_id: target }));

/** The instance's rows, by table. */
export function aggregateRows(aggregate: Aggregate): Map<string, Row[]> {
  const asRow = <T extends object>(row: T) => row as unknown as Row;
  return new Map<string, Row[]>([
    ['aggregate', [asRow(aggregate.aggregate)]],
    ['entity', aggregate.entities.map((e) => asRow(e.row))],
    ['entity_field', aggregate.entities.flatMap((e) => e.fields.map(asRow))],
    ['invariant', aggregate.invariants.map(asRow)],
    ['data_model', aggregate.dataModels.map((d) => asRow(d.row))],
    ['rule', aggregate.rules.map((r) => asRow(r.row))],
    ['invariant_test', aggregate.invariantTests.map((t) => asRow(t.row))],
    ['has_one', aggregate.entities.flatMap((e) => links(e.row.id, e.hasOne))],
    ['has_many', aggregate.entities.flatMap((e) => links(e.row.id, e.hasMany))],
    ['meets', [...aggregate.dataModels, ...aggregate.rules].flatMap((d) => links(d.row.id, d.meets))],
    ['package_use', [...aggregate.dataModels, ...aggregate.rules].flatMap((d) => d.packages.map((p) => ({ record_id: d.row.id, package: p })))],
    ['starts_from', aggregate.invariantTests.flatMap((t) => links(t.row.id, t.startsFrom))],
  ]);
}

/** The kind of the record with this ID inside the aggregate, or undefined. */
export function kindInside(aggregate: Aggregate, id: string): AggregateKind | undefined {
  if (aggregate.root === id) return 'aggregate';
  if (aggregate.entities.some((e) => e.row.id === id)) return 'entity';
  if (aggregate.invariants.some((i) => i.id === id)) return 'invariant';
  if (aggregate.dataModels.some((d) => d.row.id === id)) return 'data_model';
  if (aggregate.rules.some((r) => r.row.id === id)) return 'rule';
  if (aggregate.invariantTests.some((t) => t.row.id === id)) return 'invariant_test';
  return undefined;
}
