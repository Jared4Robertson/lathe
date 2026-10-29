// The Standard aggregate (LA-AUT-A3): engineering rules the product's code follows: a standard with its rules, and each
// rule's tests (with the test data sets they start from). One instance is one standard, whole; the technical records
// that meet its rules start those links in their own aggregates.
import type { Slice } from '../../platform/commands/definition.ts';
import type { Row, Value } from '../../platform/data/rows.ts';
import type { StandardRow, StandardRuleRow, StandardRuleTestRow } from '../../platform/data/tables.ts';

/** The aggregate's record ID in Lathe's own spec. */
export const STANDARD_AGGREGATE = 'LA-AUT-A3';

/** How the interfaces reach the aggregate's commands: `lathe standard`, the standard_ tools, /api/standard/. */
export const STANDARD_SLICE: Slice = { aggregate: STANDARD_AGGREGATE, name: 'standard' };

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

/** A test with the test data sets it starts from. */
export interface Tested<T> {
  row: T;
  startsFrom: string[];
}

/** One standard, whole. */
export interface Standard {
  /** The standard's ID: the aggregate's root. */
  readonly root: string;
  standard: StandardRow;
  rules: StandardRuleRow[];
  ruleTests: Tested<StandardRuleTestRow>[];
}

/** The tables the Standard aggregate keeps its rows in: its kinds and the relation its tests start. */
export const STANDARD_TABLES = ['standard', 'standard_rule', 'standard_rule_test', 'starts_from'] as const;

/** The kinds of the aggregate's records, each with the column that names its parent inside the aggregate. */
export const STANDARD_KINDS = {
  standard: null,
  standard_rule: 'standard_id',
  standard_rule_test: 'standard_rule_id',
} as const;

export type StandardKind = keyof typeof STANDARD_KINDS;

/** A new standard, with no rules yet. */
export function newStandard(standard: StandardRow): Standard {
  return { root: standard.id, standard, rules: [], ruleTests: [] };
}

/** The standards in the data, each whole, built from the aggregate's tables; only the one given, when given. */
export function standardsFrom(rows: (table: string) => Row[], only?: string): Standard[] {
  const standards = rows('standard').filter((r) => only === undefined || r.id === only) as unknown as StandardRow[];
  if (!standards.length) return [];
  const ids = new Set(standards.map((s) => s.id));
  const rules = (rows('standard_rule') as unknown as StandardRuleRow[]).filter((r) => ids.has(r.standard_id));
  const standardOf = new Map(rules.map((r) => [r.id, r.standard_id]));
  const tests = (rows('standard_rule_test') as unknown as StandardRuleTestRow[]).filter((t) => standardOf.has(t.standard_rule_id));
  const startsFrom = new Map<string, string[]>();
  for (const l of rows('starts_from')) startsFrom.set(String(l.source_id), [...(startsFrom.get(String(l.source_id)) ?? []), String(l.target_id)].sort());
  return standards.map((standard) => ({
    root: standard.id,
    standard,
    rules: rules.filter((r) => r.standard_id === standard.id),
    ruleTests: tests.filter((t) => standardOf.get(t.standard_rule_id) === standard.id).map((row) => ({ row, startsFrom: startsFrom.get(row.id) ?? [] })),
  }));
}

/** The instance's rows, by table. */
export function standardRows(standard: Standard): Map<string, Row[]> {
  const asRow = <T extends object>(row: T) => row as unknown as Row;
  return new Map<string, Row[]>([
    ['standard', [asRow(standard.standard)]],
    ['standard_rule', standard.rules.map(asRow)],
    ['standard_rule_test', standard.ruleTests.map((t) => asRow(t.row))],
    ['starts_from', standard.ruleTests.flatMap((t) => t.startsFrom.map((target) => ({ source_id: t.row.id, target_id: target })))],
  ]);
}

/** The kind of the record with this ID inside the standard, or undefined. */
export function kindInside(standard: Standard, id: string): StandardKind | undefined {
  if (standard.root === id) return 'standard';
  if (standard.rules.some((r) => r.id === id)) return 'standard_rule';
  if (standard.ruleTests.some((t) => t.row.id === id)) return 'standard_rule_test';
  return undefined;
}
