import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { ProjectionRow } from '../../../platform/data/tables.ts';
import { ADD_PROJECTION_IDENTITY } from './identities.generated.ts';
import { addProjection } from './handlers.generated.ts';

export type AddProjection = Pick<ProjectionRow, 'id' | 'title' | 'read_model_id' | 'file' | 'description'> & { meets?: string[]; packages?: string[]; helpers?: string[] };

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
    helpers: texts('The helper files its code is split across beside its file, such as helpers and build-tag variants, each from the product root; no other record names one.', 'optional'),
  },
  handler: addProjection,
} satisfies CommandDefinition<AddProjection>;
