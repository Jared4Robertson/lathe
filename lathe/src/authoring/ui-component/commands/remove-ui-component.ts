import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { UI_COMPONENT_SLICE } from '../model.ts';
import { UiComponentRepository } from '../repository.ts';

/** The UI component to remove. */
export type RemoveUiComponent = { id: string };

export const REMOVE_UI_COMPONENT: CommandDefinition<RemoveUiComponent> = {
  id: 'LA-AUT-CMD347',
  slice: UI_COMPONENT_SLICE,
  name: 'remove-ui-component',
  description: 'Removes a UI component whole: the links it starts and the packages it uses. Refused while anything outside it references what is in it.',
  method: 'POST',
  route: '/api/ui-component/remove-ui-component',
  input: {
    id: column('ui_component', 'id', 'required'),
  },
  handler: removeUiComponent,
};

/** Removes the UI component whole. */
export function removeUiComponent(tx: Transaction, input: RemoveUiComponent): void {
  const components = new UiComponentRepository(tx);
  const component = components.load(input.id) ?? tx.refuse('missing', `there is no UI component ${input.id}`);
  components.remove(component);
}
