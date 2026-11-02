import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { DomainRow } from '../../../platform/data/tables.ts';
import { ADD_DOMAIN_IDENTITY } from './identities.generated.ts';
import { addDomain } from './handlers.generated.ts';

/** A new domain: its row. */
export type AddDomain = Pick<DomainRow, 'id' | 'title' | 'product_id' | 'position' | 'subdomain_type' | 'description' | 'notes'>;

export const ADD_DOMAIN = {
  ...ADD_DOMAIN_IDENTITY,
  input: {
    id: column('domain', 'id', 'required'),
    title: column('domain', 'title', 'required'),
    product_id: column('domain', 'product_id', 'required'),
    position: column('domain', 'position', 'required'),
    subdomain_type: column('domain', 'subdomain_type', 'required'),
    description: column('domain', 'description', 'required'),
    notes: column('domain', 'notes', 'optional'),
  },
  handler: addDomain,
} satisfies CommandDefinition<AddDomain>;
