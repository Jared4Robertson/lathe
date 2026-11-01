import { column, ids, parts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { ReadModelRow } from '../../../platform/data/tables.ts';
import { FIELD_COLUMNS, changed, type ReadModelField } from '../model.ts';
import { ReadModelRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { CHANGE_READ_MODEL_IDENTITY } from './identities.generated.ts';

/** The read model's changes: a column given is set; a list given replaces the list. */
export type ChangeReadModel = Pick<ReadModelRow, 'id'> & { title?: ReadModelRow['title']; description?: ReadModelRow['description']; fields?: ReadModelField[]; reads?: string[]; calls?: string[]; fed_by?: string[] };

export const CHANGE_READ_MODEL = {
  ...CHANGE_READ_MODEL_IDENTITY,
  input: {
    id: column('read_model', 'id', 'required'),
    title: column('read_model', 'title', 'optional'),
    description: column('read_model', 'description', 'optional'),
    fields: parts('read_model_field', FIELD_COLUMNS, "Its fields in order, each a name, what it means, exactly one type (a basic type, a value object or an aggregate), whether it is required, and its column's name and an example when they help. Replaces the list.", 'optional'),
    reads: ids('The aggregates it reads, of its own domain. Replaces the list.', 'optional'),
    calls: ids('The domain services its projection calls, of its own domain. Replaces the list.', 'optional'),
    fed_by: ids("The events that keep it current: its own domain's, or another domain's published ones. Replaces the list.", 'optional'),
  },
  handler: changeReadModel,
} satisfies CommandDefinition<ChangeReadModel>;

/** Changes the read model's columns, fields and links. */
export function changeReadModel(tx: Transaction, input: ChangeReadModel): void {
  const readModels = new ReadModelRepository(tx);
  const readModel = readModels.load(input.id) ?? tx.refuse('missing', `there is no read model ${input.id}`);
  readModel.readModel = changed(readModel.readModel, input, ['title', 'description']);
  if (input.fields) readModel.fields = input.fields;
  if (input.reads) readModel.reads = input.reads;
  if (input.calls) readModel.calls = input.calls;
  if (input.fed_by) readModel.fedBy = input.fed_by;
  holdToRules(tx, readModel);
  readModels.save(readModel);
}
