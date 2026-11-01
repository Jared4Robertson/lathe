import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { SpecificationRow } from '../../../platform/data/tables.ts';
import { newSpecification } from '../model.ts';
import { SpecificationRepository } from '../repository.ts';
import { ADD_SPECIFICATION_IDENTITY } from './identities.generated.ts';

export type AddSpecification = Pick<SpecificationRow, 'id' | 'title' | 'statement'> & { reads?: string[] };

export const ADD_SPECIFICATION: CommandDefinition<AddSpecification> = {
  ...ADD_SPECIFICATION_IDENTITY,
  input: {
    id: column('specification', 'id', 'required'),
    title: column('specification', 'title', 'required'),
    statement: column('specification', 'statement', 'required'),
    reads: ids('The aggregates it reads, of its own domain.', 'optional'),
  },
  handler: addSpecification,
};

export function addSpecification(tx: Transaction, input: AddSpecification): void {
  const specifications = new SpecificationRepository(tx);
  const { reads = [], ...row } = input;
  const specification = specifications.create(newSpecification(row, reads));
  specifications.save(specification);
}
