import { column, id, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { toDomain } from '../../../platform/data/renames.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { SpecificationRepository } from '../repository.ts';
import { MOVE_SPECIFICATION_IDENTITY } from './identities.generated.ts';

/** The specification and the domain it moves to. */
export interface MoveSpecification {
  id: string;
  domain_id: string;
}

export const MOVE_SPECIFICATION = {
  ...MOVE_SPECIFICATION_IDENTITY,
  input: {
    id: column('specification', 'id', 'required'),
    domain_id: id('The domain of its product the specification moves to.', 'required'),
  },
  handler: moveSpecification,
} satisfies CommandDefinition<MoveSpecification>;

// A specification has no owner: its domain is the one its ID starts with, so the move is its new ID alone.
export function moveSpecification(tx: Transaction, input: MoveSpecification): void {
  const specifications = new SpecificationRepository(tx);
  specifications.load(input.id) ?? tx.refuse('missing', `there is no specification ${input.id}`);
  const domain = tx.rows('domain').map((d) => String(d.id)).filter((d) => input.id.startsWith(`${d}-`)).sort((a, b) => b.length - a.length)[0];
  if (domain === undefined) tx.refuse('parent', `${input.id} names no domain of its product`);
  specifications.carryRenames(toDomain(tx, { id: input.id, label: 'specification', domainId: domain }, input.domain_id));
}
