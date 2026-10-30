// The Business outcome aggregate (LA-AUT-A16): a measurable change a product exists to bring about, with the tests and
// records that measure it. One instance is one outcome, whole: its row and the measured_by links it starts.
import type { Slice } from '../../platform/commands/definition.ts';
import { bySource, groupOf } from '../../platform/data/grouped.ts';
import type { Row, Value } from '../../platform/data/rows.ts';
import type { BusinessOutcomeRow } from '../../platform/data/tables.ts';

/** The aggregate's record ID in Lathe's own spec. */
export const BUSINESS_OUTCOME_AGGREGATE = 'LA-AUT-A16';

/** How the interfaces reach the aggregate's commands: `lathe business-outcome`, the business_outcome_ tools, /api/business-outcome/. */
export const BUSINESS_OUTCOME_SLICE: Slice = { aggregate: BUSINESS_OUTCOME_AGGREGATE, name: 'business-outcome' };

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

/** One business outcome, whole. */
export interface BusinessOutcome {
  /** The outcome's ID: the aggregate's root. */
  readonly root: string;
  outcome: BusinessOutcomeRow;
  /** The tests and records that measure it, sorted. */
  measuredBy: string[];
}

/** The tables the aggregate keeps its rows in: its kind and the measured_by links it starts. */
export const BUSINESS_OUTCOME_TABLES = ['business_outcome', 'measured_by'] as const;

/** The business outcomes in the data, each whole; only the one given, when given. */
export function businessOutcomesFrom(rows: (table: string) => Row[], only?: string): BusinessOutcome[] {
  const outcomes = rows('business_outcome').filter((r) => only === undefined || r.id === only) as unknown as BusinessOutcomeRow[];
  if (!outcomes.length) return [];
  const ids = new Set(outcomes.map((o) => o.id));
  const measures = bySource(rows('measured_by').filter((m) => ids.has(String(m.source_id))));
  return outcomes.map((outcome) => ({
    root: outcome.id,
    outcome,
    measuredBy: groupOf(measures, outcome.id),
  }));
}

/** The instance's rows, by table. */
export function businessOutcomeRows(outcome: BusinessOutcome): Map<string, Row[]> {
  return new Map<string, Row[]>([
    ['business_outcome', [outcome.outcome as unknown as Row]],
    ['measured_by', outcome.measuredBy.map((target) => ({ source_id: outcome.root, target_id: target }))],
  ]);
}
