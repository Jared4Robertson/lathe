import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { SpecificationRow } from '../../../platform/data/tables.ts';
import { changed } from '../model.ts';
import { SpecificationRepository } from '../repository.ts';
import { CHANGE_SPECIFICATION_IDENTITY } from './identities.generated.ts';

/** The specification's changes: a column given is set; reads, when given, replaces the list. */
export type ChangeSpecification = Pick<SpecificationRow, 'id'> & { title?: SpecificationRow['title']; statement?: SpecificationRow['statement']; reads?: string[] };

export const CHANGE_SPECIFICATION = {
  ...CHANGE_SPECIFICATION_IDENTITY,
  input: {
    id: column('specification', 'id', 'required'),
    title: column('specification', 'title', 'optional'),
    statement: column('specification', 'statement', 'optional'),
    reads: ids('The aggregates it reads, of its own domain. Replaces the list.', 'optional'),
  },
  handler: changeSpecification,
} satisfies CommandDefinition<ChangeSpecification>;

/** Changes the specification's columns and the aggregates it reads. */
export function changeSpecification(tx: Transaction, input: ChangeSpecification): void {
  const specifications = new SpecificationRepository(tx);
  const specification = specifications.load(input.id) ?? tx.refuse('missing', `there is no specification ${input.id}`);
  specification.specification = changed(specification.specification, input, ['title', 'statement']);
  if (input.reads) specification.reads = input.reads;
  specifications.save(specification);
}
