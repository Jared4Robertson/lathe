// Change a specification (LA-AUT-CMD261): Changes a specification's title or statement, or the aggregates it reads (the whole list).
import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { SpecificationRow } from '../../../platform/data/tables.ts';
import { SPECIFICATION_SLICE, changed } from '../model.ts';
import { SpecificationRepository } from '../repository.ts';

/** The specification's changes: a column given is set; reads, when given, replaces the list. */
export type ChangeSpecification = Pick<SpecificationRow, 'id'> & { title?: SpecificationRow['title']; statement?: SpecificationRow['statement']; reads?: string[] };

/** Change a specification (LA-AUT-CMD261). */
export const CHANGE_SPECIFICATION: CommandDefinition<ChangeSpecification> = {
  id: 'LA-AUT-CMD261',
  slice: SPECIFICATION_SLICE,
  name: 'change-specification',
  description: "Changes a specification's title or statement, or the aggregates it reads (the whole list).",
  method: 'POST',
  route: '/api/specification/change-specification',
  input: {
    id: column('specification', 'id', 'required'),
    title: column('specification', 'title', 'optional'),
    statement: column('specification', 'statement', 'optional'),
    reads: ids('The aggregates it reads, of its own domain. Replaces the list.', 'optional'),
  },
  handler: changeSpecification,
};

/** Changes the specification's columns and the aggregates it reads. */
export function changeSpecification(tx: Transaction, input: ChangeSpecification): void {
  const specifications = new SpecificationRepository(tx);
  const specification = specifications.load(input.id) ?? tx.refuse('missing', `there is no specification ${input.id}`);
  specification.specification = changed(specification.specification, input, ['title', 'statement']);
  if (input.reads) specification.reads = input.reads;
  specifications.save(specification);
}
