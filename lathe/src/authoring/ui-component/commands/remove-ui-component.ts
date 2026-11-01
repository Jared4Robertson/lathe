import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { UiComponentRepository } from '../repository.ts';
import { REMOVE_UI_COMPONENT_IDENTITY } from './identities.generated.ts';

/** The UI component to remove. */
export type RemoveUiComponent = { id: string };

export const REMOVE_UI_COMPONENT = {
  ...REMOVE_UI_COMPONENT_IDENTITY,
  input: {
    id: column('ui_component', 'id', 'required'),
  },
  handler: removeUiComponent,
} satisfies CommandDefinition<RemoveUiComponent>;

/** Removes the UI component whole. */
export function removeUiComponent(tx: Transaction, input: RemoveUiComponent): void {
  const components = new UiComponentRepository(tx);
  const component = components.load(input.id) ?? tx.refuse('missing', `there is no UI component ${input.id}`);
  components.remove(component);
}
