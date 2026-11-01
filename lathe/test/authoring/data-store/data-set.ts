// LA-AUT-TD131 Library database: the domain model base with the database host integration, the Loan aggregate's
// repository and table written as data, then the data stores TL-STORE01 (the library's database, provided by the host)
// and TL-LEND-STORE01 (the browser's local storage) written with the Data store aggregate's own Add command, the
// host named TL-STORE01's provider with the Provision aggregate's command, and the
// repository and table naming TL-STORE01 through their own aggregates' commands.
import { ADD_DATA_STORE } from '../../../src/authoring/data-store/commands/add-data-store.ts';
import { CHANGE_REPOSITORY } from '../../../src/authoring/domain/commands/change-repository.ts';
import { CHANGE_TABLE } from '../../../src/authoring/table/commands/change-table.ts';
import { NAME_PROVIDER } from '../../../src/traceability/provision/commands/name-provider.ts';
import { runCommand } from '../../../src/platform/commands/run.ts';
import type { Store } from '../../../src/platform/data/store.ts';
import type { Data } from '../../helpers.ts';
import { domainModelBase, storeOn } from '../domain-model-base.ts';

/** What the commands name outside their aggregate, as data files: the integration, and what is stored. */
export const AROUND: Data = {
  integration: [{ id: 'TL-INT01', title: 'Database host', system: 'Managed PostgreSQL', description: 'The service that runs the library\'s database.' }],
  aggregate: [{ id: 'TL-LEND-A1', title: 'Loan', domain_id: 'TL-LEND', identity: 'Loan ID', description: 'One tool lent to one member, with its return.' }],
  entity: [{ id: 'TL-LEND-EN01', title: 'Loan', aggregate_id: 'TL-LEND-A1', role: 'root', description: 'One loan.' }],
  repository: [{ id: 'TL-LEND-REPO01', title: 'LoanRepository', domain_id: 'TL-LEND', file: 'src/lending/loans.ts', description: 'Saves a loan with its outbox event in one transaction.' }],
  persists: [{ source_id: 'TL-LEND-REPO01', target_id: 'TL-LEND-A1' }],
  table: [{ id: 'TL-LEND-EN01-TB', title: 'Loans', entity_id: 'TL-LEND-EN01', name: 'loans', storage: 'table', file: 'src/schema.sql' }],
};

/** A store with TL-STORE01 DATABASE_URL (provided by TL-INT01), storing the Loan repository and table, and TL-LEND-STORE01 localStorage, storing nothing. */
export async function dataStoreDataSet(): Promise<Store> {
  const store = await storeOn(domainModelBase(AROUND));
  await runCommand(store, ADD_DATA_STORE, {
    id: 'TL-STORE01', title: 'DATABASE_URL', product_id: 'TL', kind: 'database',
    description: "The library's PostgreSQL database, run by the database host and reached at DATABASE_URL.",
  });
  await runCommand(store, NAME_PROVIDER, { record_id: 'TL-STORE01', provider_id: 'TL-INT01' });
  await runCommand(store, ADD_DATA_STORE, { id: 'TL-LEND-STORE01', title: 'localStorage', domain_id: 'TL-LEND', kind: 'browser storage', description: "The member's browser's local storage." });
  await runCommand(store, CHANGE_REPOSITORY, { id: 'TL-LEND-REPO01', stored_in: 'TL-STORE01' });
  await runCommand(store, CHANGE_TABLE, { id: 'TL-LEND-EN01-TB', stored_in: 'TL-STORE01' });
  return store;
}
