// Generated from data/ by `npm run generate`. Do not edit.
// The library commands whose handler is the pattern: load the library, add, change or remove one record with the
// input's columns and lists, hold it to its rules, and save. Each definition takes its handler from here.
import { changed } from '../../../platform/data/rows.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { LibraryRepository } from '../repository.ts';
import type { AddLibrary } from './add-library.ts';
import type { ChangeLibrary } from './change-library.ts';
import type { RemoveLibrary } from './remove-library.ts';

/** Adds a library to a business domain: what the product holds for code outside the repo, with the business outcomes it serves. */
export function addLibrary(tx: Transaction, input: AddLibrary): void {
  const libraries = new LibraryRepository(tx);
  if (tx.record(input.domain_id)?.kind !== 'domain') tx.refuse('missing', `there is no domain ${input.domain_id}`);
  const { serves = [], ...row } = input;
  const library = libraries.create({ root: row.id, library: row, serves: serves });
  libraries.save(library);
}

/** Changes a library's title or description, or the business outcomes it serves (the whole list). Its domain never changes. */
export function changeLibrary(tx: Transaction, input: ChangeLibrary): void {
  const libraries = new LibraryRepository(tx);
  const library = libraries.load(input.id) ?? tx.refuse('missing', `there is no library ${input.id}`);
  library.library = changed(library.library, input, ['title', 'description']);
  library.serves = input.serves ?? library.serves;
  libraries.save(library);
}

/** Removes a library and the links it starts. Refused while anything references it, such as a guarantee it makes or a pattern whose fixed part it makes. */
export function removeLibrary(tx: Transaction, input: RemoveLibrary): void {
  const libraries = new LibraryRepository(tx);
  const library = libraries.load(input.id) ?? tx.refuse('missing', `there is no library ${input.id}`);
  libraries.remove(library);
}
