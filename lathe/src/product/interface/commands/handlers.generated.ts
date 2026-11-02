// Generated from data/ by `npm run generate`. Do not edit.
// The interface commands whose handler is the pattern: load the interface, add, change or remove one record with the
// input's columns and lists, hold it to its rules, and save. Each definition takes its handler from here.
import { changed } from '../../../platform/data/rows.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { InterfaceRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import type { AddInterface } from './add-interface.ts';
import type { ChangeInterface } from './change-interface.ts';
import type { RemoveInterface } from './remove-interface.ts';

/** Adds an interface of a product: a way it is used, such as an app a person works in, calls other programs make, or a command line, with the roles that use it and the use cases it offers. */
export function addInterface(tx: Transaction, input: AddInterface): void {
  const interfaces = new InterfaceRepository(tx);
  if (tx.record(input.product_id)?.kind !== 'product') tx.refuse('missing', `there is no product ${input.product_id}`);
  const { actors = [], offers = [], ...row } = input;
  const theInterface = interfaces.create({ root: row.id, row: row, actors: actors, offers: offers });
  holdToRules(tx, theInterface);
  interfaces.save(theInterface);
}

/** Changes an interface's title, kind, description, whether it is public, the roles that use it or the use cases it offers (each list replaced whole). */
export function changeInterface(tx: Transaction, input: ChangeInterface): void {
  const interfaces = new InterfaceRepository(tx);
  const theInterface = interfaces.load(input.id) ?? tx.refuse('missing', `there is no interface ${input.id}`);
  theInterface.row = changed(theInterface.row, input, ['title', 'kind', 'description', 'public']);
  theInterface.actors = input.actors ?? theInterface.actors;
  theInterface.offers = input.offers ?? theInterface.offers;
  holdToRules(tx, theInterface);
  interfaces.save(theInterface);
}

/** Removes an interface with its roles and the use cases it offers. Refused while a variant step or a view names it, or anything else references it. */
export function removeInterface(tx: Transaction, input: RemoveInterface): void {
  const interfaces = new InterfaceRepository(tx);
  const theInterface = interfaces.load(input.id) ?? tx.refuse('missing', `there is no interface ${input.id}`);
  interfaces.remove(theInterface);
}
