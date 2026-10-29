// Add a projection (LA-AUT-CMD291): Adds the projection that fills a read model, its one piece of code, with the standard rules it meets and the packages it uses.
import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { ProjectionRow } from '../../../platform/data/tables.ts';
import { READ_MODEL_SLICE } from '../model.ts';
import { ReadModelRepository } from '../repository.ts';
import { readModelOneEach, holdToRules } from '../rules.ts';
import { refuseBroken } from '../../../platform/data/rules.ts';

/** A new projection, with the standard rules it meets and the packages it uses. */
export type AddProjection = Pick<ProjectionRow, 'id' | 'title' | 'read_model_id' | 'file' | 'description'> & { meets?: string[]; packages?: string[] };

/** Add a projection (LA-AUT-CMD291). */
export const ADD_PROJECTION: CommandDefinition<AddProjection> = {
  id: 'LA-AUT-CMD291',
  slice: READ_MODEL_SLICE,
  name: 'add-projection',
  description: 'Adds the projection that fills a read model, its one piece of code, with the standard rules it meets and the packages it uses.',
  method: 'POST',
  route: '/api/read-model/add-projection',
  input: {
    id: column('projection', 'id', 'required'),
    title: column('projection', 'title', 'required'),
    read_model_id: column('projection', 'read_model_id', 'required'),
    file: column('projection', 'file', 'optional'),
    description: column('projection', 'description', 'required'),
    meets: ids('The standard rules it meets.', 'optional'),
    packages: texts("The packages it uses, by their names in the product's package.json files.", 'optional'),
  },
  handler: addProjection,
};

/** Adds the projection to its read model, which has none yet. */
export function addProjection(tx: Transaction, input: AddProjection): void {
  const readModels = new ReadModelRepository(tx);
  const readModel = readModels.load(input.read_model_id) ?? tx.refuse('missing', `there is no read model ${input.read_model_id}`);
  const { meets = [], packages = [], ...row } = input;
  refuseBroken(readModelOneEach([...(readModel.projection ? [readModel.projection.row] : []), row], []));
  readModel.projection = { row, meets, packages };
  holdToRules(tx, readModel);
  readModels.save(readModel);
}
