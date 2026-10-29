// The Use case aggregate's read model (LA-AUT-RM11), shaped for its readers: the Use case page reads a use case as a
// tree (its requirements each with their tests and the steps that fulfill them; its flows by interface, each with its
// steps path by path in order and its flow test), and a capability's list reads each use case's ID and title. The
// projection builds both from the rows; nothing here is the aggregate's own instance type.
import type { ReadView } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { FlowRow, FlowStepRow, FlowTestRow, UcRequirementRow, UseCaseRow, UseCaseTestRow } from '../../platform/data/tables.ts';
import { USE_CASE_KINDS, type UseCaseKind } from './model.ts';

/** A test as the page shows it: its row and the test data sets it starts from. */
export interface TestOnPage<T> {
  test: T;
  startsFrom: string[];
}

/** A UC requirement as the page shows it: its row, its use case tests and the steps of its use case that fulfill it. */
export interface RequirementOnPage {
  requirement: UcRequirementRow;
  tests: TestOnPage<UseCaseTestRow>[];
  fulfilledBy: string[];
}

/** A step as the page shows it: its row and the IDs of what it links to. */
export interface StepOnPage {
  step: FlowStepRow;
  invokes: string | null;
  happensIn: string | null;
  fulfills: string[];
  exchangesWith: string[];
}

/** One path of a flow: its name in lower case (main for a step with none), and its steps in order. */
export interface PathOnPage {
  name: string;
  steps: StepOnPage[];
}

/** A flow as the page shows it: its row, its paths (main first, then the others by name) and its flow test. */
export interface FlowOnPage {
  flow: FlowRow;
  paths: PathOnPage[];
  test: TestOnPage<FlowTestRow> | null;
}

/** A use case as its page reads it, with the record of it the page is about. */
export interface UseCasePage {
  /** The record the page is about, and its kind in the use case. */
  record: { id: string; kind: UseCaseKind };
  useCase: UseCaseRow;
  /** Its actors' role names, in order: the first is the main actor. */
  actors: string[];
  /** Its UC requirements, by ID. */
  requirements: RequirementOnPage[];
  /** Its flows, by the interface each goes through. */
  flows: FlowOnPage[];
}

/** A use case as a capability's list reads it. */
export interface UseCaseSummary {
  id: string;
  title: string;
}

const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id, 'en', { numeric: true });

// A link table's targets from one source, sorted.
const targets = (view: ReadView, table: string, source: string): string[] =>
  view.rows(table).filter((l) => l.source_id === source).map((l) => String(l.target_id)).sort();

const rowsOf = <T>(view: ReadView, table: string, keep: (row: Row) => boolean): T[] => view.rows(table).filter(keep) as unknown as T[];

/** The ID of the use case that holds the record and the record's kind in it, or undefined when no use case holds it. */
export function useCaseHolding(view: ReadView, id: string): { root: string; kind: UseCaseKind } | undefined {
  const record = view.record(id);
  if (!record || !Object.hasOwn(USE_CASE_KINDS, record.kind)) return undefined;
  let at = record;
  while (at.kind !== 'use_case') {
    const column = USE_CASE_KINDS[at.kind as Exclude<UseCaseKind, 'use_case'>];
    at = view.record(String(at.row[column]))!;
  }
  return { root: String(at.row.id), kind: record.kind as UseCaseKind };
}

/** A step's path, trimmed and in lower case: a step with no path is on the main path. */
const pathOf = (step: FlowStepRow) => step.path?.trim().toLowerCase() || 'main';

/** The steps path by path: the main path first, then the others by name, each by position (a number), then by ID. */
function pathsOf(steps: StepOnPage[]): PathOnPage[] {
  const byPath = new Map<string, StepOnPage[]>();
  const ordered = [...steps].sort((a, b) => a.step.position - b.step.position || byId(a.step, b.step));
  for (const s of ordered) byPath.set(pathOf(s.step), [...(byPath.get(pathOf(s.step)) ?? []), s]);
  return [...byPath.entries()]
    .sort(([a], [b]) => (a === 'main' ? -1 : b === 'main' ? 1 : a.localeCompare(b)))
    .map(([name, onPath]) => ({ name, steps: onPath }));
}

/** The projection: the page of the record, built from the rows, or undefined when no use case holds the record. */
export function useCasePageFrom(view: ReadView, id: string): UseCasePage | undefined {
  const holding = useCaseHolding(view, id);
  if (!holding) return undefined;
  const useCase = view.record(holding.root)!.row as unknown as UseCaseRow;
  const flows = rowsOf<FlowRow>(view, 'flow', (f) => f.use_case_id === useCase.id).sort((a, b) => a.interface_id.localeCompare(b.interface_id) || byId(a, b));
  const steps = flows.flatMap((f) =>
    rowsOf<FlowStepRow>(view, 'flow_step', (s) => s.flow_id === f.id).map((step) => ({
      step,
      invokes: targets(view, 'invokes', step.id)[0] ?? null,
      happensIn: targets(view, 'happens_in', step.id)[0] ?? null,
      fulfills: targets(view, 'fulfills', step.id),
      exchangesWith: targets(view, 'exchanges_with', step.id),
    })),
  );
  const tested = <T extends { id: string }>(test: T): TestOnPage<T> => ({ test, startsFrom: targets(view, 'starts_from', test.id) });
  return {
    record: { id, kind: holding.kind },
    useCase,
    actors: view.rows('use_case_actor').filter((a) => a.use_case_id === useCase.id).sort((a, b) => Number(a.position) - Number(b.position)).map((a) => String(a.role_name)),
    requirements: rowsOf<UcRequirementRow>(view, 'uc_requirement', (r) => r.use_case_id === useCase.id).sort(byId).map((requirement) => ({
      requirement,
      tests: rowsOf<UseCaseTestRow>(view, 'use_case_test', (t) => t.uc_requirement_id === requirement.id).sort(byId).map(tested),
      fulfilledBy: steps.filter((s) => s.fulfills.includes(requirement.id)).map((s) => s.step.id).sort(),
    })),
    flows: flows.map((flow) => {
      const test = rowsOf<FlowTestRow>(view, 'flow_test', (t) => t.flow_id === flow.id)[0];
      return { flow, paths: pathsOf(steps.filter((s) => s.step.flow_id === flow.id)), test: test ? tested(test) : null };
    }),
  };
}

/** The projection for a capability's list: its use cases' IDs and titles, by ID. */
export function useCaseSummariesFrom(view: ReadView, capabilityId: string): UseCaseSummary[] {
  return view
    .rows('use_case')
    .filter((u) => u.capability_id === capabilityId)
    .map((u) => ({ id: String(u.id), title: String(u.title) }))
    .sort(byId);
}

/** Every step of a page's flow, path by path. */
export const stepsOf = (flow: FlowOnPage): StepOnPage[] => flow.paths.flatMap((p) => p.steps);
