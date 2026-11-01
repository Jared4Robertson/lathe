// The Trace read (LA-TRC-RM13): a product's use cases as the Trace stage draws them, one row each
// from its outcomes to its acceptance tests, answered from the read model through its reader (reader.ts). Gaps and
// tests are the checks' run's, so the query says it reads the run (`checked`): the server gives it the run it keeps for
// the data, the CLI and the MCP tool run the checks first. Its handler never sees the data and changes nothing. This
// slice holds only the read, so it names its read model where an aggregate's slice names its aggregate.
import { id, type QueryDefinition } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { TraceRow, ProductTrace } from './read-model.ts';
import { traceReader, type TraceReader } from './reader.ts';
import { LIST_TRACE_ROWS_IDENTITY } from './queries.generated.ts';

/** Each use case of the product's space with its outcomes, requirements, flows, technical chains and acceptance tests. */
export function listTraceRows(reader: TraceReader, input: { product_id: string }): ProductTrace {
  const trace = reader.traceOf(input.product_id);
  if (!trace) throw new StoreError([{ rule: 'missing', message: `there is no product ${input.product_id}` }]);
  return trace;
}

const all = (k: number, words: string) => (k === 0 ? `all ${words}` : `${k} not ${words}`);
/** A row's status per stage in words: "2 interfaces, all designed · 3 handlers, 1 not built · 4 tests, all proved". */
export const statusWords = (r: TraceRow): string => {
  const { design, technical, suite } = r.status;
  return `${design.interfaces} interface${design.interfaces === 1 ? '' : 's'}, ${all(design.notDesigned, 'designed')} · ${technical.handlers} handler${technical.handlers === 1 ? '' : 's'}, ${all(technical.notBuilt, 'built')} · ${suite.tests} test${suite.tests === 1 ? '' : 's'}, ${all(suite.notProved, 'proved')}`;
};

/** List a product's trace rows (LA-TRC-QRY18). */
export const LIST_TRACE_ROWS: QueryDefinition<{ product_id: string }, ProductTrace, TraceReader> = {
  ...LIST_TRACE_ROWS_IDENTITY,
  input: { product_id: id('The product.', 'required') },
  checked: true,
  reader: traceReader,
  run: listTraceRows,
  text: (p) =>
    [
      `${p.product}: ${p.rows.length} use case${p.rows.length === 1 ? '' : 's'}, ${p.outcomes.length} outcome${p.outcomes.length === 1 ? '' : 's'}`,
      ...p.rows.map((r) => `  ${r.useCase} (${r.outcomes.length ? r.outcomes.join(', ') : 'no outcome'}): ${statusWords(r)}`),
    ].join('\n'),
};
