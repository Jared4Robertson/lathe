import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { AdapterRow } from '../../../platform/data/tables.ts';
import { changed } from '../model.ts';
import { IntegrationRepository } from '../repository.ts';
import { CHANGE_ADAPTER_IDENTITY } from './identities.generated.ts';

/** The adapter's changes: a column given is set, null clears an optional one; a list given replaces its list. */
export type ChangeAdapter = Pick<AdapterRow, 'id'> & { title?: AdapterRow['title']; description?: AdapterRow['description']; file?: AdapterRow['file'] | null; meets?: string[]; packages?: string[] };

export const CHANGE_ADAPTER: CommandDefinition<ChangeAdapter> = {
  ...CHANGE_ADAPTER_IDENTITY,
  input: {
    id: column('adapter', 'id', 'required'),
    title: column('adapter', 'title', 'optional'),
    description: column('adapter', 'description', 'optional'),
    file: column('adapter', 'file', 'clearable'),
    meets: ids('The standard rules it follows. Replaces the list.', 'optional'),
    packages: texts('The packages it uses. Replaces the list.', 'optional'),
  },
  handler: changeAdapter,
};

/** Changes the adapter's columns and links. */
export function changeAdapter(tx: Transaction, input: ChangeAdapter): void {
  const integrations = new IntegrationRepository(tx);
  const integration = integrations.loadHolding('adapter', input.id) ?? tx.refuse('missing', `there is no adapter ${input.id}`);
  const current = integration.adapter!;
  integration.adapter = { row: changed(current.row, input, ['title', 'description', 'file']), meets: input.meets ?? current.meets, packages: input.packages ?? current.packages };
  integrations.save(integration);
}
