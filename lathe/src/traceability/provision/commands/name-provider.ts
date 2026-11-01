import { id, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { ProvisionRepository } from '../repository.ts';
import { NAME_PROVIDER_IDENTITY } from './identities.generated.ts';

/** The record and what provides it. */
export type NameProvider = { record_id: string; provider_id: string };

export const NAME_PROVIDER = {
  ...NAME_PROVIDER_IDENTITY,
  input: {
    record_id: id('The data store, technical record or obligation provided from outside the product.', 'required'),
    provider_id: id('What provides it: an integration, or a record of a product kind the product lets provide it.', 'required'),
  },
  handler: nameProvider,
} satisfies CommandDefinition<NameProvider>;

/** Names the record's provider, in place of any it had: a record has one. */
export function nameProvider(tx: Transaction, input: NameProvider): void {
  const provisions = new ProvisionRepository(tx);
  const provision = provisions.load(input.record_id) ?? provisions.create({ root: input.record_id, provider: input.provider_id });
  provision.provider = input.provider_id;
  provisions.save(provision);
}
