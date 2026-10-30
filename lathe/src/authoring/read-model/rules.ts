// The Read model aggregate's rules, written once: each command's handler runs them on the instance before it saves,
// and every load and commit runs them over all data (readModelRules, listed in AGGREGATE_RULES).
import { beyondFirst, type AggregateRules, type ReadView, type RuleProblem } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { ProjectionRow, QueryHandlerRow } from '../../platform/data/tables.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { READ_MODEL_AGGREGATE, readModelsFrom, type ReadModel } from './model.ts';

// The domain of the aggregate with this ID, read from the view, or undefined.
function domainOfAggregate(view: ReadView, aggregateId: unknown): string | undefined {
  const aggregate = view.record(String(aggregateId));
  return aggregate?.kind === 'aggregate' ? String(aggregate.row.domain_id) : undefined;
}

/**
 * Every row that breaks LA-AUT-INV107: a read model has at most one projection, and a query at most one query handler.
 * Each after the first of its parent is refused.
 */
export function readModelOneEach(projections: readonly ProjectionRow[], queryHandlers: readonly QueryHandlerRow[]): RuleProblem[] {
  return [
    ...beyondFirst(projections, (r) => r.read_model_id).map((r) => ({
      rule: 'read-model-one-each',
      table: 'projection',
      row: r as unknown as Row,
      message: `read model ${r.read_model_id} already has its projection, so ${r.id} cannot be a second: a read model has one`,
    })),
    ...beyondFirst(queryHandlers, (r) => r.query_id).map((r) => ({
      rule: 'read-model-one-each',
      table: 'query_handler',
      row: r as unknown as Row,
      message: `query ${r.query_id} already has its query handler, so ${r.id} cannot be a second: a query has one`,
    })),
  ];
}

/**
 * Every rule the read model breaks (LA-AUT-INV80 a read model is fed by its own domain's events, or another domain's
 * published ones). The view gives what the read model names outside itself: the events that feed it.
 */
export function readModelProblems(readModel: ReadModel, view: ReadView): RuleProblem[] {
  const problems: RuleProblem[] = [];
  const own = readModel.readModel.domain_id;
  for (const eventId of readModel.fedBy) {
    const event = view.record(eventId);
    if (event?.kind !== 'domain_event' || event.row.published) continue;
    const other = domainOfAggregate(view, event.row.aggregate_id);
    if (other === own) continue;
    problems.push({
      rule: 'read-model-fed-by-published',
      table: 'fed_by',
      row: { source_id: readModel.root, target_id: eventId },
      message: `${readModel.root} is a read model of domain ${own}, so it cannot be fed by ${eventId}, an event of domain ${other ?? 'none'} that is not published`,
    });
  }
  problems.push(...readModelOneEach(readModel.projection ? [readModel.projection.row] : [], readModel.queryHandlers.map((h) => h.row)));
  return problems;
}

/** The rules over all data: every read model, whole. */
export const readModelRules: AggregateRules = {
  aggregate: READ_MODEL_AGGREGATE,
  check: (view) => [
    ...readModelsFrom((table) => view.rows(table)).flatMap((readModel) => readModelProblems(readModel, view).filter((p) => p.rule !== 'read-model-one-each')),
    ...readModelOneEach(view.rows('projection') as unknown as ProjectionRow[], view.rows('query_handler') as unknown as QueryHandlerRow[]),
  ],
};

/** Refuses the command, with every reason, when the read model as it would be saved breaks one of its rules. */
export function holdToRules(tx: Transaction, readModel: ReadModel): void {
  const problems = readModelProblems(readModel, tx);
  if (problems.length) throw new StoreError(problems.map((p) => ({ rule: p.rule, table: p.table, message: p.message, command: 0 })));
}
