// Generated from data/ by `npm run generate`. Do not edit.
// The storage-requirement commands whose handler is the pattern: load the storage requirement, add, change or remove one record with the
// input's columns and lists, hold it to its rules, and save. Each definition takes its handler from here.
import { changed } from '../../../platform/data/rows.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { StorageRequirementRepository } from '../repository.ts';
import type { ChangeStorageRequirement } from './change-storage-requirement.ts';
import type { RemoveStorageRequirement } from './remove-storage-requirement.ts';
import type { AddStorageRequirementTest } from './add-storage-requirement-test.ts';
import type { ChangeStorageRequirementTest } from './change-storage-requirement-test.ts';
import type { RemoveStorageRequirementTest } from './remove-storage-requirement-test.ts';

/** Changes a storage requirement's title or statement. The aggregate or read model it is about never changes: remove it and add it again under another. */
export function changeStorageRequirement(tx: Transaction, input: ChangeStorageRequirement): void {
  const storageRequirements = new StorageRequirementRepository(tx);
  const storageRequirement = storageRequirements.load(input.id) ?? tx.refuse('missing', `there is no storage requirement ${input.id}`);
  storageRequirement.requirement = changed(storageRequirement.requirement, input, ['title', 'statement']);
  storageRequirements.save(storageRequirement);
}

/** Removes a storage requirement whole: its storage requirement tests and the links they start. Refused while anything outside it references what is in it. */
export function removeStorageRequirement(tx: Transaction, input: RemoveStorageRequirement): void {
  const storageRequirements = new StorageRequirementRepository(tx);
  const storageRequirement = storageRequirements.load(input.id) ?? tx.refuse('missing', `there is no storage requirement ${input.id}`);
  storageRequirements.remove(storageRequirement);
}

/** Adds a storage requirement test under its storage requirement, with the test data sets it starts from. */
export function addStorageRequirementTest(tx: Transaction, input: AddStorageRequirementTest): void {
  const storageRequirements = new StorageRequirementRepository(tx);
  const storageRequirement = storageRequirements.load(input.storage_requirement_id) ?? tx.refuse('missing', `there is no storage requirement ${input.storage_requirement_id}`);
  const { starts_from = [], ...row } = input;
  storageRequirement.tests.push({ row, startsFrom: starts_from });
  storageRequirements.save(storageRequirement);
}

/** Changes a storage requirement test's way of running or the test data sets it starts from (the whole list). */
export function changeStorageRequirementTest(tx: Transaction, input: ChangeStorageRequirementTest): void {
  const storageRequirements = new StorageRequirementRepository(tx);
  const storageRequirement = storageRequirements.loadHolding('storage_requirement_test', input.id) ?? tx.refuse('missing', `there is no storage requirement test ${input.id}`);
  storageRequirement.tests = storageRequirement.tests.map((x) => (x.row.id === input.id ? { row: changed(x.row, input, ['title', 'level', 'state', 'file', 'manual_reason', 'size', 'smoke', 'external', 'when', 'then', 'notes']), startsFrom: input.starts_from ?? x.startsFrom } : x));
  storageRequirements.save(storageRequirement);
}

/** Removes a storage requirement test with the links it starts. Refused while anything references it, such as a business outcome it measures. */
export function removeStorageRequirementTest(tx: Transaction, input: RemoveStorageRequirementTest): void {
  const storageRequirements = new StorageRequirementRepository(tx);
  const storageRequirement = storageRequirements.loadHolding('storage_requirement_test', input.id) ?? tx.refuse('missing', `there is no storage requirement test ${input.id}`);
  storageRequirement.tests = storageRequirement.tests.filter((x) => x.row.id !== input.id);
  storageRequirements.save(storageRequirement);
}
