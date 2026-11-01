import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { UiComponentRow } from '../../../platform/data/tables.ts';
import { UiComponentRepository } from '../repository.ts';
import { ADD_UI_COMPONENT_IDENTITY } from './identities.generated.ts';

export type AddUiComponent = Pick<UiComponentRow, 'id' | 'title' | 'description' | 'file'> & { renders?: string[]; builds?: string[]; meets?: string[]; packages?: string[] };

export const ADD_UI_COMPONENT: CommandDefinition<AddUiComponent> = {
  ...ADD_UI_COMPONENT_IDENTITY,
  input: {
    id: column('ui_component', 'id', 'required'),
    title: column('ui_component', 'title', 'required'),
    description: column('ui_component', 'description', 'required'),
    file: column('ui_component', 'file', 'optional'),
    renders: ids('The views it renders, or part of.', 'optional'),
    builds: ids('The view requirements its code builds: does what each says.', 'optional'),
    meets: ids('The standard rules it follows.', 'optional'),
    packages: texts("The packages it uses, each listed in one of the product's package.json files.", 'optional'),
  },
  handler: addUiComponent,
};

/** Adds the UI component, new and whole. */
export function addUiComponent(tx: Transaction, input: AddUiComponent): void {
  const components = new UiComponentRepository(tx);
  const { renders = [], builds = [], meets = [], packages = [], ...row } = input;
  const component = components.create({ root: row.id, component: row, renders, builds, meets, packages });
  components.save(component);
}
