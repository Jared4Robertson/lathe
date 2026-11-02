import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { InterfaceRow } from '../../../platform/data/tables.ts';
import { ADD_INTERFACE_IDENTITY } from './identities.generated.ts';
import { addInterface } from './handlers.generated.ts';

/** A new interface. */
export type AddInterface = Pick<InterfaceRow, 'id' | 'title' | 'product_id' | 'kind' | 'description' | 'public'> & { actors?: string[]; offers?: string[] };

export const ADD_INTERFACE = {
  ...ADD_INTERFACE_IDENTITY,
  input: {
    id: column('interface', 'id', 'required'),
    title: column('interface', 'title', 'required'),
    product_id: column('interface', 'product_id', 'required'),
    kind: column('interface', 'kind', 'required'),
    description: column('interface', 'description', 'required'),
    public: column('interface', 'public', 'required'),
    actors: texts('The roles of the product that use it, in order.', 'optional'),
    offers: ids('The use cases of the product it offers.', 'optional'),
  },
  handler: addInterface,
} satisfies CommandDefinition<AddInterface>;
