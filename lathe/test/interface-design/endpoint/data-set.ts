// LA-IXD-TD61 Lend-a-tool endpoint: the domain model base with a command and a query of TL-LEND, then the endpoint of
// the command, with a requirement, its test and its handler, written with the Endpoint aggregate's own Add commands.
import { ADD_API_REQUIREMENT } from '../../../src/interface-design/endpoint/commands/add-api-requirement.ts';
import { ADD_ENDPOINT } from '../../../src/interface-design/endpoint/commands/add-endpoint.ts';
import { ADD_ENDPOINT_HANDLER } from '../../../src/interface-design/endpoint/commands/add-endpoint-handler.ts';
import { ADD_ENDPOINT_TEST } from '../../../src/interface-design/endpoint/commands/add-endpoint-test.ts';
import { runCommand } from '../../../src/platform/commands/run.ts';
import type { Store } from '../../../src/platform/data/store.ts';
import type { Data } from '../../helpers.ts';
import { domainModelBase, storeOn } from '../../domain-modeling/domain-model-base.ts';

/** The command and query the endpoints expose: of the Command and Read model aggregates, so written as data files. */
const OPERATIONS: Data = {
  aggregate: [{ id: 'TL-LEND-A1', title: 'Loan', domain_id: 'TL-LEND', identity: 'Loan ID', description: 'One tool lent to one member.' }],
  entity: [{ id: 'TL-LEND-EN01', title: 'Loan', aggregate_id: 'TL-LEND-A1', role: 'root', description: 'The loan itself.' }],
  command: [{ id: 'TL-LEND-CMD01', title: 'Lend a tool', entity_id: 'TL-LEND-EN01', description: 'Lends a free tool to a member.' }],
  read_model: [{ id: 'TL-LEND-RM01', title: 'Loans', domain_id: 'TL-LEND', description: 'The loans of a member.' }],
  query: [{ id: 'TL-LEND-QRY01', title: 'List a member\'s loans', read_model_id: 'TL-LEND-RM01', description: 'The loans a member has.' }],
};

/**
 * A store with TL-LEND-EP01 POST /loans exposing TL-LEND-CMD01, with requirement R01 and its test (starting from
 * TL-LEND-TD01) and handler EP01-H meeting TL-STD-CODE-R01, on the base with any extra rows given.
 */
export async function endpointDataSet(extra: Data = {}): Promise<Store> {
  const store = await storeOn(domainModelBase({ ...OPERATIONS, ...extra }));
  const run = (definition: Parameters<typeof runCommand>[1], input: unknown) => runCommand(store, definition, input);
  await run(ADD_ENDPOINT, { id: 'TL-LEND-EP01', title: 'POST /loans', command_id: 'TL-LEND-CMD01', method: 'POST', route: '/loans', description: 'Request: { toolId, memberId }. Responds 201 with the loan.' });
  await run(ADD_API_REQUIREMENT, { id: 'TL-LEND-EP01-R01', title: 'A tool on loan answers 409', endpoint_id: 'TL-LEND-EP01', statement: 'Lending a tool on loan MUST answer 409 tool_on_loan.' });
  await run(ADD_ENDPOINT_TEST, {
    id: 'TL-LEND-EP01-R01-T01', title: 'A tool on loan answers 409', api_requirement_id: 'TL-LEND-EP01-R01', level: 'service', state: 'automated', file: 'test/api.test.ts',
    when: 'POST /loans for a tool on loan.', then: '409 tool_on_loan, and nothing changes.', starts_from: ['TL-LEND-TD01'],
  });
  await run(ADD_ENDPOINT_HANDLER, { id: 'TL-LEND-EP01-H', title: 'postLoan', endpoint_id: 'TL-LEND-EP01', file: 'src/api.ts', description: 'Reads the request and runs Lend a tool.', meets: ['TL-STD-CODE-R01'] });
  return store;
}
