// Generated from data/ by `npm run generate`. Do not edit.
// The specification commands whose handler is the pattern: load the specification, add, change or remove one record with the
// input's columns and lists, hold it to its rules, and save. Each definition takes its handler from here.
import { changed } from '../../../platform/data/rows.ts';
import { refuseBroken } from '../../../platform/data/rules.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { SpecificationRepository } from '../repository.ts';
import { onePredicate, oneSpecificationTest } from '../rules.ts';
import type { AddSpecification } from './add-specification.ts';
import type { ChangeSpecification } from './change-specification.ts';
import type { RemoveSpecification } from './remove-specification.ts';
import type { AddPredicate } from './add-predicate.ts';
import type { ChangePredicate } from './change-predicate.ts';
import type { RemovePredicate } from './remove-predicate.ts';
import type { AddSpecificationTest } from './add-specification-test.ts';
import type { ChangeSpecificationTest } from './change-specification-test.ts';
import type { RemoveSpecificationTest } from './remove-specification-test.ts';

/** Adds a specification, in the domain its ID names, with the aggregates it reads. */
export function addSpecification(tx: Transaction, input: AddSpecification): void {
  const specifications = new SpecificationRepository(tx);
  const { reads = [], ...row } = input;
  const specification = specifications.create({ root: row.id, specification: row, reads: reads, predicate: null, test: null });
  specifications.save(specification);
}

/** Changes a specification's title or statement, or the aggregates it reads (the whole list). */
export function changeSpecification(tx: Transaction, input: ChangeSpecification): void {
  const specifications = new SpecificationRepository(tx);
  const specification = specifications.load(input.id) ?? tx.refuse('missing', `there is no specification ${input.id}`);
  specification.specification = changed(specification.specification, input, ['title', 'statement']);
  specification.reads = input.reads ?? specification.reads;
  specifications.save(specification);
}

/** Removes a specification whole: its predicate and test, and the links they start. Refused while anything outside it references what is in it, such as a command that checks it. */
export function removeSpecification(tx: Transaction, input: RemoveSpecification): void {
  const specifications = new SpecificationRepository(tx);
  const specification = specifications.load(input.id) ?? tx.refuse('missing', `there is no specification ${input.id}`);
  specifications.remove(specification);
}

/** Adds the predicate of a specification, its one piece of code, with the standard rules it meets and the packages it uses. */
export function addPredicate(tx: Transaction, input: AddPredicate): void {
  const specifications = new SpecificationRepository(tx);
  const specification = specifications.load(input.specification_id) ?? tx.refuse('missing', `there is no specification ${input.specification_id}`);
  const { meets = [], packages = [], ...row } = input;
  refuseBroken(onePredicate([...(specification.predicate ? [specification.predicate.row] : []), row]));
  specification.predicate = { row, meets: meets, packages: packages };
  specifications.save(specification);
}

/** Changes a predicate's title or file, or the standard rules it meets or packages it uses (each the whole list). */
export function changePredicate(tx: Transaction, input: ChangePredicate): void {
  const specifications = new SpecificationRepository(tx);
  const specification = specifications.loadHolding('predicate', input.id) ?? tx.refuse('missing', `there is no predicate ${input.id}`);
  const held = specification.predicate!;
  specification.predicate = { row: changed(held.row, input, ['title', 'file']), meets: input.meets ?? held.meets, packages: input.packages ?? held.packages };
  specifications.save(specification);
}

/** Removes a specification's predicate with the links it starts and the packages it uses. Refused while anything references it. */
export function removePredicate(tx: Transaction, input: RemovePredicate): void {
  const specifications = new SpecificationRepository(tx);
  const specification = specifications.loadHolding('predicate', input.id) ?? tx.refuse('missing', `there is no predicate ${input.id}`);
  specification.predicate = null;
  specifications.save(specification);
}

/** Adds the test of a specification, its one test, with the test data sets it starts from. */
export function addSpecificationTest(tx: Transaction, input: AddSpecificationTest): void {
  const specifications = new SpecificationRepository(tx);
  const specification = specifications.load(input.specification_id) ?? tx.refuse('missing', `there is no specification ${input.specification_id}`);
  const { starts_from = [], ...row } = input;
  refuseBroken(oneSpecificationTest([...(specification.test ? [specification.test.row] : []), row]));
  specification.test = { row, startsFrom: starts_from };
  specifications.save(specification);
}

/** Changes a specification test's way of running or the test data sets it starts from (the whole list). */
export function changeSpecificationTest(tx: Transaction, input: ChangeSpecificationTest): void {
  const specifications = new SpecificationRepository(tx);
  const specification = specifications.loadHolding('specification_test', input.id) ?? tx.refuse('missing', `there is no specification test ${input.id}`);
  const held = specification.test!;
  specification.test = { row: changed(held.row, input, ['title', 'level', 'state', 'file', 'manual_reason', 'size', 'smoke', 'external', 'when', 'then', 'notes']), startsFrom: input.starts_from ?? held.startsFrom };
  specifications.save(specification);
}

/** Removes a specification's test with the links it starts. Refused while anything references it, such as a business outcome it measures. */
export function removeSpecificationTest(tx: Transaction, input: RemoveSpecificationTest): void {
  const specifications = new SpecificationRepository(tx);
  const specification = specifications.loadHolding('specification_test', input.id) ?? tx.refuse('missing', `there is no specification test ${input.id}`);
  specification.test = null;
  specifications.save(specification);
}
