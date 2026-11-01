// The Check aggregate's own reads, each answered from its read model (LA-CHK-RM10) through its reader (reader.ts): a
// check whole by its name, and the checks that run on a product, Lathe's and its own, in run order. A handler never
// sees the data; each changes nothing. A check is named by its meaning, so it has no next ID.
import { id, type QueryDefinition } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { CheckPage, CheckSummary } from './read-model.ts';
import { checkReader, type CheckReader } from './reader.ts';
import { GET_CHECK_IDENTITY, LIST_CHECKS_IDENTITY } from './queries.generated.ts';

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

/** The check with the name, whole. */
export function getCheck(reader: CheckReader, input: { name: string }): CheckPage {
  return reader.check(input.name) ?? refuse('missing', `there is no check ${input.name}`);
}

/** GET a check whole (LA-CHK-QRY10). */
export const GET_CHECK: QueryDefinition<{ name: string }, CheckPage, CheckReader> = {
  ...GET_CHECK_IDENTITY,
  input: { name: id("The check's name.", 'required') },
  reader: checkReader,
  run: getCheck,
  text: (c) =>
    [`Check ${c.name} (${c.product ? `product ${c.product}` : "Lathe's"}, ${c.severity}, position ${c.position})`, `  summary: ${c.summary}`, `  explanation: ${c.explanation}`, ...(c.kinds.length ? [`  kinds: ${c.kinds.join(', ')}`] : []), '  query:', ...c.query.split('\n').map((l) => `    ${l}`)].join('\n'),
};

/** The checks that run on the product: Lathe's, then the product's own, each in its run order. */
export function listChecks(reader: CheckReader, input: { product_id: string }): CheckSummary[] {
  return reader.checksOn(input.product_id) ?? refuse('missing', `there is no product ${input.product_id}`);
}

/** List the checks that run on a product (LA-CHK-QRY11). */
export const LIST_CHECKS: QueryDefinition<{ product_id: string }, CheckSummary[], CheckReader> = {
  ...LIST_CHECKS_IDENTITY,
  input: { product_id: id('The product.', 'required') },
  reader: checkReader,
  run: listChecks,
  text: (rows) => (rows.length ? rows.map((r) => `${r.name}  ${r.severity}${r.product ? ` (${r.product})` : ''}: ${r.summary}`).join('\n') : 'No checks.'),
};
