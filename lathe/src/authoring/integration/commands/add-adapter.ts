// Add an adapter (LA-AUT-CMD338): Adds an integration's adapter, its one piece of code that talks to the outside system: its name in code and its file, with the standard rules it meets and the packages it uses.
import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { AdapterRow } from '../../../platform/data/tables.ts';
import { INTEGRATION_SLICE } from '../model.ts';
import { IntegrationRepository } from '../repository.ts';

/** A new adapter, with the links it starts. */
export type AddAdapter = Pick<AdapterRow, 'id' | 'title' | 'integration_id' | 'description' | 'file'> & { meets?: string[]; packages?: string[] };

/** Add an adapter (LA-AUT-CMD338). */
export const ADD_ADAPTER: CommandDefinition<AddAdapter> = {
  id: 'LA-AUT-CMD338',
  slice: INTEGRATION_SLICE,
  name: 'add-adapter',
  description: "Adds an integration's adapter, its one piece of code that talks to the outside system: its name in code and its file, with the standard rules it meets and the packages it uses.",
  method: 'POST',
  route: '/api/integration/add-adapter',
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
};

/** Adds the adapter under its integration, with its links. */
export function addAdapter(tx: Transaction, input: AddAdapter): void {
  const integrations = new IntegrationRepository(tx);
  const integration = integrations.loadHolding('integration', input.integration_id) ?? tx.refuse('missing', `there is no integration ${input.integration_id}`);
  if (integration.adapter) tx.refuse('exists', `${input.integration_id} already has its adapter, ${integration.adapter.row.id}`);
  const { meets = [], packages = [], ...row } = input;
  integration.adapter = { row, meets, packages };
  integrations.save(integration);
}
