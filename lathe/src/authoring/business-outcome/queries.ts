// The Business outcome aggregate's own reads (read model LA-AUT-RM36): an outcome's page, the outcomes of a product,
// and the next free ID for one. Each reads only the read model, through its reader (reader.ts), and changes
// nothing.
import { id, type QueryDefinition } from '../../platform/commands/definition.ts';
import { onePast } from '../../platform/data/id-shape.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { BusinessOutcomePage, BusinessOutcomeSummary } from './read-model.ts';
import { businessOutcomeReader, type BusinessOutcomeReader } from './reader.ts';
import { GET_BUSINESS_OUTCOME_IDENTITY, LIST_BUSINESS_OUTCOMES_IDENTITY, NEXT_BUSINESS_OUTCOME_ID_IDENTITY } from './queries.generated.ts';

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

/** The page of the business outcome with this ID. */
export function getBusinessOutcome(reader: BusinessOutcomeReader, input: { id: string }): BusinessOutcomePage {
  const kind = reader.kindOf(input.id) ?? refuse('missing', `no record has the ID ${input.id}`);
  if (kind !== 'business_outcome') refuse('kind', `${input.id} is ${/^[aeiou]/.test(kind) ? 'an' : 'a'} ${kind}, not a business outcome`);
  return reader.page(input.id)!;
}

/** Get a business outcome whole (LA-AUT-QRY115). */
export const GET_BUSINESS_OUTCOME: QueryDefinition<{ id: string }, BusinessOutcomePage, BusinessOutcomeReader> = {
  ...GET_BUSINESS_OUTCOME_IDENTITY,
  input: { id: id('The business outcome.', 'required') },
  reader: businessOutcomeReader,
  run: getBusinessOutcome,
  text: outcomeText,
};

/** The business outcomes of a product, by ID. */
export function listBusinessOutcomes(reader: BusinessOutcomeReader, input: { product_id: string }): BusinessOutcomeSummary[] {
  if (reader.kindOf(input.product_id) !== 'product') refuse('missing', `there is no product ${input.product_id}`);
  return reader.list(input.product_id);
}

/** List the business outcomes of a product (LA-AUT-QRY116). */
export const LIST_BUSINESS_OUTCOMES: QueryDefinition<{ product_id: string }, BusinessOutcomeSummary[], BusinessOutcomeReader> = {
  ...LIST_BUSINESS_OUTCOMES_IDENTITY,
  input: { product_id: id('The product.', 'required') },
  reader: businessOutcomeReader,
  run: listBusinessOutcomes,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title}`).join('\n') : 'No business outcomes.'),
};

/** The next free ID for a business outcome of the product: its ID and BO, one past the highest number in use. */
export function nextBusinessOutcomeId(reader: BusinessOutcomeReader, input: { product_id: string }): string {
  const shape = reader.idShape('business_outcome');
  if (reader.kindOf(input.product_id) !== shape.parents[0]) refuse('parent', `a business outcome sits under a product, and ${input.product_id} is not one`);
  return onePast(reader, `${input.product_id}-${shape.letters}`, shape);
}

/** Get the next ID for a business outcome (LA-AUT-QRY117). */
export const NEXT_BUSINESS_OUTCOME_ID: QueryDefinition<{ product_id: string }, string, BusinessOutcomeReader> = {
  ...NEXT_BUSINESS_OUTCOME_ID_IDENTITY,
  input: { product_id: id('The product it will sit under.', 'required') },
  reader: businessOutcomeReader,
  run: nextBusinessOutcomeId,
  text: (next) => next,
};

/** An outcome as text: its row, then what measures it. */
function outcomeText(outcome: BusinessOutcomePage): string {
  const row = outcome.outcome;
  const lines = [`Business outcome ${row.id}: ${row.title}`, `  product: ${row.product_id}`, `  statement: ${row.statement}`, `  measure: ${row.measure}`, `  target: ${row.target}`];
  if (row.measured_outside) lines.push(`  measured outside: ${row.measured_outside}`);
  if (row.notes) lines.push(`  notes: ${row.notes}`);
  if (outcome.measuredBy.length) lines.push(`  measured by: ${outcome.measuredBy.join(', ')}`);
  if (outcome.servedBy.length) lines.push(`  served by: ${outcome.servedBy.join(', ')}`);
  if (outcome.journeys.length) lines.push(`  journeys: ${outcome.journeys.map((j) => `${j.id} ${j.title}`).join(', ')}`);
  return lines.join('\n');
}
