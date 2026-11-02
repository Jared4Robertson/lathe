// The Journey aggregate's rules, written once: each command's handler runs them on the instance before it saves, and
// every load and commit runs them over all data (journeyRules, listed in AGGREGATE_RULES).
import { beyondFirst, type AggregateRules, type ReadView, type RuleProblem } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { JourneyStepRow, JourneyTestRow } from '../../platform/data/tables.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { JOURNEY_AGGREGATE, journeysFrom, type Journey } from './model.ts';

const asRow = (row: object) => row as unknown as Row;

/** Every row that breaks LA-PRD-INV190: a journey has at most one journey test. Each after the first is refused. */
export function journeyOneEach(tests: readonly JourneyTestRow[]): RuleProblem[] {
  return beyondFirst(tests, (t) => t.journey_id).map((t) => ({
    rule: 'journey-one-each',
    table: 'journey_test',
    row: asRow(t),
    message: `journey ${t.journey_id} already has its journey test, so ${t.id} cannot be a second: a journey has one`,
  }));
}

/** The product a use case or a policy belongs to, or undefined when it is neither or its owners are missing. */
function productOf(view: ReadView, id: string): string | undefined {
  const found = view.record(id);
  if (!found) return undefined;
  const domainOf = (domain: unknown) => view.record(String(domain))?.row.product_id as string | undefined;
  if (found.kind === 'use_case') return domainOf(view.record(String(found.row.capability_id))?.row.domain_id);
  if (found.kind === 'policy') {
    const entity = view.record(String(view.record(String(found.row.command_id))?.row.entity_id));
    return domainOf(view.record(String(entity?.row.aggregate_id))?.row.domain_id);
  }
  return undefined;
}

/**
 * Every rule the journey breaks (LA-PRD-INV187 a step's ID is its journey's and S<nn>; LA-PRD-INV188 the journey test's
 * is its journey's and T; LA-PRD-INV189 each step on a path has its own position; LA-PRD-INV190 one test, as
 * journeyOneEach says; LA-PRD-INV191 the journey, its outcomes and what its steps carry out are of one product;
 * LA-PRD-INV192 what a step carries out exists). The view gives what the journey names outside itself.
 */
export function journeyProblems(journey: Journey, view: ReadView): RuleProblem[] {
  const problems: RuleProblem[] = [];
  const stepId = new RegExp(`^${journey.root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-S\\d+$`);
  for (const { row } of journey.steps) {
    if (!stepId.test(row.id)) problems.push({ rule: 'journey-step-id', table: 'journey_step', row: asRow(row), message: `${row.id} is a step of ${journey.root}, so its ID is ${journey.root}-S and a number` });
  }
  for (const { row } of journey.tests) {
    if (row.id !== `${journey.root}-T`) problems.push({ rule: 'journey-test-id', table: 'journey_test', row: asRow(row), message: `${row.id} is the journey test of ${journey.root}, so its ID is ${journey.root}-T` });
  }
  // LA-PRD-INV189: the steps on each path of a journey each have their own position; a path is compared trimmed and in
  // any letter case, and steps on different paths may share a position.
  const placed = new Map<string, JourneyStepRow>();
  for (const { row } of journey.steps) {
    const at = `${row.path.trim().toLowerCase()} ${row.position}`;
    const holder = placed.get(at);
    if (holder === undefined) placed.set(at, row);
    else {
      problems.push({
        rule: 'journey-step-position',
        table: 'journey_step',
        row: asRow(row),
        message: `step ${holder.id} is at position ${row.position} of path ${holder.path.trim()} of ${journey.root}, so ${row.id} cannot be too: each step on a path has its own position`,
      });
    }
  }
  problems.push(...journeyOneEach(journey.tests.map((t) => t.row)));
  for (const target of journey.serves) {
    const outcome = view.record(target);
    if (outcome?.kind === 'business_outcome' && outcome.row.product_id !== journey.journey.product_id) {
      problems.push({ rule: 'journey-in-product', table: 'serves', row: { source_id: journey.root, target_id: target }, message: `${journey.root} is a journey of ${journey.journey.product_id}, so it cannot serve ${target}, an outcome of ${String(outcome.row.product_id)}` });
    }
  }
  for (const step of journey.steps) {
    if (step.carriesOut === null) continue;
    const row = { source_id: step.row.id, target_id: step.carriesOut };
    const target = view.record(step.carriesOut);
    if (!target) {
      problems.push({ rule: 'journey-carries-out-exists', table: 'carries_out', row, message: `${step.row.id} cannot carry out ${step.carriesOut}: there is no such use case or policy` });
      continue;
    }
    const product = productOf(view, step.carriesOut);
    if (product !== undefined && product !== journey.journey.product_id) {
      problems.push({ rule: 'journey-in-product', table: 'carries_out', row, message: `${step.row.id} is a step of ${journey.root}, a journey of ${journey.journey.product_id}, so it cannot carry out ${step.carriesOut}, of ${product}` });
    }
  }
  return problems;
}

/** The rules over all data: every journey, whole. */
export const journeyRules: AggregateRules = {
  aggregate: JOURNEY_AGGREGATE,
  check: (view) => [
    ...journeysFrom((table) => view.rows(table)).flatMap((journey) => journeyProblems(journey, view).filter((p) => p.rule !== 'journey-one-each')),
    ...journeyOneEach(view.rows('journey_test') as unknown as JourneyTestRow[]),
  ],
};

/** Refuses the command, with every reason, when the journey as it would be saved breaks one of its rules. */
export function holdToRules(tx: Transaction, journey: Journey): void {
  const problems = journeyProblems(journey, tx);
  if (problems.length) throw new StoreError(problems.map((p) => ({ rule: p.rule, table: p.table, message: p.message })));
}
