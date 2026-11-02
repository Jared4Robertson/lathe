// Generated from data/ by `npm run generate`. Do not edit.
// The tooling commands whose handler is the pattern: load the tooling, add, change or remove one record with the
// input's columns and lists, hold it to its rules, and save. Each definition takes its handler from here.
import { changed } from '../../../platform/data/rows.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { ToolingRepository } from '../repository.ts';
import type { ChangeTooling } from './change-tooling.ts';
import type { RemoveTooling } from './remove-tooling.ts';

/** Changes a tooling record's title, file, packages, standard rules met or technical records generated. Its domain stays. */
export function changeTooling(tx: Transaction, input: ChangeTooling): void {
  const toolings = new ToolingRepository(tx);
  const tooling = toolings.load(input.id) ?? tx.refuse('missing', `there is no tooling ${input.id}`);
  tooling.tooling = changed(tooling.tooling, input, ['title', 'file']);
  tooling.packages = input.packages ?? tooling.packages;
  tooling.meets = input.meets ?? tooling.meets;
  tooling.generates = input.generates ?? tooling.generates;
  toolings.save(tooling);
}

/** Removes a tooling record whole, with the packages it names and the links it starts. Refused while anything references it. */
export function removeTooling(tx: Transaction, input: RemoveTooling): void {
  const toolings = new ToolingRepository(tx);
  const tooling = toolings.load(input.id) ?? tx.refuse('missing', `there is no tooling ${input.id}`);
  toolings.remove(tooling);
}
