// The Read model aggregate's rules, written once: each command's handler runs them on the instance before it saves,
// and every load and commit runs them over all data (readModelRules, listed in AGGREGATE_RULES).
import { beyondFirst, type AggregateRules, type ReadView, type RuleProblem } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { ProjectionRow, QueryHandlerRow, ReaderRow, ReadModelFieldRow } from '../../platform/data/tables.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { READ_MODEL_AGGREGATE, readModelRows, readModelsFrom, type ReadModel } from './model.ts';

// The domain of the aggregate with this ID, read from the view, or undefined.
function domainOfAggregate(view: ReadView, aggregateId: unknown): string | undefined {
  const aggregate = view.record(String(aggregateId));
  return aggregate?.kind === 'aggregate' ? String(aggregate.row.domain_id) : undefined;
}

/**
 * Every row that breaks LA-AUT-INV107: a read model has at most one projection and at most one reader, and a query at
 * most one query handler. Each after the first of its parent is refused.
 */
export function readModelOneEach(projections: readonly ProjectionRow[], readers: readonly ReaderRow[], queryHandlers: readonly QueryHandlerRow[]): RuleProblem[] {
  return [
    ...beyondFirst(projections, (r) => r.read_model_id).map((r) => ({
      rule: 'read-model-one-each',
      table: 'projection',
      row: r as unknown as Row,
      message: `read model ${r.read_model_id} already has its projection, so ${r.id} cannot be a second: a read model has one`,
    })),
    ...beyondFirst(readers, (r) => r.read_model_id).map((r) => ({
      rule: 'read-model-one-each',
      table: 'reader',
      row: r as unknown as Row,
      message: `read model ${r.read_model_id} already has its reader, so ${r.id} cannot be a second: a read model has one`,
    })),
    ...beyondFirst(queryHandlers, (r) => r.query_id).map((r) => ({
      rule: 'read-model-one-each',
      table: 'query_handler',
      row: r as unknown as Row,
      message: `query ${r.query_id} already has its query handler, so ${r.id} cannot be a second: a query has one`,
    })),
  ];
}

/** A field's name as people read it: trimmed, and in any letter case. */
const spoken = (name: string) => name.trim().toLowerCase();

/**
 * Every field of the read model that breaks LA-AUT-INV184 (a field is typed by exactly one of a basic type, a value
 * object or an aggregate) or LA-AUT-INV185 (no two fields of one read model have the same name, trimmed and in any
 * letter case).
 */
function readModelFieldProblems(readModel: ReadModel): RuleProblem[] {
  const problems: RuleProblem[] = [];
  const named = new Map<string, ReadModelFieldRow>();
  for (const field of readModelRows(readModel).get('read_model_field') as unknown as ReadModelFieldRow[]) {
    const types = [field.type, field.type_value_object_id, field.type_aggregate_id].filter((t) => t !== undefined && t !== null);
    const row = field as unknown as Row;
    if (types.length !== 1) {
      problems.push({ rule: 'read-model-field-one-type', table: 'read_model_field', row, message: `field ${field.name} of read model ${field.read_model_id} is typed by ${types.length ? types.join(' and ') : 'nothing'}: a field has exactly one of a basic type, a value object or an aggregate` });
    }
    const earlier = named.get(spoken(field.name));
    if (earlier) {
      problems.push({ rule: 'read-model-field-name', table: 'read_model_field', row, message: `read model ${field.read_model_id} already has a field named ${earlier.name}, so its field ${field.position} cannot be named ${field.name}: a field's name is its own in its read model, trimmed and in any letter case` });
    } else named.set(spoken(field.name), field);
  }
  return problems;
}

/**
 * Every rule the read model breaks (LA-AUT-INV80 a read model is fed by its own domain's events, or another domain's
 * published ones; LA-AUT-INV184 and INV185 its fields, as readModelFieldProblems says). The view gives what the read
 * model names outside itself: the events that feed it.
 */
export function readModelProblems(readModel: ReadModel, view: ReadView): RuleProblem[] {
  const problems: RuleProblem[] = readModelFieldProblems(readModel);
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
  problems.push(...readModelOneEach(readModel.projection ? [readModel.projection.row] : [], readModel.reader ? [readModel.reader.row] : [], readModel.queryHandlers.map((h) => h.row)));
  return problems;
}

/** The rules over all data: every read model, whole. */
export const readModelRules: AggregateRules = {
  aggregate: READ_MODEL_AGGREGATE,
  check: (view) => [
    ...readModelsFrom((table) => view.rows(table)).flatMap((readModel) => readModelProblems(readModel, view).filter((p) => p.rule !== 'read-model-one-each')),
    ...readModelOneEach(view.rows('projection') as unknown as ProjectionRow[], view.rows('reader') as unknown as ReaderRow[], view.rows('query_handler') as unknown as QueryHandlerRow[]),
  ],
};

/** Refuses the command, with every reason, when the read model as it would be saved breaks one of its rules. */
export function holdToRules(tx: Transaction, readModel: ReadModel): void {
  const problems = readModelProblems(readModel, tx);
  if (problems.length) throw new StoreError(problems.map((p) => ({ rule: p.rule, table: p.table, message: p.message, command: 0 })));
}
