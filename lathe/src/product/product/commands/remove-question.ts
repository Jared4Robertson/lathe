import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { ProductRepository } from '../repository.ts';
import { REMOVE_QUESTION_IDENTITY } from './identities.generated.ts';

/** The question to remove. */
export type RemoveQuestion = { id: string };

export const REMOVE_QUESTION = {
  ...REMOVE_QUESTION_IDENTITY,
  input: {
    id: column('question', 'id', 'required'),
  },
  handler: removeQuestion,
} satisfies CommandDefinition<RemoveQuestion>;

/** Removes the question and its about links from its product. */
export function removeQuestion(tx: Transaction, input: RemoveQuestion): void {
  const products = new ProductRepository(tx);
  const product = products.loadHoldingQuestion(input.id) ?? tx.refuse('missing', `there is no open question ${input.id}`);
  product.questions = product.questions.filter((q) => q.row.id !== input.id);
  products.save(product);
}
