import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { ServiceRow } from '../../../platform/data/tables.ts';
import { ADD_SERVICE_IDENTITY } from './identities.generated.ts';
import { addService } from './handlers.generated.ts';

export type AddService = Pick<ServiceRow, 'id' | 'title' | 'domain_service_id' | 'file'> & { meets?: string[]; packages?: string[]; helpers?: string[] };

export const ADD_SERVICE = {
  ...ADD_SERVICE_IDENTITY,
  input: {
    id: column('service', 'id', 'required'),
    title: column('service', 'title', 'required'),
    domain_service_id: column('service', 'domain_service_id', 'required'),
    file: column('service', 'file', 'optional'),
    meets: ids('The standard rules it meets.', 'optional'),
    packages: texts("The packages it uses, by their names in the product's package.json files.", 'optional'),
    helpers: texts('The helper files its code is split across beside its file, such as helpers and build-tag variants, each from the product root; no other record names one.', 'optional'),
  },
  handler: addService,
} satisfies CommandDefinition<AddService>;
