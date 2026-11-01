import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { DataModelRow } from '../../../platform/data/tables.ts';
import { changed } from '../model.ts';
import { AggregateRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { CHANGE_DATA_MODEL_IDENTITY } from './identities.generated.ts';

/** The data model's changes: a column given is set, null clears an optional one; a list given replaces its list. */
export type ChangeDataModel = Pick<DataModelRow, 'id'> & { title?: string; file?: string | null; meets?: string[]; packages?: string[] };

export const CHANGE_DATA_MODEL = {
  ...CHANGE_DATA_MODEL_IDENTITY,
  input: {
    id: column('data_model', 'id', 'required'),
    title: column('data_model', 'title', 'optional'),
    file: column('data_model', 'file', 'clearable'),
    meets: ids('The standard rules it follows. Replaces the list.', 'optional'),
    packages: texts('The packages it uses. Replaces the list.', 'optional'),
  },
  handler: changeDataModel,
} satisfies CommandDefinition<ChangeDataModel>;

/** Changes the data model's columns and links. */
export function changeDataModel(tx: Transaction, input: ChangeDataModel): void {
  const aggregates = new AggregateRepository(tx);
  const aggregate = aggregates.loadHolding('data_model', input.id) ?? tx.refuse('missing', `there is no data model ${input.id}`);
  aggregate.dataModels = aggregate.dataModels.map((d) =>
    d.row.id === input.id ? { row: changed(d.row, input, ['title', 'file']), meets: input.meets ?? d.meets, packages: input.packages ?? d.packages } : d,
  );
  holdToRules(tx, aggregate);
  aggregates.save(aggregate);
}
