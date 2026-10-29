// Add a read model (LA-AUT-CMD285): Adds a read model to its domain, with its fields in order, the aggregates it reads, the domain services its projection calls and the events that feed it.
import { column, ids, parts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { ReadModelRow } from '../../../platform/data/tables.ts';
import { FIELD_COLUMNS, READ_MODEL_SLICE, newReadModel, type ReadModelField } from '../model.ts';
import { ReadModelRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** A new read model, with its fields and the links it starts. */
export type AddReadModel = Pick<ReadModelRow, 'id' | 'title' | 'domain_id' | 'description'> & { fields?: ReadModelField[]; reads?: string[]; calls?: string[]; fed_by?: string[] };

/** Add a read model (LA-AUT-CMD285). */
export const ADD_READ_MODEL: CommandDefinition<AddReadModel> = {
  id: 'LA-AUT-CMD285',
  slice: READ_MODEL_SLICE,
  name: 'add-read-model',
  description: 'Adds a read model to its domain, with its fields in order, the aggregates it reads, the domain services its projection calls and the events that feed it.',
  method: 'POST',
  route: '/api/read-model/add-read-model',
  input: {
    id: column('read_model', 'id', 'required'),
    title: column('read_model', 'title', 'required'),
    domain_id: column('read_model', 'domain_id', 'required'),
    description: column('read_model', 'description', 'required'),
    fields: parts('read_model_field', FIELD_COLUMNS, "Its fields in order, each a name, what it means, exactly one type (a basic type, a value object or an aggregate), whether it is required, and its column's name and an example when they help.", 'optional'),
    reads: ids('The aggregates it reads, of its own domain.', 'optional'),
    calls: ids('The domain services its projection calls, of its own domain.', 'optional'),
    fed_by: ids("The events that keep it current: its own domain's, or another domain's published ones.", 'optional'),
  },
  handler: addReadModel,
};

/** Adds the read model, whole and new, with its fields and links. */
export function addReadModel(tx: Transaction, input: AddReadModel): void {
  const readModels = new ReadModelRepository(tx);
  if (tx.record(input.domain_id)?.kind !== 'domain') tx.refuse('missing', `there is no domain ${input.domain_id}`);
  const { fields = [], reads = [], calls = [], fed_by = [], ...row } = input;
  const readModel = readModels.create(newReadModel(row, { fields, reads, calls, fedBy: fed_by }));
  holdToRules(tx, readModel);
  readModels.save(readModel);
}
