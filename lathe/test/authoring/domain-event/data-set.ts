// LA-AUT-TD41 Loan opened and closed: the domain model base with the Loan aggregate, then the
// Loan opened and Loan closed events written with the Domain event aggregate's own Add commands.
import { ADD_DOMAIN_EVENT } from '../../../src/authoring/domain-event/commands/add-domain-event.ts';
import { ADD_EVENT_TYPE } from '../../../src/authoring/domain-event/commands/add-event-type.ts';
import { runCommand } from '../../../src/platform/commands/run.ts';
import type { Store } from '../../../src/platform/data/store.ts';
import type { Data } from '../../helpers.ts';
import { domainModelBase, storeOn } from '../domain-model-base.ts';

/** The Loan aggregate the events happen to: of the Aggregate aggregate, so written as data files. */
const LOAN: Data = {
  aggregate: [{ id: 'TL-LEND-A1', title: 'Loan', domain_id: 'TL-LEND', identity: 'Loan ID', description: 'One tool lent to one member, with its return.' }],
};

/**
 * A store with TL-LEND-EV01 Loan opened (published, two fields, its event type delivered by outbox and meeting
 * TL-STD-CODE-R01) and TL-LEND-EV02 Loan closed (not published, no fields, no event type), on the base with the Loan
 * aggregate and any extra rows given.
 */
export async function domainEventDataSet(extra: Data = {}): Promise<Store> {
  const store = await storeOn(domainModelBase({ ...LOAN, ...extra }));
  await runCommand(store, ADD_DOMAIN_EVENT, {
    id: 'TL-LEND-EV01', title: 'Loan opened', aggregate_id: 'TL-LEND-A1', published: true, description: 'A tool went out on loan.',
    fields: [
      { name: 'Loan ID', meaning: 'Which loan.', type_aggregate_id: 'TL-LEND-A1', required: true },
      { name: 'Due', meaning: 'When it is due back.', type: 'date', required: true },
    ],
  });
  await runCommand(store, ADD_EVENT_TYPE, { id: 'TL-LEND-EV01-ET', title: 'LoanOpened', domain_event_id: 'TL-LEND-EV01', delivery: 'outbox', file: 'src/lending/events.ts', meets: ['TL-STD-CODE-R01'] });
  await runCommand(store, ADD_DOMAIN_EVENT, { id: 'TL-LEND-EV02', title: 'Loan closed', aggregate_id: 'TL-LEND-A1', published: false, description: 'A tool came back.' });
  return store;
}
