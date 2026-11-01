import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_UI_COMPONENT_IDENTITY } from './identities.generated.ts';
import { removeUiComponent } from './handlers.generated.ts';

/** The UI component to remove. */
export type RemoveUiComponent = { id: string };

export const REMOVE_UI_COMPONENT = {
  ...REMOVE_UI_COMPONENT_IDENTITY,
  input: {
    id: column('ui_component', 'id', 'required'),
  },
  handler: removeUiComponent,
} satisfies CommandDefinition<RemoveUiComponent>;
