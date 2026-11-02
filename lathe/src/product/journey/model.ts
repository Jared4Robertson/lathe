// The Journey aggregate (LA-PRD-A25): a journey with its steps (and the carries_out link each starts), its journey test
// (and the test data sets it starts from) and the serves links it starts. One instance is one journey, whole; nothing
// in it belongs to another aggregate, and it holds only the links its own records start.
import type { AggregateShape } from '../../platform/data/repository.ts';
import { bySource, groupBy, groupOf } from '../../platform/data/grouped.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { JourneyRow, JourneyStepRow, JourneyTestRow } from '../../platform/data/tables.ts';

/** The aggregate's record ID in Lathe's own spec. */
export const JOURNEY_AGGREGATE = 'LA-PRD-A25';

/** A step with the link it starts. */
export interface JourneyStep {
  row: JourneyStepRow;
  /** The use case or policy it carries out, or none yet. */
  carriesOut: string | null;
}

/** A journey test with the test data sets it starts from. */
export interface JourneyTest {
  row: JourneyTestRow;
  startsFrom: string[];
}

/** One journey, whole. */
export interface Journey {
  /** The journey's ID: the aggregate's root. */
  readonly root: string;
  journey: JourneyRow;
  /** The business outcomes it serves, sorted. */
  serves: string[];
  steps: JourneyStep[];
  /** Its journey test: at most one. */
  tests: JourneyTest[];
}

/** The tables the Journey aggregate keeps its rows in: its kinds and the relations its records start. */
export const JOURNEY_TABLES = ['journey', 'journey_step', 'journey_test', 'serves', 'carries_out', 'starts_from'] as const;

/** How each of the aggregate's kinds sits in an instance, the root first: its repository and pattern commands' handlers are generated from it. @public (read by `npm run generate`) */
export const JOURNEY_SHAPE = {
  journey: { at: 'journey', lists: { serves: 'serves' } },
  journey_step: { at: 'steps', links: { carries_out: 'carriesOut' } },
  journey_test: { at: 'tests', lists: { starts_from: 'startsFrom' } },
} as const satisfies AggregateShape;

export type JourneyKind = keyof typeof JOURNEY_SHAPE;

/** The journeys in the data, each whole, built from the aggregate's tables; only the one given, when given. */
export function journeysFrom(rows: (table: string) => Row[], only?: string): Journey[] {
  const journeys = rows('journey').filter((r) => only === undefined || r.id === only) as unknown as JourneyRow[];
  if (!journeys.length) return [];
  const ids = new Set(journeys.map((j) => j.id));
  const stepsOf = groupBy((rows('journey_step') as unknown as JourneyStepRow[]).filter((s) => ids.has(s.journey_id)), (s) => s.journey_id);
  const testsOf = groupBy((rows('journey_test') as unknown as JourneyTestRow[]).filter((t) => ids.has(t.journey_id)), (t) => t.journey_id);
  const [serves, carriesOut, startsFrom] = ['serves', 'carries_out', 'starts_from'].map((table) => bySource(rows(table)));
  return journeys.map((journey) => ({
    root: journey.id,
    journey,
    serves: groupOf(serves, journey.id),
    steps: groupOf(stepsOf, journey.id).map((row) => ({ row, carriesOut: groupOf(carriesOut, row.id)[0] ?? null })),
    tests: groupOf(testsOf, journey.id).map((row) => ({ row, startsFrom: groupOf(startsFrom, row.id) })),
  }));
}

const links = (source: string, ids: (string | null)[]): Row[] => ids.filter((id): id is string => id !== null).map((target) => ({ source_id: source, target_id: target }));

/** The instance's rows, by table. */
export function journeyRows(journey: Journey): Map<string, Row[]> {
  const asRow = <T extends object>(row: T) => row as unknown as Row;
  return new Map<string, Row[]>([
    ['journey', [asRow(journey.journey)]],
    ['journey_step', journey.steps.map((s) => asRow(s.row))],
    ['journey_test', journey.tests.map((t) => asRow(t.row))],
    ['serves', links(journey.root, journey.serves)],
    ['carries_out', journey.steps.flatMap((s) => links(s.row.id, [s.carriesOut]))],
    ['starts_from', journey.tests.flatMap((t) => links(t.row.id, t.startsFrom))],
  ]);
}
