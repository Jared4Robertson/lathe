// Generated from data/ by `npm run generate`. Do not edit.
// The tooling commands whose handler is the pattern: load the tooling, add, change or remove one record with the
// input's columns and lists, hold it to its rules, and save. Each definition takes its handler from here.
import { changed } from '../../../platform/data/rows.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { ToolingRepository } from '../repository.ts';
import type { AddTooling } from './add-tooling.ts';
import type { ChangeTooling } from './change-tooling.ts';
import type { RemoveTooling } from './remove-tooling.ts';

/** Adds a tooling record under its domain, with the packages it uses, its helper files, the standard rules it meets and the technical records it generates. */
export function addTooling(tx: Transaction, input: AddTooling): void {
  const toolings = new ToolingRepository(tx);
  if (tx.record(input.domain_id)?.kind !== 'domain') tx.refuse('missing', `there is no domain ${input.domain_id}`);
  const { packages = [], helpers = [], meets = [], generates = [], ...row } = input;
  const tooling = toolings.create({ root: row.id, tooling: row, packages: packages, helpers: helpers, meets: meets, generates: generates });
  toolings.save(tooling);
}

/** Changes a tooling record's title, file, packages, helper files, standard rules met or technical records generated. Its domain stays. */
export function changeTooling(tx: Transaction, input: ChangeTooling): void {
  const toolings = new ToolingRepository(tx);
  const tooling = toolings.load(input.id) ?? tx.refuse('missing', `there is no tooling ${input.id}`);
  tooling.tooling = changed(tooling.tooling, input, ['title', 'file']);
  tooling.packages = input.packages ?? tooling.packages;
  tooling.helpers = input.helpers ?? tooling.helpers;
  tooling.meets = input.meets ?? tooling.meets;
  tooling.generates = input.generates ?? tooling.generates;
  toolings.save(tooling);
}

/** Removes a tooling record whole, with the packages and helper files it names and the links it starts. Refused while anything references it. */
export function removeTooling(tx: Transaction, input: RemoveTooling): void {
  const toolings = new ToolingRepository(tx);
  const tooling = toolings.load(input.id) ?? tx.refuse('missing', `there is no tooling ${input.id}`);
  toolings.remove(tooling);
}
