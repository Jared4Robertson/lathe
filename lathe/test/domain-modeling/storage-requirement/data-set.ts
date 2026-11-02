// LA-MOD-TD130 Loan storage requirements: the domain model base with the Loan aggregate, its repository stored in the
// library's database and the Overdue loans read model written as data, then the storage requirements TL-LEND-A1-SR01
// (with two storage requirement tests) and TL-LEND-RM01-SR01 written with the Storage requirement aggregate's own Add commands.
import { ADD_STORAGE_REQUIREMENT } from '../../../src/domain-modeling/storage-requirement/commands/add-storage-requirement.ts';
import { ADD_STORAGE_REQUIREMENT_TEST } from '../../../src/domain-modeling/storage-requirement/commands/add-storage-requirement-test.ts';
import { runCommand } from '../../../src/platform/commands/run.ts';
import type { Store } from '../../../src/platform/data/store.ts';
import type { Data } from '../../helpers.ts';
import { domainModelBase, storeOn } from '../domain-model-base.ts';

/** What the commands name outside their aggregate, as data files: the aggregate and read model, and what builds them. */
export const AROUND: Data = {
  aggregate: [{ id: 'TL-LEND-A1', title: 'Loan', domain_id: 'TL-LEND', identity: 'Loan ID', description: 'One tool lent to one member, with its return.' }],
  read_model: [{ id: 'TL-LEND-RM01', title: 'Overdue loans', domain_id: 'TL-LEND', description: 'The loans past their due date.' }],
  data_store: [{ id: 'TL-STORE01', title: 'DATABASE_URL', product_id: 'TL', kind: 'database', description: 'The library\'s PostgreSQL database.' }],
  repository: [{ id: 'TL-LEND-REPO01', title: 'LoanRepository', domain_id: 'TL-LEND', file: 'src/lending/loans.ts', description: 'Saves a loan with its outbox event in one transaction.' }],
  persists: [{ source_id: 'TL-LEND-REPO01', target_id: 'TL-LEND-A1' }],
  stored_in: [{ source_id: 'TL-LEND-REPO01', target_id: 'TL-STORE01' }],
};

/**
 * A store with TL-LEND-A1-SR01 A loan is saved with its outbox event (under TL-LEND-A1), its storage requirement tests T01 (starting
 * from TL-LEND-TD01) and T02, and TL-LEND-RM01-SR01 Overdue loans are rebuilt on start (under TL-LEND-RM01).
 */
export async function storageRequirementDataSet(): Promise<Store> {
  const store = await storeOn(domainModelBase(AROUND));
  await runCommand(store, ADD_STORAGE_REQUIREMENT, {
    id: 'TL-LEND-A1-SR01', title: 'A loan is saved with its outbox event', aggregate_id: 'TL-LEND-A1',
    statement: 'A loan MUST be saved with its outbox event in one transaction, or neither saved, and MUST survive a restart.',
  });
  await runCommand(store, ADD_STORAGE_REQUIREMENT_TEST, {
    id: 'TL-LEND-A1-SR01-T01', title: 'A loan and its event survive a restart', storage_requirement_id: 'TL-LEND-A1-SR01', level: 'integration', state: 'automated', file: 'test/loans.test.ts',
    when: 'Opens a loan, then restarts the database.', then: 'Expects the loan and its outbox event both read back.', starts_from: ['TL-LEND-TD01'],
  });
  await runCommand(store, ADD_STORAGE_REQUIREMENT_TEST, {
    id: 'TL-LEND-A1-SR01-T02', title: 'A failed save leaves nothing behind', storage_requirement_id: 'TL-LEND-A1-SR01', level: 'integration', state: 'not automated yet',
    when: 'Opens a loan whose event cannot be written.', then: 'Expects neither the loan nor the event saved.',
  });
  await runCommand(store, ADD_STORAGE_REQUIREMENT, {
    id: 'TL-LEND-RM01-SR01', title: 'Overdue loans are rebuilt on start', read_model_id: 'TL-LEND-RM01',
    statement: 'The overdue loans MAY be lost on a restart, and MUST be rebuilt from the loans before the first query.',
  });
  return store;
}
