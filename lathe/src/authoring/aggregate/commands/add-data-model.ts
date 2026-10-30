// Add a data model (LA-AUT-CMD219): Adds the data model of an entity of the aggregate: its name in code and its file, with the standard rules it meets and the packages it uses.
import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { DataModelRow } from '../../../platform/data/tables.ts';
import { AGGREGATE_SLICE } from '../model.ts';
import { AggregateRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** A new data model, with the standard rules it meets and the packages it uses. */
export type AddDataModel = Pick<DataModelRow, 'id' | 'title' | 'entity_id' | 'file'> & { meets?: string[]; packages?: string[] };

/** Add a data model (LA-AUT-CMD219). */
export const ADD_DATA_MODEL: CommandDefinition<AddDataModel> = {
  id: 'LA-AUT-CMD219',
  slice: AGGREGATE_SLICE,
  name: 'add-data-model',
  description: 'Adds the data model of an entity of the aggregate: its name in code and its file, with the standard rules it meets and the packages it uses.',
  method: 'POST',
  route: '/api/aggregate/add-data-model',
  input: {
    id: column('data_model', 'id', 'required'),
    title: column('data_model', 'title', 'required'),
    entity_id: column('data_model', 'entity_id', 'required'),
    file: column('data_model', 'file', 'optional'),
    meets: ids('The standard rules it follows.', 'optional'),
    packages: texts('The packages it uses, each listed in one of the product\'s package.json files.', 'optional'),
  },
  handler: addDataModel,
};

/** Adds the data model under its entity, with its links. */
export function addDataModel(tx: Transaction, input: AddDataModel): void {
  const aggregates = new AggregateRepository(tx);
  const aggregate = aggregates.loadHolding('entity', input.entity_id) ?? tx.refuse('missing', `there is no entity ${input.entity_id}`);
  const { meets = [], packages = [], ...row } = input;
  aggregate.dataModels.push({ row, meets, packages });
  holdToRules(tx, aggregate);
  aggregates.save(aggregate);
}
