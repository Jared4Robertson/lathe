import { id, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { ProvisionRepository } from '../repository.ts';
import { REMOVE_PROVIDER_IDENTITY } from './identities.generated.ts';

/** The record whose provider goes. */
export type RemoveProvider = { record_id: string };

export const REMOVE_PROVIDER = {
  ...REMOVE_PROVIDER_IDENTITY,
  input: {
    record_id: id('The record no longer provided from outside the product.', 'required'),
  },
  handler: removeProvider,
} satisfies CommandDefinition<RemoveProvider>;

/** Removes the record's provision whole. */
export function removeProvider(tx: Transaction, input: RemoveProvider): void {
  const provisions = new ProvisionRepository(tx);
  const provision = provisions.load(input.record_id) ?? tx.refuse('missing', `nothing provides ${input.record_id}`);
  provisions.remove(provision);
}
