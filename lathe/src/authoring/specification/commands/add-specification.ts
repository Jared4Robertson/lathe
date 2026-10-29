// Add a specification (LA-AUT-CMD260): Adds a specification, in the domain its ID names, with the aggregates it reads.
import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { SpecificationRow } from '../../../platform/data/tables.ts';
import { SPECIFICATION_SLICE, newSpecification } from '../model.ts';
import { SpecificationRepository } from '../repository.ts';

/** A new specification, with the aggregates it reads. */
export type AddSpecification = Pick<SpecificationRow, 'id' | 'title' | 'statement'> & { reads?: string[] };

/** Add a specification (LA-AUT-CMD260). */
export const ADD_SPECIFICATION: CommandDefinition<AddSpecification> = {
  id: 'LA-AUT-CMD260',
  slice: SPECIFICATION_SLICE,
  name: 'add-specification',
  description: 'Adds a specification, in the domain its ID names, with the aggregates it reads.',
  method: 'POST',
  route: '/api/specification/add-specification',
  input: {
    id: column('specification', 'id', 'required'),
    title: column('specification', 'title', 'required'),
    statement: column('specification', 'statement', 'required'),
    reads: ids('The aggregates it reads, of its own domain.', 'optional'),
  },
  handler: addSpecification,
};

/** Adds the specification, whole and new, with the aggregates it reads. */
export function addSpecification(tx: Transaction, input: AddSpecification): void {
  const specifications = new SpecificationRepository(tx);
  const { reads = [], ...row } = input;
  const specification = specifications.create(newSpecification(row, reads));
  specifications.save(specification);
}
