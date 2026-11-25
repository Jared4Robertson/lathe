import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { GeneratedComponentRow } from '../../../platform/data/tables.ts';
import { ADD_GENERATED_COMPONENT_IDENTITY } from './identities.generated.ts';
import { addGeneratedComponent } from './handlers.generated.ts';

/** A new generated component: its row, and the business outcomes it serves. */
export type AddGeneratedComponent = Pick<GeneratedComponentRow, 'id' | 'title' | 'domain_id' | 'description'> & { serves?: string[] };

export const ADD_GENERATED_COMPONENT = {
  ...ADD_GENERATED_COMPONENT_IDENTITY,
  input: {
    id: column('generated_component', 'id', 'required'),
    title: column('generated_component', 'title', 'required'),
    domain_id: column('generated_component', 'domain_id', 'required'),
    description: column('generated_component', 'description', 'required'),
    serves: ids('The business outcomes of its product it serves: what its consumers rely on it for.', 'optional'),
  },
  handler: addGeneratedComponent,
} satisfies CommandDefinition<AddGeneratedComponent>;
