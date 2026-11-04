// The Specification aggregate (LA-MOD-A5): a named yes-or-no rule over aggregates of one domain, with the aggregates
// it reads, its predicate in code (with the standard rules it meets and the packages it uses) and its test (with the
// test data sets it starts from). One instance is one specification, whole; it holds only the links its own records
// start.
import type { AggregateShape } from '../../platform/data/repository.ts';
import { bySource, groupBy, groupOf } from '../../platform/data/grouped.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { PredicateRow, SpecificationRow, SpecificationTestRow } from '../../platform/data/tables.ts';

/** The aggregate's record ID in Lathe's own spec. */
export const SPECIFICATION_AGGREGATE = 'LA-MOD-A5';

/** A technical record with the standard rules it meets and the packages it uses. */
export interface Technical<T> {
  row: T;
  meets: string[];
  packages: string[];
  /** Its helper files (helper_file), sorted. */
  helpers: string[];
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
export const SPECIFICATION_TABLES = ['specification', 'predicate', 'specification_test', 'reads', 'meets', 'package_use', 'helper_file', 'starts_from'] as const;

/** How each of the aggregate's kinds sits in an instance, the root first: its repository and pattern commands' handlers are generated from it. @public (read by `npm run generate`) */
export const SPECIFICATION_SHAPE = {
  specification: { at: 'specification', lists: { reads: 'reads' } },
  predicate: { at: 'predicate', one: true, refusedBy: 'onePredicate', lists: { meets: 'meets', packages: 'packages', helpers: 'helpers' } },
  specification_test: { at: 'test', one: true, refusedBy: 'oneSpecificationTest', lists: { starts_from: 'startsFrom' } },
} as const satisfies AggregateShape;

export type SpecificationKind = keyof typeof SPECIFICATION_SHAPE;

/** The specifications in the data, each whole, built from the aggregate's tables; only the one given, when given. */
export function specificationsFrom(rows: (table: string) => Row[], only?: string): Specification[] {
  const specifications = rows('specification').filter((r) => only === undefined || r.id === only) as unknown as SpecificationRow[];
  if (!specifications.length) return [];
  const ids = new Set(specifications.map((s) => s.id));
  const predicatesOf = groupBy((rows('predicate') as unknown as PredicateRow[]).filter((p) => ids.has(p.specification_id)), (p) => p.specification_id);
  const testsOf = groupBy((rows('specification_test') as unknown as SpecificationTestRow[]).filter((t) => ids.has(t.specification_id)), (t) => t.specification_id);
  const [reads, meets, startsFrom] = ['reads', 'meets', 'starts_from'].map((table) => bySource(rows(table)));
  const packages = bySource(rows('package_use'), 'record_id', 'package');
  const helpers = bySource(rows('helper_file'), 'record_id', 'file');
  return specifications.map((specification) => {
    const predicate = groupOf(predicatesOf, specification.id)[0];
    const test = groupOf(testsOf, specification.id)[0];
    return {
      root: specification.id,
      specification,
      reads: groupOf(reads, specification.id),
      predicate: predicate ? { row: predicate, meets: groupOf(meets, predicate.id), packages: groupOf(packages, predicate.id), helpers: groupOf(helpers, predicate.id) } : null,
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
    ['helper_file', predicate ? predicate.helpers.map((name) => ({ record_id: predicate.row.id, file: name })) : []],
    ['starts_from', test ? links(test.row.id, test.startsFrom) : []],
  ]);
}

