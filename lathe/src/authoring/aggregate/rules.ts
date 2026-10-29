// The Aggregate aggregate's rules, written once: each command's handler runs them on the instance before it saves,
// and every load and commit runs them over all data (aggregateRules, listed in AGGREGATE_RULES).
import type { AggregateRules, ReadView, RuleProblem } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { AGGREGATE_AGGREGATE, aggregatesFrom, type Aggregate } from './model.ts';

/** Every rule the aggregate breaks (LA-AUT-INV12 an aggregate has at most one root). */
export function aggregateProblems(aggregate: Aggregate): RuleProblem[] {
  const problems: RuleProblem[] = [];
  const roots = aggregate.entities.filter((e) => e.row.role === 'root').length;
  if (roots > 1) {
    problems.push({
      rule: 'aggregate-root',
      table: 'aggregate',
      row: aggregate.aggregate as unknown as Row,
      message: `aggregate ${aggregate.root} has ${roots} root entities; an aggregate has one root`,
    });
  }
  return problems;
}

/** The rules over all data: every aggregate, whole. */
export const aggregateRules: AggregateRules = {
  aggregate: AGGREGATE_AGGREGATE,
  check: (view: ReadView) => aggregatesFrom((table) => view.rows(table)).flatMap((aggregate) => aggregateProblems(aggregate)),
};

/** Refuses the command, with every reason, when the aggregate as it would be saved breaks one of its rules. */
export function holdToRules(_tx: Transaction, aggregate: Aggregate): void {
  const problems = aggregateProblems(aggregate);
  if (problems.length) throw new StoreError(problems.map((p) => ({ rule: p.rule, table: p.table, message: p.message, command: 0 })));
}
