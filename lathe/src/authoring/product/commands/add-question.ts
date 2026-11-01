import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { QuestionRow } from '../../../platform/data/tables.ts';
import { productUnder } from '../model.ts';
import { ProductRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { ADD_QUESTION_IDENTITY } from './identities.generated.ts';

export type AddQuestion = Pick<QuestionRow, 'id' | 'title' | 'product_id' | 'domain_id' | 'owner' | 'description'> & { about?: string[] };

export const ADD_QUESTION: CommandDefinition<AddQuestion> = {
  ...ADD_QUESTION_IDENTITY,
  input: {
    id: column('question', 'id', 'required'),
    title: column('question', 'title', 'required'),
    product_id: column('question', 'product_id', 'optional'),
    domain_id: column('question', 'domain_id', 'optional'),
    owner: column('question', 'owner', 'required'),
    description: column('question', 'description', 'required'),
    about: ids('The records it is about, of its own product.', 'optional'),
  },
  handler: addQuestion,
};

/** Adds the question to the product it sits in. */
export function addQuestion(tx: Transaction, input: AddQuestion): void {
  const products = new ProductRepository(tx);
  if (tx.record(input.id)) tx.refuse('primary-key', `question ${input.id} already exists`);
  const product = products.load(productUnder(tx, input)) ?? tx.refuse('missing', `there is no product ${input.product_id}`);
  const { about = [], ...row } = input;
  product.questions.push({ row, about });
  holdToRules(tx, product);
  products.save(product);
}
