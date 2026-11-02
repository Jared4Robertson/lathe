// The Business outcome aggregate (LA-PRD-A16): a measurable change a product exists to bring about, with the tests and
// records that measure it. One instance is one outcome, whole: its row and the measured_by links it starts.
import type { AggregateShape } from '../../platform/data/repository.ts';
import { bySource, groupOf } from '../../platform/data/grouped.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { BusinessOutcomeRow } from '../../platform/data/tables.ts';

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

/** How each of the aggregate's kinds sits in an instance, the root first: its repository and pattern commands' handlers are generated from it. @public (read by `npm run generate`) */
export const BUSINESS_OUTCOME_SHAPE = {
  business_outcome: { at: 'outcome', lists: { measured_by: 'measuredBy' } },
} as const satisfies AggregateShape;

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
