// Generated from data/ by `npm run generate`. Do not edit.
// The ui-component commands whose handler is the pattern: load the UI component, add, change or remove one record with the
// input's columns and lists, hold it to its rules, and save. Each definition takes its handler from here.
import { changed } from '../../../platform/data/rows.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { UiComponentRepository } from '../repository.ts';
import type { AddUiComponent } from './add-ui-component.ts';
import type { ChangeUiComponent } from './change-ui-component.ts';
import type { RemoveUiComponent } from './remove-ui-component.ts';

/** Adds a UI component: its name in code and its file, with the views it renders, the view requirements it builds, the standard rules it meets and the packages it uses. It has no owner; its product follows from its ID. */
export function addUiComponent(tx: Transaction, input: AddUiComponent): void {
  const uiComponents = new UiComponentRepository(tx);
  const { renders = [], builds = [], meets = [], packages = [], ...row } = input;
  const uiComponent = uiComponents.create({ root: row.id, component: row, renders: renders, builds: builds, meets: meets, packages: packages });
  uiComponents.save(uiComponent);
}

/** Changes a UI component's title, file or description, or the views it renders, the view requirements it builds, the standard rules it meets or the packages it uses (each list whole). */
export function changeUiComponent(tx: Transaction, input: ChangeUiComponent): void {
  const uiComponents = new UiComponentRepository(tx);
  const uiComponent = uiComponents.load(input.id) ?? tx.refuse('missing', `there is no UI component ${input.id}`);
  uiComponent.component = changed(uiComponent.component, input, ['title', 'description', 'file']);
  uiComponent.renders = input.renders ?? uiComponent.renders;
  uiComponent.builds = input.builds ?? uiComponent.builds;
  uiComponent.meets = input.meets ?? uiComponent.meets;
  uiComponent.packages = input.packages ?? uiComponent.packages;
  uiComponents.save(uiComponent);
}

/** Removes a UI component whole: the links it starts and the packages it uses. Refused while anything outside it references what is in it. */
export function removeUiComponent(tx: Transaction, input: RemoveUiComponent): void {
  const uiComponents = new UiComponentRepository(tx);
  const uiComponent = uiComponents.load(input.id) ?? tx.refuse('missing', `there is no UI component ${input.id}`);
  uiComponents.remove(uiComponent);
}
