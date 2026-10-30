// The Record trace read (LA-TRC-RM06): one record's traceability, as the Record page pattern's Traceability section
// shows it, answered from the read model through its reader (reader.ts). Chains, coverage and problems are the checks'
// run's, so the query says it reads the run (`checked`). Its handler never sees the data and changes nothing. This
// slice holds only the read, so it names its read model where an aggregate's slice names its aggregate.
import { id, type AnyQuery, type QueryDefinition, type Slice } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { RecordTrace } from './read-model.ts';
import { recordTraceReader, type RecordTraceReader } from './reader.ts';

/** How the interfaces reach the Record trace read: `lathe record-trace`, the record_trace_ tools, /api/record-trace/. */
const RECORD_TRACE_SLICE: Slice = { aggregate: 'LA-TRC-RM06', name: 'record-trace' };

/** The record's traceability. */
export function getRecordTrace(reader: RecordTraceReader, input: { id: string }): RecordTrace {
  const trace = reader.traceOf(input.id);
  if (!trace) throw new StoreError([{ rule: 'missing', message: `there is no record ${input.id}` }]);
  return trace;
}

/** Get a record's traceability (LA-TRC-QRY05). */
export const GET_RECORD_TRACE: QueryDefinition<{ id: string }, RecordTrace, RecordTraceReader> = {
  id: 'LA-TRC-QRY05',
  slice: RECORD_TRACE_SLICE,
  name: 'get-record-trace',
  method: 'GET',
  route: '/api/record-trace/get-record-trace',
  description: "Gets one record's traceability: for an obligation its chain (designed by, built by with each built or not, proved by) and how each owing domain stands on it with its gaps; for a use case its UC requirements, each judged; for a test what it proves and how it is run; and its other links both ways by relation. Runs the checks first.",
  input: { id: id('The record.', 'required') },
  checked: true,
  reader: recordTraceReader,
  run: getRecordTrace,
  text: (t) =>
    [
      t.id,
      ...t.chain.map((g) => `  ${g.label}: ${g.ids.join(', ')}`),
      ...t.judgments.map((j) => `  ${j.domain}: ${j.gaps.length ? j.gaps.map((g) => g.kind).join(', ') : 'designed, built and proved'}`),
      ...t.requirements.map((r) => `  ${r.id}: ${r.judgment?.gaps.map((g) => g.kind).join(', ') || 'ok'}`),
      ...(t.proves ? [`  Proves: ${t.proves}`] : []),
      ...t.links.map((g) => `  ${g.label}: ${g.ids.join(', ')}`),
    ].join('\n'),
};

/** The Record trace read's queries, as the CLI and the MCP server register them. */
export const RECORD_TRACE_QUERIES: readonly AnyQuery[] = [GET_RECORD_TRACE];
