// Add an open question (LA-AUT-CMD128): Adds an open question under its product or one of its domains, with the role that decides it and the records it is about.
import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { QuestionRow } from '../../../platform/data/tables.ts';
import { PRODUCT_SLICE, productUnder } from '../model.ts';
import { ProductRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** A new open question, under its product or a domain, with the records it is about. */
export type AddQuestion = Pick<QuestionRow, 'id' | 'title' | 'product_id' | 'domain_id' | 'owner' | 'description'> & { about?: string[] };

/** Add an open question (LA-AUT-CMD128). */
export const ADD_QUESTION: CommandDefinition<AddQuestion> = {
  id: 'LA-AUT-CMD128',
  slice: PRODUCT_SLICE,
  name: 'add-question',
  description: 'Adds an open question under its product or one of its domains, with the role that decides it and the records it is about.',
  method: 'POST',
  route: '/api/product/add-question',
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
