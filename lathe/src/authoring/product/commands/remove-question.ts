// Remove an open question (LA-AUT-CMD131): Removes an open question with what it is about, once it is decided and its answer is written into the records it affects.
import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { PRODUCT_SLICE } from '../model.ts';
import { ProductRepository } from '../repository.ts';

/** The question to remove. */
export type RemoveQuestion = { id: string };

/** Remove an open question (LA-AUT-CMD131). */
export const REMOVE_QUESTION: CommandDefinition<RemoveQuestion> = {
  id: 'LA-AUT-CMD131',
  slice: PRODUCT_SLICE,
  name: 'remove-question',
  description: 'Removes an open question with what it is about, once it is decided and its answer is written into the records it affects.',
  method: 'POST',
  route: '/api/product/remove-question',
  input: {
    id: column('question', 'id', 'required'),
  },
  handler: removeQuestion,
};

/** Removes the question and its about links from its product. */
export function removeQuestion(tx: Transaction, input: RemoveQuestion): void {
  const products = new ProductRepository(tx);
  const product = products.loadHolding('question', input.id) ?? tx.refuse('missing', `there is no open question ${input.id}`);
  product.questions = product.questions.filter((q) => q.row.id !== input.id);
  products.save(product);
}
