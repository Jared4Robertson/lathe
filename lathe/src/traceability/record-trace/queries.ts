// The Record trace read (LA-TRC-RM06): one record's traceability, as the Record page pattern's Traceability section
// shows it, answered from the read model through its reader (reader.ts). Chains, coverage and problems are the checks'
// run's, so the query says it reads the run (`checked`). Its handler never sees the data and changes nothing. This
// slice holds only the read, so it names its read model where an aggregate's slice names its aggregate.
import { id, type QueryDefinition } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { RecordTrace } from './read-model.ts';
import { recordTraceReader, type RecordTraceReader } from './reader.ts';
import { GET_RECORD_TRACE_IDENTITY } from './queries.generated.ts';

/** The record's traceability. */
export function getRecordTrace(reader: RecordTraceReader, input: { id: string }): RecordTrace {
  const trace = reader.traceOf(input.id);
  if (!trace) throw new StoreError([{ rule: 'missing', message: `there is no record ${input.id}` }]);
  return trace;
}

/** Get a record's traceability (LA-TRC-QRY05). */
export const GET_RECORD_TRACE: QueryDefinition<{ id: string }, RecordTrace, RecordTraceReader> = {
  ...GET_RECORD_TRACE_IDENTITY,
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
