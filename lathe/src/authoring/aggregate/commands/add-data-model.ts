import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { DataModelRow } from '../../../platform/data/tables.ts';
import { AggregateRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { ADD_DATA_MODEL_IDENTITY } from './identities.generated.ts';

export type AddDataModel = Pick<DataModelRow, 'id' | 'title' | 'entity_id' | 'file'> & { meets?: string[]; packages?: string[] };

export const ADD_DATA_MODEL = {
  ...ADD_DATA_MODEL_IDENTITY,
  input: {
    id: column('data_model', 'id', 'required'),
    title: column('data_model', 'title', 'required'),
    entity_id: column('data_model', 'entity_id', 'required'),
    file: column('data_model', 'file', 'optional'),
    meets: ids('The standard rules it follows.', 'optional'),
    packages: texts('The packages it uses, each listed in one of the product\'s package.json files.', 'optional'),
  },
  handler: addDataModel,
} satisfies CommandDefinition<AddDataModel>;

export function addDataModel(tx: Transaction, input: AddDataModel): void {
  const aggregates = new AggregateRepository(tx);
  const aggregate = aggregates.loadHolding('entity', input.entity_id) ?? tx.refuse('missing', `there is no entity ${input.entity_id}`);
  const { meets = [], packages = [], ...row } = input;
  aggregate.dataModels.push({ row, meets, packages });
  holdToRules(tx, aggregate);
  aggregates.save(aggregate);
}
