// Add an entity (LA-AUT-CMD213): Adds an entity to its aggregate, as its root or a child, with its fields in order and the entities of its aggregate it holds.
import { column, ids, parts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { EntityRow } from '../../../platform/data/tables.ts';
import { AGGREGATE_SLICE, fieldRows, type EntityFieldInput } from '../model.ts';
import { AggregateRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** A new entity, with its fields in order and the entities it holds. */
export type AddEntity = Pick<EntityRow, 'id' | 'title' | 'aggregate_id' | 'role' | 'in_root_table' | 'description'> & {
  fields?: EntityFieldInput[];
  has_one?: string[];
  has_many?: string[];
};

/** Add an entity (LA-AUT-CMD213). */
export const ADD_ENTITY: CommandDefinition<AddEntity> = {
  id: 'LA-AUT-CMD213',
  slice: AGGREGATE_SLICE,
  name: 'add-entity',
  description: 'Adds an entity to its aggregate, as its root or a child, with its fields in order and the entities of its aggregate it holds.',
  method: 'POST',
  route: '/api/aggregate/add-entity',
  input: {
    id: column('entity', 'id', 'required'),
    title: column('entity', 'title', 'required'),
    aggregate_id: column('entity', 'aggregate_id', 'required'),
    role: column('entity', 'role', 'required'),
    in_root_table: column('entity', 'in_root_table', 'optional'),
    description: column('entity', 'description', 'required'),
    fields: parts('entity_field', ['name', 'meaning', 'type', 'type_value_object_id', 'type_aggregate_id', 'required', 'column_name', 'example'], 'Its fields, in order: each its name, meaning, one type (a basic type, a value object or an aggregate), whether it is required, and its column name and an example when it has them.', 'optional'),
    has_one: ids('The entities of its aggregate it holds exactly one of.', 'optional'),
    has_many: ids('The entities of its aggregate it holds any number of.', 'optional'),
  },
  handler: addEntity,
};

/** Adds the entity to its aggregate, with its fields and links. */
export function addEntity(tx: Transaction, input: AddEntity): void {
  const aggregates = new AggregateRepository(tx);
  const aggregate = aggregates.loadHolding('aggregate', input.aggregate_id) ?? tx.refuse('missing', `there is no aggregate ${input.aggregate_id}`);
  const { fields = [], has_one = [], has_many = [], ...row } = input;
  aggregate.entities.push({ row, fields: fieldRows(row.id, fields), hasOne: has_one, hasMany: has_many });
  holdToRules(tx, aggregate);
  aggregates.save(aggregate);
}
