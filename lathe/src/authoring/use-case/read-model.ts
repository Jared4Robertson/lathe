// The Use case aggregate's read model (LA-AUT-RM11), shaped for its readers: the Use case page reads a use case as a
// tree (its requirements each with their tests and the steps that fulfill them; its flows by interface, each with its
// steps path by path in order and its flow test), a capability's list reads each use case's ID and title, and the
// editor's next ID reads the IDs in use and what a new use case or flow is named after. The projection
// (useCaseTableFrom) is the only code that reads the source rows and the only code that writes the read model's table;
// the query handlers read that table only through the reader (reader.ts). Nothing here is the aggregate's own instance
// type.
import type { ReadView } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { FlowRow, FlowStepRow, FlowTestRow, UcRequirementRow, UseCaseRow, UseCaseTestRow } from '../../platform/data/tables.ts';
import type { UseCaseKind } from './model.ts';
import { byRecordId } from '../../platform/data/ids.ts';

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

/** A use case whole, as its page shows it. */
export interface UseCaseTree {
  useCase: UseCaseRow;
  /** Its actors' role names, in order: the first is the main actor. */
  actors: string[];
  /** Its UC requirements, by ID. */
  requirements: RequirementOnPage[];
  /** Its flows, by the interface each goes through. */
  flows: FlowOnPage[];
}

/** A use case as its page reads it, with the record of it the page is about. */
export interface UseCasePage extends UseCaseTree {
  /** The record the page is about, and its kind in the use case. */
  record: { id: string; kind: UseCaseKind };
}

/** A use case as a capability's list reads it. */
export interface UseCaseSummary {
  id: string;
  title: string;
}

/** The read model's table, kept in memory: what the reader reads, and all it reads. */
export interface UseCaseTable {
  /** Each use case whole, by its ID. */
  useCases: Map<string, UseCaseTree>;
  /** Each record inside a use case: the use case that holds it and its kind there. */
  holding: Map<string, { root: string; kind: UseCaseKind }>;
  /** Each capability's use cases, by ID, with the capability's domain and product. */
  capabilities: Map<string, { domain: string; product: string; useCases: UseCaseSummary[] }>;
  /** Each product's interfaces, by ID. */
  interfaces: Map<string, string[]>;
  /** Every record ID in use, with its kind: what a next ID is one past, and what a refusal names. */
  kinds: Map<string, string>;
}

/** Rows by a column's value, each list in the table's order. */
function grouped<T>(rows: Row[], column: string): Map<string, T[]> {
  const found = new Map<string, T[]>();
  for (const r of rows) found.set(String(r[column]), [...(found.get(String(r[column])) ?? []), r as unknown as T]);
  return found;
}

/** A link table's targets by source, each list sorted. */
function targets(view: ReadView, table: string): (source: string) => string[] {
  const bySource = grouped<{ target_id: string }>(view.rows(table), 'source_id');
  return (source) => (bySource.get(source) ?? []).map((l) => l.target_id).sort();
}

/** A step's path, trimmed and in lower case: a step with no path is on the main path. */
const pathOf = (step: FlowStepRow) => step.path?.trim().toLowerCase() || 'main';

/** The steps path by path: the main path first, then the others by name, each by position (a number), then by ID. */
function pathsOf(steps: StepOnPage[]): PathOnPage[] {
  const byPath = new Map<string, StepOnPage[]>();
  const ordered = [...steps].sort((a, b) => a.step.position - b.step.position || byRecordId(a.step, b.step));
  for (const s of ordered) byPath.set(pathOf(s.step), [...(byPath.get(pathOf(s.step)) ?? []), s]);
  return [...byPath.entries()]
    .sort(([a], [b]) => (a === 'main' ? -1 : b === 'main' ? 1 : a.localeCompare(b)))
    .map(([name, onPath]) => ({ name, steps: onPath }));
}

/** The projection: the read model's table, built from the rows on each read (in memory; nothing keeps it). */
export function useCaseTableFrom(view: ReadView): UseCaseTable {
  const [invokes, happensIn, fulfills, exchangesWith, startsFrom] = ['invokes', 'happens_in', 'fulfills', 'exchanges_with', 'starts_from'].map((t) => targets(view, t));
  const actors = grouped<{ position: number; role_name: string }>(view.rows('use_case_actor'), 'use_case_id');
  const requirements = grouped<UcRequirementRow>(view.rows('uc_requirement'), 'use_case_id');
  const useCaseTests = grouped<UseCaseTestRow>(view.rows('use_case_test'), 'uc_requirement_id');
  const flows = grouped<FlowRow>(view.rows('flow'), 'use_case_id');
  const steps = grouped<FlowStepRow>(view.rows('flow_step'), 'flow_id');
  const flowTests = grouped<FlowTestRow>(view.rows('flow_test'), 'flow_id');
  const tested = <T extends { id: string }>(test: T): TestOnPage<T> => ({ test, startsFrom: startsFrom(test.id) });

  const useCases = new Map<string, UseCaseTree>();
  const holding = new Map<string, { root: string; kind: UseCaseKind }>();
  for (const useCase of view.rows('use_case') as unknown as UseCaseRow[]) {
    const root = useCase.id;
    const hold = (id: string, kind: UseCaseKind) => holding.set(id, { root, kind });
    hold(root, 'use_case');
    const ownFlows = [...(flows.get(root) ?? [])].sort((a, b) => a.interface_id.localeCompare(b.interface_id) || byRecordId(a, b));
    const ownSteps = ownFlows.flatMap((f) =>
      (steps.get(f.id) ?? []).map((step) => ({ step, invokes: invokes(step.id)[0] ?? null, happensIn: happensIn(step.id)[0] ?? null, fulfills: fulfills(step.id), exchangesWith: exchangesWith(step.id) })),
    );
    const tree: UseCaseTree = {
      useCase,
      actors: [...(actors.get(root) ?? [])].sort((a, b) => Number(a.position) - Number(b.position)).map((a) => String(a.role_name)),
      requirements: [...(requirements.get(root) ?? [])].sort(byRecordId).map((requirement) => ({
        requirement,
        tests: [...(useCaseTests.get(requirement.id) ?? [])].sort(byRecordId).map(tested),
        fulfilledBy: ownSteps.filter((s) => s.fulfills.includes(requirement.id)).map((s) => s.step.id).sort(),
      })),
      flows: ownFlows.map((flow) => {
        const test = (flowTests.get(flow.id) ?? [])[0];
        return { flow, paths: pathsOf(ownSteps.filter((s) => s.step.flow_id === flow.id)), test: test ? tested(test) : null };
      }),
    };
    for (const r of tree.requirements) {
      hold(r.requirement.id, 'uc_requirement');
      for (const t of r.tests) hold(t.test.id, 'use_case_test');
    }
    for (const f of tree.flows) {
      hold(f.flow.id, 'flow');
      for (const p of f.paths) for (const s of p.steps) hold(s.step.id, 'flow_step');
      if (f.test) hold(f.test.test.id, 'flow_test');
    }
    useCases.set(root, tree);
  }

  const productOf = new Map(view.rows('domain').map((d) => [String(d.id), String(d.product_id)]));
  const listed = grouped<UseCaseRow>(view.rows('use_case'), 'capability_id');
  const capabilities = new Map(
    view.rows('capability').map((c) => [
      String(c.id),
      { domain: String(c.domain_id), product: productOf.get(String(c.domain_id)) ?? '', useCases: (listed.get(String(c.id)) ?? []).map((u) => ({ id: u.id, title: u.title })).sort(byRecordId) },
    ]),
  );
  const interfaces = new Map([...grouped<{ id: string }>(view.rows('interface'), 'product_id')].map(([product, rows]) => [product, rows.map((i) => i.id).sort()]));
  const kinds = new Map<string, string>();
  for (const kind of Object.keys(view.schema.kinds)) for (const row of view.rows(kind)) kinds.set(String(row.id), kind);
  return { useCases, holding, capabilities, interfaces, kinds };
}
