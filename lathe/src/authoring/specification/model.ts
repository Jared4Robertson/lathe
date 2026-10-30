// The Specification aggregate (LA-AUT-A5): a named yes-or-no rule over aggregates of one domain, with the aggregates
// it reads, its predicate in code (with the standard rules it meets and the packages it uses) and its test (with the
// test data sets it starts from). One instance is one specification, whole; it holds only the links its own records
// start.
import type { Slice } from '../../platform/commands/definition.ts';
import { bySource, groupBy, groupOf } from '../../platform/data/grouped.ts';
import type { Row, Value } from '../../platform/data/rows.ts';
import type { PredicateRow, SpecificationRow, SpecificationTestRow } from '../../platform/data/tables.ts';

/** The aggregate's record ID in Lathe's own spec. */
export const SPECIFICATION_AGGREGATE = 'LA-AUT-A5';

/** How the interfaces reach the aggregate's commands: `lathe specification`, the specification_ tools, /api/specification/. */
export const SPECIFICATION_SLICE: Slice = { aggregate: SPECIFICATION_AGGREGATE, name: 'specification' };

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

/** A technical record with the standard rules it meets and the packages it uses. */
export interface Technical<T> {
  row: T;
  meets: string[];
  packages: string[];
}

/** A test with the test data sets it starts from. */
export interface Tested<T> {
  row: T;
  startsFrom: string[];
}

/** One specification, whole. */
export interface Specification {
  /** The specification's ID: the aggregate's root. */
  readonly root: string;
  specification: SpecificationRow;
  /** The aggregates it reads. */
  reads: string[];
  /** Its predicate in code, if written: one at most. */
  predicate: Technical<PredicateRow> | null;
  /** Its test, if written: one at most. */
  test: Tested<SpecificationTestRow> | null;
}

/** The tables the Specification aggregate keeps its rows in: its kinds, and the relations and parts its records start. */
export const SPECIFICATION_TABLES = ['specification', 'predicate', 'specification_test', 'reads', 'meets', 'package_use', 'starts_from'] as const;

/** The kinds of the aggregate's records, each with the column that names its parent inside the aggregate. */
export const SPECIFICATION_KINDS = {
  specification: null,
  predicate: 'specification_id',
  specification_test: 'specification_id',
} as const;

export type SpecificationKind = keyof typeof SPECIFICATION_KINDS;

/** A new specification, reading the aggregates given, with no predicate or test yet. */
export function newSpecification(specification: SpecificationRow, reads: string[]): Specification {
  return { root: specification.id, specification, reads, predicate: null, test: null };
}

/** The specifications in the data, each whole, built from the aggregate's tables; only the one given, when given. */
export function specificationsFrom(rows: (table: string) => Row[], only?: string): Specification[] {
  const specifications = rows('specification').filter((r) => only === undefined || r.id === only) as unknown as SpecificationRow[];
  if (!specifications.length) return [];
  const ids = new Set(specifications.map((s) => s.id));
  const predicatesOf = groupBy((rows('predicate') as unknown as PredicateRow[]).filter((p) => ids.has(p.specification_id)), (p) => p.specification_id);
  const testsOf = groupBy((rows('specification_test') as unknown as SpecificationTestRow[]).filter((t) => ids.has(t.specification_id)), (t) => t.specification_id);
  const [reads, meets, startsFrom] = ['reads', 'meets', 'starts_from'].map((table) => bySource(rows(table)));
  const packages = bySource(rows('package_use'), 'record_id', 'package');
  return specifications.map((specification) => {
    const predicate = groupOf(predicatesOf, specification.id)[0];
    const test = groupOf(testsOf, specification.id)[0];
    return {
      root: specification.id,
      specification,
      reads: groupOf(reads, specification.id),
      predicate: predicate ? { row: predicate, meets: groupOf(meets, predicate.id), packages: groupOf(packages, predicate.id) } : null,
      test: test ? { row: test, startsFrom: groupOf(startsFrom, test.id) } : null,
    };
  });
}

const links = (source: string, ids: string[]): Row[] => ids.map((target) => ({ source_id: source, target_id: target }));

/** The instance's rows, by table. */
export function specificationRows(specification: Specification): Map<string, Row[]> {
  const asRow = <T extends object>(row: T) => row as unknown as Row;
  const { predicate, test } = specification;
  return new Map<string, Row[]>([
    ['specification', [asRow(specification.specification)]],
    ['predicate', predicate ? [asRow(predicate.row)] : []],
    ['specification_test', test ? [asRow(test.row)] : []],
    ['reads', links(specification.root, specification.reads)],
    ['meets', predicate ? links(predicate.row.id, predicate.meets) : []],
    ['package_use', predicate ? predicate.packages.map((name) => ({ record_id: predicate.row.id, package: name })) : []],
    ['starts_from', test ? links(test.row.id, test.startsFrom) : []],
  ]);
}

/** The kind of the record with this ID inside the specification, or undefined. */
export function kindInside(specification: Specification, id: string): SpecificationKind | undefined {
  if (specification.root === id) return 'specification';
  if (specification.predicate?.row.id === id) return 'predicate';
  if (specification.test?.row.id === id) return 'specification_test';
  return undefined;
}
