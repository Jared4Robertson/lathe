// LA-TEC-TD53 Loans table: the domain model base with the Loan aggregate (its root entity and a child stored in the
// root's table), an invariant and the Listing aggregate's entity written as data, then the loans table with its keys,
// the listings table and the lending domain's outbox, written with the Table aggregate's own Add commands.
import { ADD_TABLE } from '../../../src/technical-specification/table/commands/add-table.ts';
import { runCommand } from '../../../src/platform/commands/run.ts';
import type { Store } from '../../../src/platform/data/store.ts';
import type { Data } from '../../helpers.ts';
import { domainModelBase, storeOn } from '../../domain-modeling/domain-model-base.ts';

/** What the commands name outside their aggregate: the aggregates, their entities and an invariant, as data files. */
export const AROUND: Data = {
  aggregate: [
    { id: 'TL-LEND-A1', title: 'Loan', domain_id: 'TL-LEND', identity: 'Loan ID', description: 'One tool lent to one member, with its return.' },
    { id: 'TL-CAT-A1', title: 'Listing', domain_id: 'TL-CAT', identity: 'Listing ID', description: 'How one tool is listed.' },
  ],
  entity: [
    { id: 'TL-LEND-EN01', title: 'Loan', aggregate_id: 'TL-LEND-A1', role: 'root', description: 'The loan itself.' },
    { id: 'TL-LEND-EN02', title: 'Return', aggregate_id: 'TL-LEND-A1', role: 'child', in_root_table: true, description: 'The tool coming back.' },
    { id: 'TL-CAT-EN01', title: 'Listing', aggregate_id: 'TL-CAT-A1', role: 'root', description: 'The listing itself.' },
  ],
  invariant: [{ id: 'TL-LEND-INV01', title: 'One active loan per tool', aggregate_id: 'TL-LEND-A1', statement: 'A tool MUST NOT be on two active loans.' }],
};

/**
 * A store with TL-LEND-EN01-TB loans (a primary key and a partial unique key enforcing TL-LEND-INV01; meeting
 * TL-STD-CODE-R01), TL-CAT-EN01-TB listings (a primary key) and TL-LEND-TB01 outbox (a primary key and a foreign key to
 * the loans table).
 */
export async function tableDataSet(): Promise<Store> {
  const store = await storeOn(domainModelBase(AROUND));
  await runCommand(store, ADD_TABLE, {
    id: 'TL-LEND-EN01-TB', title: 'loans', entity_id: 'TL-LEND-EN01', name: 'loans', storage: 'table', file: 'src/database.ts', meets: ['TL-STD-CODE-R01'],
    keys: [
      { type: 'primary', columns: ['id'] },
      { type: 'unique', columns: ['tool_id'], name: 'loans_one_active_per_tool', invariant_id: 'TL-LEND-INV01', condition: 'returned_at IS NULL' },
    ],
  });
  await runCommand(store, ADD_TABLE, { id: 'TL-CAT-EN01-TB', title: 'listings', entity_id: 'TL-CAT-EN01', name: 'listings', storage: 'table', keys: [{ type: 'primary', columns: ['id'] }] });
  await runCommand(store, ADD_TABLE, {
    id: 'TL-LEND-TB01', title: 'outbox', domain_id: 'TL-LEND', name: 'outbox', storage: 'table',
    keys: [{ type: 'primary', columns: ['id'] }, { type: 'foreign', columns: ['loan_id'], target_table_id: 'TL-LEND-EN01-TB' }],
  });
  return store;
}
