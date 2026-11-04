import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { UiComponentRow } from '../../../platform/data/tables.ts';
import { CHANGE_UI_COMPONENT_IDENTITY } from './identities.generated.ts';
import { changeUiComponent } from './handlers.generated.ts';

/** The UI component's changes: a column given is set, null clears an optional one; a list given replaces its list. */
export type ChangeUiComponent = Pick<UiComponentRow, 'id'> & { title?: UiComponentRow['title']; description?: UiComponentRow['description']; file?: UiComponentRow['file'] | null; renders?: string[]; builds?: string[]; meets?: string[]; packages?: string[]; helpers?: string[] };

export const CHANGE_UI_COMPONENT = {
  ...CHANGE_UI_COMPONENT_IDENTITY,
  input: {
    id: column('ui_component', 'id', 'required'),
    title: column('ui_component', 'title', 'optional'),
    description: column('ui_component', 'description', 'optional'),
    file: column('ui_component', 'file', 'clearable'),
    renders: ids('The views it renders, or part of. Replaces the list.', 'optional'),
    builds: ids('The view requirements its code builds. Replaces the list.', 'optional'),
    meets: ids('The standard rules it follows. Replaces the list.', 'optional'),
    packages: texts('The packages it uses. Replaces the list.', 'optional'),
    helpers: texts('The helper files its code is split across beside its file, each from the product root. Replaces the list.', 'optional'),
  },
  handler: changeUiComponent,
} satisfies CommandDefinition<ChangeUiComponent>;
