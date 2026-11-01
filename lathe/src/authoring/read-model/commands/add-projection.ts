import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { ProjectionRow } from '../../../platform/data/tables.ts';
import { ReadModelRepository } from '../repository.ts';
import { readModelOneEach, holdToRules } from '../rules.ts';
import { refuseBroken } from '../../../platform/data/rules.ts';
import { ADD_PROJECTION_IDENTITY } from './identities.generated.ts';

export type AddProjection = Pick<ProjectionRow, 'id' | 'title' | 'read_model_id' | 'file' | 'description'> & { meets?: string[]; packages?: string[] };

export const ADD_PROJECTION = {
  ...ADD_PROJECTION_IDENTITY,
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
} satisfies CommandDefinition<AddProjection>;

/** Adds the projection to its read model, which has none yet. */
export function addProjection(tx: Transaction, input: AddProjection): void {
  const readModels = new ReadModelRepository(tx);
  const readModel = readModels.load(input.read_model_id) ?? tx.refuse('missing', `there is no read model ${input.read_model_id}`);
  const { meets = [], packages = [], ...row } = input;
  refuseBroken(readModelOneEach([...(readModel.projection ? [readModel.projection.row] : []), row], [], []));
  readModel.projection = { row, meets, packages };
  holdToRules(tx, readModel);
  readModels.save(readModel);
}
