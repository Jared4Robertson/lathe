// LA-AUT-TD33 Open a loan command: the domain model base with the Loan aggregate, its root entity
// and events and a Catalog aggregate with an unpublished event, then Open a loan with its handler, policy, event
// handler and policy test written with the Command aggregate's own Add commands.
import { ADD_COMMAND } from '../../../src/authoring/command/commands/add-command.ts';
import { ADD_COMMAND_HANDLER } from '../../../src/authoring/command/commands/add-command-handler.ts';
import { ADD_EVENT_HANDLER } from '../../../src/authoring/command/commands/add-event-handler.ts';
import { ADD_POLICY } from '../../../src/authoring/command/commands/add-policy.ts';
import { ADD_POLICY_TEST } from '../../../src/authoring/command/commands/add-policy-test.ts';
import { runCommand } from '../../../src/platform/commands/run.ts';
import type { Store } from '../../../src/platform/data/store.ts';
import { domainModelBase, storeOn } from '../domain-model-base.ts';

/** What the commands name outside their aggregate: the aggregates, the entity and the events, as data files. */
const AROUND = {
  aggregate: [
    { id: 'TL-LEND-A1', title: 'Loan', domain_id: 'TL-LEND', identity: 'Loan ID', description: 'One tool lent to one member, with its return.' },
    { id: 'TL-CAT-A1', title: 'Listing', domain_id: 'TL-CAT', identity: 'Listing ID', description: 'How one tool is listed.' },
  ],
  entity: [{ id: 'TL-LEND-EN01', title: 'Loan', aggregate_id: 'TL-LEND-A1', role: 'root', description: 'The loan itself.' }],
  domain_event: [
    { id: 'TL-LEND-EV01', title: 'Loan opened', aggregate_id: 'TL-LEND-A1', published: false, description: 'A tool went out on loan.' },
    { id: 'TL-CAT-EV01', title: 'Listing changed', aggregate_id: 'TL-CAT-A1', published: false, description: 'A listing was changed.' },
  ],
};

/**
 * A store with TL-LEND-CMD01 Open a loan (raising EV01, checking SP01, calling DS01; its handler meeting
 * TL-STD-CODE-R01) and its policy TL-LEND-PO01 hearing EV01, with its event handler and its test starting from
 * TL-LEND-TD01.
 */
export async function commandDataSet(): Promise<Store> {
  const store = await storeOn(domainModelBase(AROUND));
  await runCommand(store, ADD_COMMAND, {
    id: 'TL-LEND-CMD01', title: 'Open a loan', entity_id: 'TL-LEND-EN01', description: 'Lends a free tool to a member.',
    raises: ['TL-LEND-EV01'], checks: ['TL-LEND-SP01'], calls: ['TL-LEND-DS01'],
  });
  await runCommand(store, ADD_COMMAND_HANDLER, { id: 'TL-LEND-CMD01-H', title: 'openLoan', command_id: 'TL-LEND-CMD01', file: 'src/lending/loans.ts', description: 'Saves the loan and its event in one transaction.', meets: ['TL-STD-CODE-R01'] });
  await runCommand(store, ADD_POLICY, { id: 'TL-LEND-PO01', title: 'Remind on loan', command_id: 'TL-LEND-CMD01', statement: 'Whenever a loan is opened, the library MUST open its reminder.', hears: 'TL-LEND-EV01' });
  await runCommand(store, ADD_EVENT_HANDLER, { id: 'TL-LEND-PO01-H', title: 'onLoanOpened', policy_id: 'TL-LEND-PO01', description: 'Hears the event from the outbox relay.' });
  await runCommand(store, ADD_POLICY_TEST, {
    id: 'TL-LEND-PO01-T', title: 'A reminder follows a loan', policy_id: 'TL-LEND-PO01', level: 'unit', state: 'automated', file: 'test/policies.test.ts',
    when: 'Opens a loan.', then: 'Expects a reminder.', starts_from: ['TL-LEND-TD01'],
  });
  return store;
}
