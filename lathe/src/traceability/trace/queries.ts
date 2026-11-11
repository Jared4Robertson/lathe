// The Trace reads (LA-TRC-RM13): a product's use cases as the Trace stage draws them, one row each
// from its outcomes to its acceptance tests, and a journey's proof, rolled up from its steps and its journey test,
// answered from the read model through its reader (reader.ts). Gaps and tests are the checks' run's, so each query
// says it reads the run (`checked`): the server gives it the run it keeps for
// the data, the CLI and the MCP tool run the checks first. A handler never sees the data and changes nothing. This
// slice holds only the read, so it names its read model where an aggregate's slice names its aggregate.
import { id, type QueryDefinition } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { TraceRow, ProductTrace, TraceJourney } from './read-model.ts';
import { traceReader, type TraceReader } from './reader.ts';
import { LIST_TRACED_USE_CASES_IDENTITY, GET_JOURNEY_PROOF_IDENTITY, LIST_JOURNEY_PROOFS_IDENTITY } from './queries.generated.ts';

/** Each use case of the product's space with its outcomes, requirements, flows, technical chains and acceptance tests. */
export function listTracedUseCases(reader: TraceReader, input: { product_id: string }): ProductTrace {
  const trace = reader.traceOf(input.product_id);
  if (!trace) throw new StoreError([{ rule: 'missing', message: `there is no product ${input.product_id}` }]);
  return trace;
}

const all = (k: number, words: string) => (k === 0 ? `all ${words}` : `${k} not ${words}`);
/** A row's status per stage in words: "2 interfaces, all designed · 3 handlers, 1 not built · 4 tests, all proved"; the integrations that perform it, when any do. */
export const statusWords = (r: TraceRow): string => {
  const { design, technical, suite } = r.status;
  const performers = design.integrations > 0 ? `, ${design.integrations} integration${design.integrations === 1 ? '' : 's'}` : '';
  return `${design.interfaces} interface${design.interfaces === 1 ? '' : 's'}${performers}, ${all(design.notDesigned, 'designed')} · ${technical.handlers} handler${technical.handlers === 1 ? '' : 's'}, ${all(technical.notBuilt, 'built')} · ${suite.tests} test${suite.tests === 1 ? '' : 's'}, ${all(suite.notProved, 'proved')}`;
};

/** List a product's traced use cases (LA-TRC-QRY18). */
export const LIST_TRACED_USE_CASES: QueryDefinition<{ product_id: string }, ProductTrace, TraceReader> = {
  ...LIST_TRACED_USE_CASES_IDENTITY,
  input: { product_id: id('The product.', 'required') },
  checked: true,
  reader: traceReader,
  run: listTracedUseCases,
  text: (p) =>
    [
      `${p.product}: ${p.rows.length} use case${p.rows.length === 1 ? '' : 's'}, ${p.outcomes.length} outcome${p.outcomes.length === 1 ? '' : 's'}`,
      ...p.rows.map((r) => `  ${r.useCase} (${r.outcomes.length ? r.outcomes.join(', ') : 'no outcome'}): ${statusWords(r)}`),
    ].join('\n'),
};

/** How far a journey is proved: its steps and journey test, rolled up from the rows and the checks' run. */
export function getJourneyProof(reader: TraceReader, input: { id: string }): TraceJourney {
  const journey = reader.journeyOf(input.id);
  if (!journey) throw new StoreError([{ rule: 'missing', message: `there is no journey ${input.id}` }]);
  return journey;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
/** A journey's proof in words: "3 steps · 2 proved · 1 carrying out nothing yet · journey test proved". */
const proofWords = (j: TraceJourney): string =>
  [
    plural(j.status.steps, 'step'),
    `${j.status.stepsProved} proved`,
    ...(j.status.unlinked ? [`${j.status.unlinked} carrying out nothing yet`] : []),
    j.test === null ? 'no journey test' : `journey test ${j.testProved ? 'proved' : 'not proved'}`,
  ].join(' · ');

/** Get a journey's proof (LA-TRC-QRY19). */
export const GET_JOURNEY_PROOF: QueryDefinition<{ id: string }, TraceJourney, TraceReader> = {
  ...GET_JOURNEY_PROOF_IDENTITY,
  input: { id: id('The journey.', 'required') },
  checked: true,
  reader: traceReader,
  run: getJourneyProof,
  text: (j) =>
    [
      `${j.id} (${j.outcomes.length ? j.outcomes.join(', ') : 'no outcome'}): ${j.proved ? 'proved' : 'not proved'} · ${proofWords(j)}`,
      ...j.steps.map((s) => `  ${s.path} ${s.position} ${s.id}: ${s.carriesOut ?? 'carries out nothing yet'}${s.kind === 'policy' ? ' (handoff)' : s.actors.length ? ` (${s.actors.join(', ')})` : ''}, ${s.proved ? 'proved' : 'not proved'}`),
    ].join('\n'),
};

/** Every journey's proof of a product, in ID order. */
export function listJourneyProofs(reader: TraceReader, input: { product_id: string }): { product: string; journeys: TraceJourney[] } {
  const trace = reader.traceOf(input.product_id);
  if (!trace) throw new StoreError([{ rule: 'missing', message: `there is no product ${input.product_id}` }]);
  return { product: trace.product, journeys: trace.journeys };
}

/** List a product's journey proofs (LA-TRC-QRY21): what a page that shows every journey reads, in one read. */
export const LIST_JOURNEY_PROOFS: QueryDefinition<{ product_id: string }, { product: string; journeys: TraceJourney[] }, TraceReader> = {
  ...LIST_JOURNEY_PROOFS_IDENTITY,
  input: { product_id: id('The product.', 'required') },
  checked: true,
  reader: traceReader,
  run: listJourneyProofs,
  text: (p) => [`${p.product}: ${p.journeys.filter((j) => j.proved).length} of ${plural(p.journeys.length, 'journey')} proved`, ...p.journeys.map((j) => `  ${j.id}: ${j.proved ? 'proved' : 'not proved'} · ${proofWords(j)}`)].join('\n'),
};
