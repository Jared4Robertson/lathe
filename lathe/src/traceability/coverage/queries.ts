// The Coverage read (LA-TRC-RM01): a product's coverage, scope by scope, answered from the read model through its
// reader (reader.ts). Coverage is the checks' run's, so the query says it reads the run (`checked`): the server gives
// it the run it keeps for the data, the CLI and the MCP tool run the checks first. Its handler never sees the data and
// changes nothing. This slice holds only the read, so it names its read model where an aggregate's slice names its aggregate.
import { id, type AnyQuery, type QueryDefinition, type Slice } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { ProductCoverage } from './read-model.ts';
import { coverageReader, type CoverageReader } from './reader.ts';

/** How the interfaces reach the Coverage read: `lathe coverage`, the coverage_ tools, /api/coverage/. */
const COVERAGE_SLICE: Slice = { aggregate: 'LA-TRC-RM01', name: 'coverage' };

/** The product's coverage: its own scope, then each domain's. */
export function getCoverage(reader: CoverageReader, input: { product_id: string }): ProductCoverage {
  const coverage = reader.coverageOf(input.product_id);
  if (!coverage) throw new StoreError([{ rule: 'missing', message: `there is no product ${input.product_id}` }]);
  return coverage;
}

/** Get coverage counts (LA-TRC-QRY01). */
export const GET_COVERAGE: QueryDefinition<{ product_id: string }, ProductCoverage, CoverageReader> = {
  id: 'LA-TRC-QRY01',
  slice: COVERAGE_SLICE,
  name: 'get-coverage',
  method: 'GET',
  route: '/api/coverage/get-coverage',
  description: "Gets a product's coverage, for its records outside every domain and then each domain: per obligation kind how many are designed, built, proved and not automated yet out of the total, its tests by state, and its gaps. Runs the checks first.",
  input: { product_id: id('The product.', 'required') },
  checked: true,
  reader: coverageReader,
  run: getCoverage,
  text: (c) =>
    [
      c.product,
      ...c.scopes.map((s) => `  ${s.domain ?? 'Shared'}: ${s.obligations.filter((o) => o.total > 0).map((o) => `${o.label} ${o.proved}/${o.total} proved`).join(' · ') || 'no obligations'}${s.gaps.length ? ` · ${s.gaps.length} gaps` : ''}`),
    ].join('\n'),
};

/** The Coverage read's queries, as the CLI and the MCP server register them. */
export const COVERAGE_QUERIES: readonly AnyQuery[] = [GET_COVERAGE];
