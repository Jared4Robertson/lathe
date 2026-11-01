import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { AdapterRow } from '../../../platform/data/tables.ts';
import { IntegrationRepository } from '../repository.ts';
import { refuseBroken } from '../../../platform/data/rules.ts';
import { oneAdapter } from '../rules.ts';
import { ADD_ADAPTER_IDENTITY } from './identities.generated.ts';

export type AddAdapter = Pick<AdapterRow, 'id' | 'title' | 'integration_id' | 'description' | 'file'> & { meets?: string[]; packages?: string[] };

export const ADD_ADAPTER = {
  ...ADD_ADAPTER_IDENTITY,
  input: {
    id: column('adapter', 'id', 'required'),
    title: column('adapter', 'title', 'required'),
    integration_id: column('adapter', 'integration_id', 'required'),
    description: column('adapter', 'description', 'required'),
    file: column('adapter', 'file', 'optional'),
    meets: ids('The standard rules it follows.', 'optional'),
    packages: texts("The packages it uses, each listed in one of the product's package.json files.", 'optional'),
  },
  handler: addAdapter,
} satisfies CommandDefinition<AddAdapter>;

export function addAdapter(tx: Transaction, input: AddAdapter): void {
  const integrations = new IntegrationRepository(tx);
  const integration = integrations.loadHolding('integration', input.integration_id) ?? tx.refuse('missing', `there is no integration ${input.integration_id}`);
  const { meets = [], packages = [], ...row } = input;
  refuseBroken(oneAdapter([...(integration.adapter ? [integration.adapter.row] : []), row]));
  integration.adapter = { row, meets, packages };
  integrations.save(integration);
}
