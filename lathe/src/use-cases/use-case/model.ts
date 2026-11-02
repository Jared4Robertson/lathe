// The Use case aggregate (LA-UCS-A11): a use case with its actors, its UC requirements and their use case tests, and
// its one flow with its steps (and the links each step starts) and its flow test. One instance is one use case,
// whole; nothing in it belongs to another aggregate, and it holds only the links its own records start.
import type { AggregateShape } from '../../platform/data/repository.ts';
import { bySource, groupBy, groupOf } from '../../platform/data/grouped.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { FlowRow, FlowStepRow, FlowTestRow, UcRequirementRow, UseCaseRow, UseCaseTestRow } from '../../platform/data/tables.ts';

/** The aggregate's record ID in Lathe's own spec. */
export const USE_CASE_AGGREGATE = 'LA-UCS-A11';

/** A flow step with the links it starts. */
export interface FlowStep {
  row: FlowStepRow;
  /** The UC requirements of its own use case it fulfills. */
  fulfills: string[];
  /** The command or query it invokes, if any. */
  invokes: string | null;
  /** The integrations it exchanges with. */
  exchangesWith: string[];
}

/** A test with the test data sets it starts from. */
export interface Tested<T> {
  row: T;
  startsFrom: string[];
}

/** One use case, whole. */
export interface UseCase {
  /** The use case's ID: the aggregate's root. */
  readonly root: string;
  useCase: UseCaseRow;
  /** Its actors' role names, in order: the first is the main actor. */
  actors: string[];
  requirements: UcRequirementRow[];
  useCaseTests: Tested<UseCaseTestRow>[];
  flows: FlowRow[];
  steps: FlowStep[];
  flowTests: Tested<FlowTestRow>[];
}

/** The tables the Use case aggregate keeps its rows in: its kinds, its part, and the relations its records start. */
export const USE_CASE_TABLES = [
  'use_case',
  'use_case_actor',
  'uc_requirement',
  'use_case_test',
  'flow',
  'flow_step',
  'flow_test',
  'fulfills',
  'invokes',
  'exchanges_with',
  'starts_from',
] as const;

/** How each of the aggregate's kinds sits in an instance, the root first: its repository and pattern commands' handlers are generated from it. @public (read by `npm run generate`) */
export const USE_CASE_SHAPE = {
  use_case: { at: 'useCase', lists: { actors: 'actors' } },
  uc_requirement: { at: 'requirements' },
  use_case_test: { at: 'useCaseTests', lists: { starts_from: 'startsFrom' } },
  flow: { at: 'flows' },
  flow_step: { at: 'steps', lists: { fulfills: 'fulfills', exchanges_with: 'exchangesWith' }, links: { invokes: 'invokes' } },
  flow_test: { at: 'flowTests', lists: { starts_from: 'startsFrom' } },
} as const satisfies AggregateShape;

export type UseCaseKind = keyof typeof USE_CASE_SHAPE;

/** The use cases in the data, each whole, built from the aggregate's tables; only the one given, when given. */
export function useCasesFrom(rows: (table: string) => Row[], only?: string): UseCase[] {
  const useCases = rows('use_case').filter((r) => only === undefined || r.id === only) as unknown as UseCaseRow[];
  if (!useCases.length) return [];
  const ids = new Set(useCases.map((u) => u.id));
  const requirements = (rows('uc_requirement') as unknown as UcRequirementRow[]).filter((r) => ids.has(r.use_case_id));
  const flows = (rows('flow') as unknown as FlowRow[]).filter((f) => ids.has(f.use_case_id));
  const useCaseOfFlow = new Map(flows.map((f) => [f.id, f.use_case_id]));
  const useCaseOfRequirement = new Map(requirements.map((r) => [r.id, r.use_case_id]));
  // Each table's rows by the use case they sit in, grouped once.
  const requirementsOf = groupBy(requirements, (r) => r.use_case_id);
  const flowsOf = groupBy(flows, (f) => f.use_case_id);
  const stepsOf = groupBy((rows('flow_step') as unknown as FlowStepRow[]).filter((s) => useCaseOfFlow.has(s.flow_id)), (s) => useCaseOfFlow.get(s.flow_id));
  const useCaseTestsOf = groupBy(
    (rows('use_case_test') as unknown as UseCaseTestRow[]).filter((t) => useCaseOfRequirement.has(t.uc_requirement_id)),
    (t) => useCaseOfRequirement.get(t.uc_requirement_id),
  );
  const flowTestsOf = groupBy((rows('flow_test') as unknown as FlowTestRow[]).filter((t) => useCaseOfFlow.has(t.flow_id)), (t) => useCaseOfFlow.get(t.flow_id));
  const actorsOf = groupBy(rows('use_case_actor'), (a) => a.use_case_id);
  const [fulfills, invokes, exchangesWith, startsFrom] = ['fulfills', 'invokes', 'exchanges_with', 'starts_from'].map((table) => bySource(rows(table)));
  return useCases.map((useCase) => ({
    root: useCase.id,
    useCase,
    actors: [...groupOf(actorsOf, useCase.id)].sort((a, b) => Number(a.position) - Number(b.position)).map((a) => String(a.role_name)),
    requirements: groupOf(requirementsOf, useCase.id),
    useCaseTests: groupOf(useCaseTestsOf, useCase.id).map((row) => ({ row, startsFrom: groupOf(startsFrom, row.id) })),
    flows: groupOf(flowsOf, useCase.id),
    steps: groupOf(stepsOf, useCase.id).map((row) => ({
      row,
      fulfills: groupOf(fulfills, row.id),
      invokes: groupOf(invokes, row.id)[0] ?? null,
      exchangesWith: groupOf(exchangesWith, row.id),
    })),
    flowTests: groupOf(flowTestsOf, useCase.id).map((row) => ({ row, startsFrom: groupOf(startsFrom, row.id) })),
  }));
}

const links = (source: string, ids: (string | null)[]): Row[] => ids.filter((id): id is string => id !== null).map((target) => ({ source_id: source, target_id: target }));

/** The instance's rows, by table. */
export function useCaseRows(useCase: UseCase): Map<string, Row[]> {
  const asRow = <T extends object>(row: T) => row as unknown as Row;
  return new Map<string, Row[]>([
    ['use_case', [asRow(useCase.useCase)]],
    ['use_case_actor', useCase.actors.map((role, at) => ({ use_case_id: useCase.root, position: at + 1, role_name: role }))],
    ['uc_requirement', useCase.requirements.map(asRow)],
    ['use_case_test', useCase.useCaseTests.map((t) => asRow(t.row))],
    ['flow', useCase.flows.map(asRow)],
    ['flow_step', useCase.steps.map((s) => asRow(s.row))],
    ['flow_test', useCase.flowTests.map((t) => asRow(t.row))],
    ['fulfills', useCase.steps.flatMap((s) => links(s.row.id, s.fulfills))],
    ['invokes', useCase.steps.flatMap((s) => links(s.row.id, [s.invokes]))],
    ['exchanges_with', useCase.steps.flatMap((s) => links(s.row.id, s.exchangesWith))],
    ['starts_from', [...useCase.useCaseTests, ...useCase.flowTests].flatMap((t) => links(t.row.id, t.startsFrom))],
  ]);
}

