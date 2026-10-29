// Change a UI component (LA-AUT-CMD346): Changes a UI component's title, file or description, or the views it renders, the standard rules it meets or the packages it uses (each list whole).
import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { UiComponentRow } from '../../../platform/data/tables.ts';
import { changed, UI_COMPONENT_SLICE } from '../model.ts';
import { UiComponentRepository } from '../repository.ts';

/** The UI component's changes: a column given is set, null clears an optional one; a list given replaces its list. */
export type ChangeUiComponent = Pick<UiComponentRow, 'id'> & { title?: UiComponentRow['title']; description?: UiComponentRow['description']; file?: UiComponentRow['file'] | null; renders?: string[]; meets?: string[]; packages?: string[] };

/** Change a UI component (LA-AUT-CMD346). */
export const CHANGE_UI_COMPONENT: CommandDefinition<ChangeUiComponent> = {
  id: 'LA-AUT-CMD346',
  slice: UI_COMPONENT_SLICE,
  name: 'change-ui-component',
  description: "Changes a UI component's title, file or description, or the views it renders, the standard rules it meets or the packages it uses (each list whole).",
  method: 'POST',
  route: '/api/ui-component/change-ui-component',
  input: {
    id: column('ui_component', 'id', 'required'),
    title: column('ui_component', 'title', 'optional'),
    description: column('ui_component', 'description', 'optional'),
    file: column('ui_component', 'file', 'clearable'),
    renders: ids('The views it renders, or part of. Replaces the list.', 'optional'),
    meets: ids('The standard rules it follows. Replaces the list.', 'optional'),
    packages: texts('The packages it uses. Replaces the list.', 'optional'),
  },
  handler: changeUiComponent,
};

/** Changes the UI component's columns and links. */
export function changeUiComponent(tx: Transaction, input: ChangeUiComponent): void {
  const components = new UiComponentRepository(tx);
  const component = components.load(input.id) ?? tx.refuse('missing', `there is no UI component ${input.id}`);
  component.component = changed(component.component, input, ['title', 'description', 'file']);
  component.renders = input.renders ?? component.renders;
  component.meets = input.meets ?? component.meets;
  component.packages = input.packages ?? component.packages;
  components.save(component);
}
