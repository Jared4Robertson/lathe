// The Serves reads (LA-TRC-RM12): the business outcomes a record serves, and a product's records by the outcomes they
// serve, answered from the read model through its reader (reader.ts). They read the rows alone, not the checks' run:
// the Serves reach is worked out from the data on every read. Their handlers never see the data and change nothing.
// This slice holds only the reads, so it names its read model where an aggregate's slice names its aggregate.
import { id, type QueryDefinition } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { ProductServes, RecordServes } from './read-model.ts';
import { servesReader, type ServesReader } from './reader.ts';
import { GET_SERVES_IDENTITY, LIST_SERVES_IDENTITY } from './queries.generated.ts';

/** The outcomes the record serves, and the use cases and journeys it serves them through. */
export function getServes(reader: ServesReader, input: { id: string }): RecordServes {
  const serves = reader.servesOf(input.id);
  if (!serves) throw new StoreError([{ rule: 'missing', message: `there is no record ${input.id}` }]);
  return serves;
}

/** Get the outcomes a record serves (LA-TRC-QRY16). */
export const GET_SERVES: QueryDefinition<{ id: string }, RecordServes, ServesReader> = {
  ...GET_SERVES_IDENTITY,
  input: { id: id('The record.', 'required') },
  reader: servesReader,
  run: getServes,
  text: (s) => `${s.id} serves ${s.outcomes.length ? s.outcomes.join(', ') : 'no outcome'}${s.useCases.length ? ` through ${s.useCases.join(', ')}` : ''}${s.journeys.length ? ` via ${s.journeys.join(', ')}` : ''}`,
};

/** Each record of the product's space that serves an outcome, and the aggregates, read models and obligations none reaches. */
export function listServes(reader: ServesReader, input: { product_id: string }): ProductServes {
  const serves = reader.productOf(input.product_id);
  if (!serves) throw new StoreError([{ rule: 'missing', message: `there is no product ${input.product_id}` }]);
  return serves;
}

/** List what serves a product's outcomes (LA-TRC-QRY17). */
export const LIST_SERVES: QueryDefinition<{ product_id: string }, ProductServes, ServesReader> = {
  ...LIST_SERVES_IDENTITY,
  input: { product_id: id('The product.', 'required') },
  reader: servesReader,
  run: listServes,
  text: (p) =>
    [
      `${p.product}: ${p.served.length} record${p.served.length === 1 ? '' : 's'} serve an outcome, ${p.unserved.length} serve${p.unserved.length === 1 ? 's' : ''} none`,
      ...p.served.map((s) => `  ${s.id}: ${s.outcomes.join(', ')}`),
      ...(p.unserved.length ? [`  Serves no outcome: ${p.unserved.join(', ')}`] : []),
    ].join('\n'),
};
