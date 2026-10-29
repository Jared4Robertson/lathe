// The Business outcome aggregate's own reads (read model LA-AUT-RM36): an outcome's page, the outcomes of a product,
// and the next free ID for one. Each reads only the read model, through its reader (reader.ts), and changes
// nothing.
import { id, type AnyQuery, type QueryDefinition } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import { BUSINESS_OUTCOME_SLICE } from './model.ts';
import type { BusinessOutcomePage, BusinessOutcomeSummary } from './read-model.ts';
import { businessOutcomeReader, type BusinessOutcomeReader } from './reader.ts';

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
  id: 'LA-AUT-QRY115',
  slice: BUSINESS_OUTCOME_SLICE,
  name: 'get-business-outcome',
  description: 'Reads a business outcome whole, by its ID: its statement, measure and target, the tests and records that measure it, and the capabilities that serve it.',
  method: 'GET',
  route: '/api/business-outcome/get-business-outcome',
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
  id: 'LA-AUT-QRY116',
  slice: BUSINESS_OUTCOME_SLICE,
  name: 'list-business-outcomes',
  description: 'Lists the business outcomes of a product, by ID, with their titles.',
  method: 'GET',
  route: '/api/business-outcome/list-business-outcomes',
  input: { product_id: id('The product.', 'required') },
  reader: businessOutcomeReader,
  run: listBusinessOutcomes,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title}`).join('\n') : 'No business outcomes.'),
};

/** The next free ID for a business outcome of the product: its ID and BO, one past the highest number in use. */
export function nextBusinessOutcomeId(reader: BusinessOutcomeReader, input: { product_id: string }): string {
  if (reader.kindOf(input.product_id) !== 'product') refuse('parent', `a business outcome sits under a product, and ${input.product_id} is not one`);
  const prefix = `${input.product_id}-BO`;
  return `${prefix}${String(reader.highestAfter(prefix) + 1).padStart(2, '0')}`;
}

/** Get the next ID for a business outcome (LA-AUT-QRY117). */
export const NEXT_BUSINESS_OUTCOME_ID: QueryDefinition<{ product_id: string }, string, BusinessOutcomeReader> = {
  id: 'LA-AUT-QRY117',
  slice: BUSINESS_OUTCOME_SLICE,
  name: 'next-id',
  description: 'The next free ID for a business outcome of a product: one past the highest in use.',
  method: 'GET',
  route: '/api/business-outcome/next-id',
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
  return lines.join('\n');
}

/** The Business outcome aggregate's queries, as the CLI and the MCP server register them. */
export const BUSINESS_OUTCOME_QUERIES: readonly AnyQuery[] = [GET_BUSINESS_OUTCOME, LIST_BUSINESS_OUTCOMES, NEXT_BUSINESS_OUTCOME_ID];
