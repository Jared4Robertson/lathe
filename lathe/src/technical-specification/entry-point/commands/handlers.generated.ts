// Generated from data/ by `npm run generate`. Do not edit.
// The entry-point commands whose handler is the pattern: load the entry point, add, change or remove one record with the
// input's columns and lists, hold it to its rules, and save. Each definition takes its handler from here.
import { changed } from '../../../platform/data/rows.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { EntryPointRepository } from '../repository.ts';
import type { ChangeEntryPoint } from './change-entry-point.ts';
import type { RemoveEntryPoint } from './remove-entry-point.ts';

/** Changes an entry point's title, file, description, packages or standard rules met. Its domain stays. */
export function changeEntryPoint(tx: Transaction, input: ChangeEntryPoint): void {
  const entryPoints = new EntryPointRepository(tx);
  const entryPoint = entryPoints.load(input.id) ?? tx.refuse('missing', `there is no entry point ${input.id}`);
  entryPoint.entryPoint = changed(entryPoint.entryPoint, input, ['title', 'file', 'description']);
  entryPoint.meets = input.meets ?? entryPoint.meets;
  entryPoint.packages = input.packages ?? entryPoint.packages;
  entryPoints.save(entryPoint);
}

/** Removes an entry point whole, with the packages it names and the links it starts. Refused while anything references it. */
export function removeEntryPoint(tx: Transaction, input: RemoveEntryPoint): void {
  const entryPoints = new EntryPointRepository(tx);
  const entryPoint = entryPoints.load(input.id) ?? tx.refuse('missing', `there is no entry point ${input.id}`);
  entryPoints.remove(entryPoint);
}
