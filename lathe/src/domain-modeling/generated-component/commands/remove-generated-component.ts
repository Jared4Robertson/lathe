import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_GENERATED_COMPONENT_IDENTITY } from './identities.generated.ts';
import { removeGeneratedComponent } from './handlers.generated.ts';

/** The generated component to remove. */
export type RemoveGeneratedComponent = { id: string };

export const REMOVE_GENERATED_COMPONENT = {
  ...REMOVE_GENERATED_COMPONENT_IDENTITY,
  input: {
    id: column('generated_component', 'id', 'required'),
  },
  handler: removeGeneratedComponent,
} satisfies CommandDefinition<RemoveGeneratedComponent>;
