// Move an open question (LA-AUT-CMD130): Moves an open question between its product and one of the product's domains, or from one domain to another of the same product.
import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { QuestionRow } from '../../../platform/data/tables.ts';
import { PRODUCT_SLICE, productUnder } from '../model.ts';
import { ProductRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** The question and where it moves to: its product, or one of its domains. */
export type MoveQuestion = Pick<QuestionRow, 'id' | 'product_id' | 'domain_id'>;

/** Move an open question (LA-AUT-CMD130). */
export const MOVE_QUESTION: CommandDefinition<MoveQuestion> = {
  id: 'LA-AUT-CMD130',
  slice: PRODUCT_SLICE,
  name: 'move-question',
  description: "Moves an open question between its product and one of the product's domains, or from one domain to another of the same product.",
  method: 'POST',
  route: '/api/product/move-question',
  input: {
    id: column('question', 'id', 'required'),
    product_id: column('question', 'product_id', 'optional'),
    domain_id: column('question', 'domain_id', 'optional'),
  },
  handler: moveQuestion,
};

/** Puts the question under the product or the other domain; what it is about stays. */
export function moveQuestion(tx: Transaction, input: MoveQuestion): void {
  const products = new ProductRepository(tx);
  const product = products.loadHolding('question', input.id) ?? tx.refuse('missing', `there is no open question ${input.id}`);
  const to = productUnder(tx, input);
  if (to !== product.root) tx.refuse('parent', `${input.id} is a question of ${product.root}, so it moves only within ${product.root}, not to ${input.product_id ?? input.domain_id}`);
  const question = product.questions.find((q) => q.row.id === input.id)!;
  if (question.row.product_id === input.product_id && question.row.domain_id === input.domain_id) tx.refuse('parent', `${input.id} is already under ${input.product_id ?? input.domain_id}`);
  const { product_id: _p, domain_id: _d, ...rest } = question.row;
  question.row = { ...rest, ...(input.product_id ? { product_id: input.product_id } : { domain_id: input.domain_id }) };
  holdToRules(tx, product);
  products.save(product);
}
