import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { QuestionRow } from '../../../platform/data/tables.ts';
import { changed } from '../model.ts';
import { ProductRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { CHANGE_QUESTION_IDENTITY } from './identities.generated.ts';

/** The question's changes: a column given is set; about, when given, replaces the list. */
export type ChangeQuestion = Pick<QuestionRow, 'id'> & { title?: string; owner?: string; description?: string; about?: string[] };

export const CHANGE_QUESTION = {
  ...CHANGE_QUESTION_IDENTITY,
  input: {
    id: column('question', 'id', 'required'),
    title: column('question', 'title', 'optional'),
    owner: column('question', 'owner', 'optional'),
    description: column('question', 'description', 'optional'),
    about: ids('The records it is about, of its own product. Replaces the list.', 'optional'),
  },
  handler: changeQuestion,
} satisfies CommandDefinition<ChangeQuestion>;

/** Changes the question's columns and what it is about. */
export function changeQuestion(tx: Transaction, input: ChangeQuestion): void {
  const products = new ProductRepository(tx);
  const product = products.loadHolding('question', input.id) ?? tx.refuse('missing', `there is no open question ${input.id}`);
  product.questions = product.questions.map((q) => (q.row.id !== input.id ? q : { row: changed(q.row, input, ['title', 'owner', 'description']), about: input.about ?? q.about }));
  holdToRules(tx, product);
  products.save(product);
}
