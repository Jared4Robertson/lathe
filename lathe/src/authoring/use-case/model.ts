// The Use case aggregate (LA-AUT-A11): a use case with its actors, its UC requirements and their use case tests, and
// its flows with their steps (and the links each step starts) and their flow tests. One instance is one use case,
// whole; nothing in it belongs to another aggregate, and it holds only the links its own records start.
import type { Slice } from '../../platform/commands/definition.ts';
import type { Row, Value } from '../../platform/data/rows.ts';
import type { FlowRow, FlowStepRow, FlowTestRow, UcRequirementRow, UseCaseRow, UseCaseTestRow } from '../../platform/data/tables.ts';

/** The aggregate's record ID in Lathe's own spec. */
export const USE_CASE_AGGREGATE = 'LA-AUT-A11';

/** How the interfaces reach the aggregate's commands: `lathe use-case`, the use_case_ tools, /api/use-case/. */
export const USE_CASE_SLICE: Slice = { aggregate: USE_CASE_AGGREGATE, name: 'use-case' };

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

/** A flow step with the links it starts. */
export interface FlowStep {
  row: FlowStepRow;
  /** The UC requirements of its own use case it fulfills. */
  fulfills: string[];
  /** The command or query it invokes, if any. */
  invokes: string | null;
  /** The view it happens in, if any. */
  happensIn: string | null;
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
  'happens_in',
  'exchanges_with',
  'starts_from',
] as const;

/** The kinds of the aggregate's records, each with the column that names its parent inside the aggregate. */
export const USE_CASE_KINDS = {
  use_case: null,
  uc_requirement: 'use_case_id',
  use_case_test: 'uc_requirement_id',
  flow: 'use_case_id',
  flow_step: 'flow_id',
  flow_test: 'flow_id',
} as const;

export type UseCaseKind = keyof typeof USE_CASE_KINDS;

/** A new use case, with nothing under it yet. */
export function newUseCase(useCase: UseCaseRow, actors: string[]): UseCase {
  return { root: useCase.id, useCase, actors, requirements: [], useCaseTests: [], flows: [], steps: [], flowTests: [] };
}

// A link table's targets by source, each list sorted.
function bySource(links: Row[]): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const l of links) found.set(String(l.source_id), [...(found.get(String(l.source_id)) ?? []), String(l.target_id)]);
  for (const list of found.values()) list.sort();
  return found;
}

/** The use cases in the data, each whole, built from the aggregate's tables; only the one given, when given. */
export function useCasesFrom(rows: (table: string) => Row[], only?: string): UseCase[] {
  const useCases = rows('use_case').filter((r) => only === undefined || r.id === only) as unknown as UseCaseRow[];
  if (!useCases.length) return [];
  const ids = new Set(useCases.map((u) => u.id));
  const requirements = (rows('uc_requirement') as unknown as UcRequirementRow[]).filter((r) => ids.has(r.use_case_id));
  const flows = (rows('flow') as unknown as FlowRow[]).filter((f) => ids.has(f.use_case_id));
  const flowIds = new Set(flows.map((f) => f.id));
  const requirementIds = new Set(requirements.map((r) => r.id));
  const steps = (rows('flow_step') as unknown as FlowStepRow[]).filter((s) => flowIds.has(s.flow_id));
  const useCaseTests = (rows('use_case_test') as unknown as UseCaseTestRow[]).filter((t) => requirementIds.has(t.uc_requirement_id));
  const flowTests = (rows('flow_test') as unknown as FlowTestRow[]).filter((t) => flowIds.has(t.flow_id));
  const [fulfills, invokes, happensIn, exchangesWith, startsFrom] = ['fulfills', 'invokes', 'happens_in', 'exchanges_with', 'starts_from'].map((table) => bySource(rows(table)));
  const targets = (links: Map<string, string[]>, source: string) => links.get(source) ?? [];
  const actors = rows('use_case_actor');
  return useCases.map((useCase) => {
    const own = (r: { use_case_id: string }) => r.use_case_id === useCase.id;
    const ownFlows = flows.filter(own).map((f) => f.id);
    const ownRequirements = requirements.filter(own).map((r) => r.id);
    return {
      root: useCase.id,
      useCase,
      actors: actors.filter((a) => a.use_case_id === useCase.id).sort((a, b) => Number(a.position) - Number(b.position)).map((a) => String(a.role_name)),
      requirements: requirements.filter(own),
      useCaseTests: useCaseTests.filter((t) => ownRequirements.includes(t.uc_requirement_id)).map((row) => ({ row, startsFrom: targets(startsFrom, row.id) })),
      flows: flows.filter(own),
      steps: steps
        .filter((s) => ownFlows.includes(s.flow_id))
        .map((row) => ({
          row,
          fulfills: targets(fulfills, row.id),
          invokes: targets(invokes, row.id)[0] ?? null,
          happensIn: targets(happensIn, row.id)[0] ?? null,
          exchangesWith: targets(exchangesWith, row.id),
        })),
      flowTests: flowTests.filter((t) => ownFlows.includes(t.flow_id)).map((row) => ({ row, startsFrom: targets(startsFrom, row.id) })),
    };
  });
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
    ['happens_in', useCase.steps.flatMap((s) => links(s.row.id, [s.happensIn]))],
    ['exchanges_with', useCase.steps.flatMap((s) => links(s.row.id, s.exchangesWith))],
    ['starts_from', [...useCase.useCaseTests, ...useCase.flowTests].flatMap((t) => links(t.row.id, t.startsFrom))],
  ]);
}

/** The kind of the record with this ID inside the use case, or undefined. */
export function kindInside(useCase: UseCase, id: string): UseCaseKind | undefined {
  if (useCase.root === id) return 'use_case';
  if (useCase.requirements.some((r) => r.id === id)) return 'uc_requirement';
  if (useCase.useCaseTests.some((t) => t.row.id === id)) return 'use_case_test';
  if (useCase.flows.some((f) => f.id === id)) return 'flow';
  if (useCase.steps.some((s) => s.row.id === id)) return 'flow_step';
  if (useCase.flowTests.some((t) => t.row.id === id)) return 'flow_test';
  return undefined;
}
