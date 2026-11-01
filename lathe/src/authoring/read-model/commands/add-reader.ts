import { column, id, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { ReaderRow } from '../../../platform/data/tables.ts';
import { ReadModelRepository } from '../repository.ts';
import { refuseBroken } from '../../../platform/data/rules.ts';
import { holdToRules, readModelOneEach } from '../rules.ts';
import { ADD_READER_IDENTITY } from './identities.generated.ts';

export type AddReader = Pick<ReaderRow, 'id' | 'title' | 'read_model_id' | 'file' | 'description'> & { stored_in?: string; meets?: string[]; packages?: string[] };

export const ADD_READER: CommandDefinition<AddReader> = {
  ...ADD_READER_IDENTITY,
  input: {
    id: column('reader', 'id', 'required'),
    title: column('reader', 'title', 'required'),
    read_model_id: column('reader', 'read_model_id', 'required'),
    file: column('reader', 'file', 'optional'),
    description: column('reader', 'description', 'required'),
    stored_in: id("The data store it reads its read model's table in.", 'optional'),
    meets: ids('The standard rules it meets.', 'optional'),
    packages: texts("The packages it uses, by their names in the product's package.json files.", 'optional'),
  },
  handler: addReader,
};

/** Adds the reader to its read model, which has none yet (LA-AUT-INV107). */
export function addReader(tx: Transaction, input: AddReader): void {
  const readModels = new ReadModelRepository(tx);
  const readModel = readModels.load(input.read_model_id) ?? tx.refuse('missing', `there is no read model ${input.read_model_id}`);
  const { stored_in, meets = [], packages = [], ...row } = input;
  refuseBroken(readModelOneEach([], [...(readModel.reader ? [readModel.reader.row] : []), row], []));
  readModel.reader = { row, storedIn: stored_in ?? null, meets, packages };
  holdToRules(tx, readModel);
  readModels.save(readModel);
}
