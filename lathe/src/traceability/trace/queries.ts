// The Trace read (LA-TRC-RM11): a product's traces as its Trace stage draws them, answered from the read model through
// its reader (reader.ts). Chains and coverage are the checks' run's, so the query says it reads the run (`checked`):
// the server gives it the run it keeps for the data, the CLI and the MCP tool run the checks first. Its handler never
// sees the data and changes nothing. This slice holds only the read, so it names its read model where an aggregate's
// slice names its aggregate.
import { id, type AnyQuery, type QueryDefinition, type Slice } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { ProductTraces } from './read-model.ts';
import { traceReader, type TraceReader } from './reader.ts';

/** How the interfaces reach the Trace read: `lathe trace`, the trace_ tools, /api/trace/. */
const TRACE_SLICE: Slice = { aggregate: 'LA-TRC-RM11', name: 'trace' };

/** Each obligation of the product's space with its chain, gaps and whether only proof is asked of it, the untraced records, and the Serves links. */
export function listTraces(reader: TraceReader, input: { product_id: string }): ProductTraces {
  const traces = reader.tracesOf(input.product_id);
  if (!traces) throw new StoreError([{ rule: 'missing', message: `there is no product ${input.product_id}` }]);
  return traces;
}

/** List a product's traces (LA-TRC-QRY15). */
export const LIST_TRACES: QueryDefinition<{ product_id: string }, ProductTraces, TraceReader> = {
  id: 'LA-TRC-QRY15',
  slice: TRACE_SLICE,
  name: 'list-traces',
  method: 'GET',
  route: '/api/trace/list-traces',
  description: "Lists each obligation of a product's space with its chain (what designs, builds and proves it, the files those name and the links between them), the gaps coverage reports for it and whether only proof is asked of it, the records coverage reports untraced, the product's business outcomes, and each use case of its space with the outcomes its capability serves and the obligations it reaches. Runs the checks first.",
  input: { product_id: id('The product.', 'required') },
  checked: true,
  reader: traceReader,
  run: listTraces,
  text: (p) =>
    [
      `${p.product}: ${p.traces.length} obligation${p.traces.length === 1 ? '' : 's'} traced, ${p.untraced.length} record${p.untraced.length === 1 ? '' : 's'} untraced`,
      ...p.traces.map((t) => `  ${t.obligation}${t.proofOnly ? ' (proof only)' : ''}: ${t.design.length} design · ${t.build.length} build · ${t.tests.length} tests · ${t.files.length} files${t.gaps.length ? ` · not ${t.gaps.join(', not ')}` : ''}`),
      ...(p.untraced.length ? [`  Untraced: ${p.untraced.join(', ')}`] : []),
      ...p.useCases.map((u) => `  ${u.useCase} serves ${u.outcomes.length ? u.outcomes.join(', ') : 'no outcome'} · reaches ${u.reaches.length} obligation${u.reaches.length === 1 ? '' : 's'}`),
    ].join('\n'),
};

/** The Trace read's queries, as the CLI and the MCP server register them. */
export const TRACE_QUERIES: readonly AnyQuery[] = [LIST_TRACES];
