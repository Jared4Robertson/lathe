import { column, ids, parts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { EntityRow } from '../../../platform/data/tables.ts';
import { AGGREGATE_SLICE, changed, fieldRows, type EntityFieldInput } from '../model.ts';
import { AggregateRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** The entity's changes: a column given is set, null clears an optional one; a list given replaces its list. */
export type ChangeEntity = Pick<EntityRow, 'id'> & {
  title?: string;
  role?: EntityRow['role'];
  in_root_table?: boolean | null;
  description?: string;
  fields?: EntityFieldInput[];
  has_one?: string[];
  has_many?: string[];
};

export const CHANGE_ENTITY: CommandDefinition<ChangeEntity> = {
  id: 'LA-AUT-CMD214',
  slice: AGGREGATE_SLICE,
  name: 'change-entity',
  description: "Changes an entity's title, role, description or whether it is stored in its root's table, or its fields (the whole list, in order) or the entities it holds (each list whole). Its aggregate does not change.",
  method: 'POST',
  route: '/api/aggregate/change-entity',
  input: {
    id: column('entity', 'id', 'required'),
    title: column('entity', 'title', 'optional'),
    role: column('entity', 'role', 'optional'),
    in_root_table: column('entity', 'in_root_table', 'clearable'),
    description: column('entity', 'description', 'optional'),
    fields: parts('entity_field', ['name', 'meaning', 'type', 'type_value_object_id', 'type_aggregate_id', 'required', 'column_name', 'example'], 'Its fields, in order. Replaces the list.', 'optional'),
    has_one: ids('The entities of its aggregate it holds exactly one of. Replaces the list.', 'optional'),
    has_many: ids('The entities of its aggregate it holds any number of. Replaces the list.', 'optional'),
  },
  handler: changeEntity,
};

/** Changes the entity's columns, fields and links. */
export function changeEntity(tx: Transaction, input: ChangeEntity): void {
  const aggregates = new AggregateRepository(tx);
  const aggregate = aggregates.loadHolding('entity', input.id) ?? tx.refuse('missing', `there is no entity ${input.id}`);
  aggregate.entities = aggregate.entities.map((entity) => {
    if (entity.row.id !== input.id) return entity;
    return {
      row: changed(entity.row, input, ['title', 'role', 'in_root_table', 'description']),
      fields: input.fields ? fieldRows(input.id, input.fields) : entity.fields,
      hasOne: input.has_one ?? entity.hasOne,
      hasMany: input.has_many ?? entity.hasMany,
    };
  });
  holdToRules(tx, aggregate);
  aggregates.save(aggregate);
}
