// Generated from data/ by `npm run generate`. Do not edit.
// The guarantee commands whose handler is the pattern: load the guarantee, add, change or remove one record with the
// input's columns and lists, hold it to its rules, and save. Each definition takes its handler from here.
import { changed } from '../../../platform/data/rows.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { GuaranteeRepository } from '../repository.ts';
import type { AddGuarantee } from './add-guarantee.ts';
import type { ChangeGuarantee } from './change-guarantee.ts';
import type { RemoveGuarantee } from './remove-guarantee.ts';
import type { AddGuaranteeTest } from './add-guarantee-test.ts';
import type { ChangeGuaranteeTest } from './change-guarantee-test.ts';
import type { RemoveGuaranteeTest } from './remove-guarantee-test.ts';

/** Adds a guarantee to its maker (a platform domain, a generated component or a library), with what those who rely on it can rely on, whom it is for when its maker ships it outside the repo, the building blocks that keep it and the standard rules it follows. */
export function addGuarantee(tx: Transaction, input: AddGuarantee): void {
  const guarantees = new GuaranteeRepository(tx);
  const { kept_by = [], meets = [], ...row } = input;
  const guarantee = guarantees.create({ root: row.id, guarantee: row, keptBy: kept_by, meets: meets, tests: [] });
  guarantees.save(guarantee);
}

/** Changes a guarantee's title, statement, consumers or group, or the building blocks that keep it or the standard rules it follows (each list whole). Its maker never changes. */
export function changeGuarantee(tx: Transaction, input: ChangeGuarantee): void {
  const guarantees = new GuaranteeRepository(tx);
  const guarantee = guarantees.load(input.id) ?? tx.refuse('missing', `there is no guarantee ${input.id}`);
  guarantee.guarantee = changed(guarantee.guarantee, input, ['title', 'statement', 'consumers', 'group_name']);
  guarantee.keptBy = input.kept_by ?? guarantee.keptBy;
  guarantee.meets = input.meets ?? guarantee.meets;
  guarantees.save(guarantee);
}

/** Removes a guarantee with its guarantee tests and the links they start. Refused while anything references it or them. */
export function removeGuarantee(tx: Transaction, input: RemoveGuarantee): void {
  const guarantees = new GuaranteeRepository(tx);
  const guarantee = guarantees.load(input.id) ?? tx.refuse('missing', `there is no guarantee ${input.id}`);
  guarantees.remove(guarantee);
}

/** Adds a guarantee test under its guarantee, with the test data sets it starts from. */
export function addGuaranteeTest(tx: Transaction, input: AddGuaranteeTest): void {
  const guarantees = new GuaranteeRepository(tx);
  const guarantee = guarantees.load(input.guarantee_id) ?? tx.refuse('missing', `there is no guarantee ${input.guarantee_id}`);
  const { starts_from = [], ...row } = input;
  guarantee.tests.push({ row, startsFrom: starts_from });
  guarantees.save(guarantee);
}

/** Changes a guarantee test's way of running or the test data sets it starts from (the whole list). */
export function changeGuaranteeTest(tx: Transaction, input: ChangeGuaranteeTest): void {
  const guarantees = new GuaranteeRepository(tx);
  const guarantee = guarantees.loadHolding('guarantee_test', input.id) ?? tx.refuse('missing', `there is no guarantee test ${input.id}`);
  guarantee.tests = guarantee.tests.map((x) => (x.row.id === input.id ? { row: changed(x.row, input, ['title', 'level', 'state', 'file', 'manual_reason', 'size', 'smoke', 'external', 'when', 'then', 'notes']), startsFrom: input.starts_from ?? x.startsFrom } : x));
  guarantees.save(guarantee);
}

/** Removes a guarantee test and the links it starts. Refused while anything references it. */
export function removeGuaranteeTest(tx: Transaction, input: RemoveGuaranteeTest): void {
  const guarantees = new GuaranteeRepository(tx);
  const guarantee = guarantees.loadHolding('guarantee_test', input.id) ?? tx.refuse('missing', `there is no guarantee test ${input.id}`);
  guarantee.tests = guarantee.tests.filter((x) => x.row.id !== input.id);
  guarantees.save(guarantee);
}
