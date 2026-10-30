// LA-AUT-TD52 Catalog read model: the domain model base with the Loan and Listing aggregates and an event of each
// written as data, then the read model TL-LEND-RM01 with a query, its handler, its projection and its reader, written
// with the Read model aggregate's own Add commands.
import { ADD_PROJECTION } from '../../../src/authoring/read-model/commands/add-projection.ts';
import { ADD_QUERY } from '../../../src/authoring/read-model/commands/add-query.ts';
import { ADD_QUERY_HANDLER } from '../../../src/authoring/read-model/commands/add-query-handler.ts';
import { ADD_READ_MODEL } from '../../../src/authoring/read-model/commands/add-read-model.ts';
import { ADD_READER } from '../../../src/authoring/read-model/commands/add-reader.ts';
import { runCommand } from '../../../src/platform/commands/run.ts';
import type { Store } from '../../../src/platform/data/store.ts';
import type { Data } from '../../helpers.ts';
import { domainModelBase, storeOn } from '../domain-model-base.ts';

/** What the commands name outside their aggregate: the aggregates and their events, as data files. */
export const AROUND: Data = {
  aggregate: [
    { id: 'TL-LEND-A1', title: 'Loan', domain_id: 'TL-LEND', identity: 'Loan ID', description: 'One tool lent to one member, with its return.' },
    { id: 'TL-CAT-A1', title: 'Listing', domain_id: 'TL-CAT', identity: 'Listing ID', description: 'How one tool is listed.' },
  ],
  domain_event: [
    { id: 'TL-LEND-EV01', title: 'Loan opened', aggregate_id: 'TL-LEND-A1', published: false, description: 'A tool went out on loan.' },
    { id: 'TL-CAT-EV01', title: 'Listing changed', aggregate_id: 'TL-CAT-A1', published: false, description: 'A listing was changed.' },
  ],
};

/**
 * A store with TL-LEND-RM01 Catalog (one field; reading TL-LEND-A1, calling TL-LEND-DS01, fed by TL-LEND-EV01), its
 * query TL-LEND-QRY01 selecting by TL-LEND-SP01 with its handler meeting TL-STD-CODE-R01, its projection and its reader.
 */
export async function readModelDataSet(): Promise<Store> {
  const store = await storeOn(domainModelBase(AROUND));
  await runCommand(store, ADD_READ_MODEL, {
    id: 'TL-LEND-RM01', title: 'Catalog', domain_id: 'TL-LEND', description: 'Every tool with its status, as a borrower sees it.',
    fields: [{ name: 'Status', meaning: 'on_loan while the tool has an active loan, else available.', type: 'text', required: true }],
    reads: ['TL-LEND-A1'], calls: ['TL-LEND-DS01'], fed_by: ['TL-LEND-EV01'],
  });
  await runCommand(store, ADD_QUERY, { id: 'TL-LEND-QRY01', title: 'List the catalog', read_model_id: 'TL-LEND-RM01', description: 'Every tool, in ID order, with its status.', selects_by: ['TL-LEND-SP01'] });
  await runCommand(store, ADD_QUERY_HANDLER, { id: 'TL-LEND-QRY01-H', title: 'listCatalog', query_id: 'TL-LEND-QRY01', file: 'src/catalog.ts', description: 'Reads the catalog view.', meets: ['TL-STD-CODE-R01'] });
  await runCommand(store, ADD_PROJECTION, { id: 'TL-LEND-RM01-PJ', title: 'catalog', read_model_id: 'TL-LEND-RM01', file: 'src/catalog.ts', description: 'A view over the tools and their active loans.' });
  await runCommand(store, ADD_READER, { id: 'TL-LEND-RM01-RD', title: 'CatalogReader', read_model_id: 'TL-LEND-RM01', file: 'src/catalog.ts', description: 'Reads the catalog view for the query handlers.' });
  return store;
}
