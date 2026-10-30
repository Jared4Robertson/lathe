// The Aggregate aggregate's rules, written once: each command's handler runs them on the instance before it saves,
// and every load and commit runs them over all data (aggregateRules, listed in AGGREGATE_RULES).
import { beyondFirst, type AggregateRules, type ReadView, type RuleProblem } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { EntityFieldRow } from '../../platform/data/tables.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { AGGREGATE_AGGREGATE, aggregatesFrom, type Aggregate } from './model.ts';

/** A field's name as people read it: trimmed, and in any letter case. */
const spoken = (name: string) => name.trim().toLowerCase();

/**
 * Every field of an entity that breaks LA-AUT-INV15 (a field is typed by exactly one of a basic type, a value object or
 * an aggregate) or LA-AUT-INV16 (no two fields of one entity have the same name, trimmed and in any letter case).
 */
function entityFieldProblems(fields: readonly EntityFieldRow[]): RuleProblem[] {
  const problems: RuleProblem[] = [];
  const named = new Map<string, EntityFieldRow>();
  for (const field of fields) {
    const types = [field.type, field.type_value_object_id, field.type_aggregate_id].filter((t) => t !== undefined && t !== null);
    if (types.length !== 1) {
      problems.push({
        rule: 'entity-field-one-type',
        table: 'entity_field',
        row: field as unknown as Row,
        message: `field ${field.name} of entity ${field.entity_id} is typed by ${types.length ? types.join(' and ') : 'nothing'}: a field has exactly one of a basic type, a value object or an aggregate`,
      });
    }
    const earlier = named.get(spoken(field.name));
    if (earlier) {
      problems.push({
        rule: 'entity-field-name',
        table: 'entity_field',
        row: field as unknown as Row,
        message: `entity ${field.entity_id} already has a field named ${earlier.name}, so its field ${field.position} cannot be named ${field.name}: a field's name is its own in its entity, trimmed and in any letter case`,
      });
    } else named.set(spoken(field.name), field);
  }
  return problems;
}

/**
 * Every has_one or has_many link of the aggregate's entities that reaches outside it (LA-AUT-INV25: parts stay inside
 * their aggregate). The view gives the aggregate of the entity it reaches.
 */
function crossingParts(aggregate: Aggregate, view: ReadView): RuleProblem[] {
  const own = new Set(aggregate.entities.map((e) => e.row.id));
  const problems: RuleProblem[] = [];
  for (const entity of aggregate.entities) {
    for (const [relation, targets] of [['has_one', entity.hasOne], ['has_many', entity.hasMany]] as const) {
      for (const target of targets) {
        if (own.has(target)) continue;
        const other = view.record(target);
        problems.push({
          rule: 'has-crosses-aggregate',
          table: relation,
          row: { source_id: entity.row.id, target_id: target },
          message: `${entity.row.id} is an entity of aggregate ${aggregate.root}, so it cannot ${relation} ${target}, ${other?.kind === 'entity' ? `an entity of aggregate ${String(other.row.aggregate_id)}` : 'which is not one of its entities'}: parts stay inside their aggregate; type a field by the other aggregate instead, or move the part into this one`,
        });
      }
    }
  }
  return problems;
}

/**
 * Every rule the aggregate breaks (LA-AUT-INV12 an aggregate has at most one root; LA-AUT-INV102 an entity has at most
 * one data model, and an invariant at most one rule and one invariant test; LA-AUT-INV15 and INV16 its entities'
 * fields, as entityFieldProblems says; LA-AUT-INV25 its parts stay inside it). The view gives the entities its links
 * reach outside it.
 */
export function aggregateProblems(aggregate: Aggregate, view: ReadView): RuleProblem[] {
  const problems: RuleProblem[] = [];
  for (const entity of aggregate.entities) problems.push(...entityFieldProblems(entity.fields));
  problems.push(...crossingParts(aggregate, view));
  const second = (table: string, what: string, parent: string) => (r: { id: string }, of: string) => ({
    rule: 'aggregate-one-each',
    table,
    row: r as unknown as Row,
    message: `${parent} ${of} already has its ${what}, so ${r.id} cannot be a second: ${/^[aeiou]/.test(parent) ? 'an' : 'a'} ${parent} has one`,
  });
  const dataModel = second('data_model', 'data model', 'entity');
  const rule = second('rule', 'rule', 'invariant');
  const test = second('invariant_test', 'test', 'invariant');
  problems.push(
    ...beyondFirst(aggregate.dataModels.map((d) => d.row), (r) => r.entity_id).map((r) => dataModel(r, r.entity_id)),
    ...beyondFirst(aggregate.rules.map((d) => d.row), (r) => r.invariant_id).map((r) => rule(r, r.invariant_id)),
    ...beyondFirst(aggregate.invariantTests.map((t) => t.row), (r) => r.invariant_id).map((r) => test(r, r.invariant_id)),
  );
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
  check: (view: ReadView) => aggregatesFrom((table) => view.rows(table)).flatMap((aggregate) => aggregateProblems(aggregate, view)),
};

/** Refuses the command, with every reason, when the aggregate as it would be saved breaks one of its rules. */
export function holdToRules(tx: Transaction, aggregate: Aggregate): void {
  const problems = aggregateProblems(aggregate, tx);
  if (problems.length) throw new StoreError(problems.map((p) => ({ rule: p.rule, table: p.table, message: p.message })));
}
