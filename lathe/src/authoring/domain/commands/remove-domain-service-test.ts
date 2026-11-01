import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_DOMAIN_SERVICE_TEST_IDENTITY } from './identities.generated.ts';
import { removeDomainServiceTest } from './handlers.generated.ts';

/** The test to remove. */
export type RemoveDomainServiceTest = { id: string };

export const REMOVE_DOMAIN_SERVICE_TEST = {
  ...REMOVE_DOMAIN_SERVICE_TEST_IDENTITY,
  input: {
    id: column('domain_service_test', 'id', 'required'),
  },
  handler: removeDomainServiceTest,
} satisfies CommandDefinition<RemoveDomainServiceTest>;
