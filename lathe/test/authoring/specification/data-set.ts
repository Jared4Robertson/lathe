// LA-AUT-TD50 Loan limit specification: the domain model base with the Loan aggregate written as data, then the
// specification TL-LEND-SP02 with its predicate and test written with the Specification aggregate's own Add commands.
import { ADD_PREDICATE } from '../../../src/authoring/specification/commands/add-predicate.ts';
import { ADD_SPECIFICATION } from '../../../src/authoring/specification/commands/add-specification.ts';
import { ADD_SPECIFICATION_TEST } from '../../../src/authoring/specification/commands/add-specification-test.ts';
import { runCommand } from '../../../src/platform/commands/run.ts';
import type { Store } from '../../../src/platform/data/store.ts';
import type { Data } from '../../helpers.ts';
import { domainModelBase, storeOn } from '../domain-model-base.ts';

/** What the commands name outside their aggregate: the aggregates the specification reads, as data files. */
export const AROUND: Data = {
  aggregate: [
    { id: 'TL-LEND-A1', title: 'Loan', domain_id: 'TL-LEND', identity: 'Loan ID', description: 'One tool lent to one member, with its return.' },
    { id: 'TL-LEND-A2', title: 'Member', domain_id: 'TL-LEND', identity: 'Member ID', description: 'Someone who borrows tools.' },
  ],
};

/**
 * A store with TL-LEND-SP02 Member is at the loan limit (reading TL-LEND-A1), its predicate TL-LEND-SP02-PR meeting
 * TL-STD-CODE-R01 and using date-fns, and its test TL-LEND-SP02-T starting from TL-LEND-TD01.
 */
export async function specificationDataSet(): Promise<Store> {
  const store = await storeOn(domainModelBase(AROUND));
  await runCommand(store, ADD_SPECIFICATION, { id: 'TL-LEND-SP02', title: 'Member is at the loan limit', statement: 'A member is at the loan limit when they hold three active loans.', reads: ['TL-LEND-A1'] });
  await runCommand(store, ADD_PREDICATE, { id: 'TL-LEND-SP02-PR', title: 'isAtLoanLimit', specification_id: 'TL-LEND-SP02', file: 'src/lending/limits.ts', meets: ['TL-STD-CODE-R01'], packages: ['date-fns'] });
  await runCommand(store, ADD_SPECIFICATION_TEST, {
    id: 'TL-LEND-SP02-T', title: 'Three active loans reach the limit', specification_id: 'TL-LEND-SP02', level: 'unit', state: 'automated', file: 'test/limits.test.ts',
    when: 'Counts a member with two active loans, then three.', then: 'Expects the limit reached only at three.', starts_from: ['TL-LEND-TD01'],
  });
  return store;
}
