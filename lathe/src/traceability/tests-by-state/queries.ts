// The Tests by state read (LA-TRC-RM03): a product's tests counted by state, scope by scope, answered from the read
// model through its reader (reader.ts). The counts are the checks' run's, so the query says it reads the run
// (`checked`): the server gives it the run it keeps for the data, the CLI and the MCP tool run the checks first. Its
// handler never sees the data and changes nothing. This slice holds only the read, so it names its read model where an
// aggregate's slice names its aggregate.
import { id, type QueryDefinition } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { ScopeTestCounts } from './read-model.ts';
import { testsByStateReader, type TestsByStateReader } from './reader.ts';
import { GET_TEST_COUNTS_IDENTITY } from './queries.generated.ts';

/** A product's tests by state: its own scope, then each domain's. */
export interface ProductTestCounts {
  product: string;
  scopes: ScopeTestCounts[];
}

/** The product's tests by state, scope by scope. */
export function getTestCounts(reader: TestsByStateReader, input: { product_id: string }): ProductTestCounts {
  const scopes = reader.countsOf(input.product_id);
  if (!scopes) throw new StoreError([{ rule: 'missing', message: `there is no product ${input.product_id}` }]);
  return { product: input.product_id, scopes };
}

/** Get test counts by state (LA-TRC-QRY03). */
export const GET_TEST_COUNTS: QueryDefinition<{ product_id: string }, ProductTestCounts, TestsByStateReader> = {
  ...GET_TEST_COUNTS_IDENTITY,
  input: { product_id: id('The product.', 'required') },
  checked: true,
  reader: testsByStateReader,
  run: getTestCounts,
  text: (p) =>
    [p.product, ...p.scopes.map((s) => `  ${s.domain ?? 'Shared'}: ${s.automated} automated · ${s.manual} manual · ${s.notAutomated} not automated yet`)].join('\n'),
};
