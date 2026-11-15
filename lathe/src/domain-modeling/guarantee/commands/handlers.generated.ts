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

/** Adds a guarantee to a platform domain, with what every other domain can rely on and the building blocks that keep it. */
export function addGuarantee(tx: Transaction, input: AddGuarantee): void {
  const guarantees = new GuaranteeRepository(tx);
  if (tx.record(input.domain_id)?.kind !== 'domain') tx.refuse('missing', `there is no domain ${input.domain_id}`);
  const { kept_by = [], ...row } = input;
  const guarantee = guarantees.create({ root: row.id, guarantee: row, keptBy: kept_by, tests: [] });
  guarantees.save(guarantee);
}

/** Changes a guarantee's title or statement, or the building blocks that keep it (the whole list). Its domain never changes. */
export function changeGuarantee(tx: Transaction, input: ChangeGuarantee): void {
  const guarantees = new GuaranteeRepository(tx);
  const guarantee = guarantees.load(input.id) ?? tx.refuse('missing', `there is no guarantee ${input.id}`);
  guarantee.guarantee = changed(guarantee.guarantee, input, ['title', 'statement']);
  guarantee.keptBy = input.kept_by ?? guarantee.keptBy;
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
