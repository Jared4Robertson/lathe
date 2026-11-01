// The UI component aggregate's commands, queries and refusals (LA-AUT-A15), run on a store as the CLI, the MCP tools
// and the HTTP API run them: each command changes one UI component through UiComponentRepository and is refused with
// its reason, changing nothing.
import { afterEach, describe, expect, it } from 'vitest';
import { REMOVE_UI_COMPONENT } from '../../../src/authoring/ui-component/commands/remove-ui-component.ts';
import { ADD_QUESTION } from '../../../src/authoring/product/commands/add-question.ts';
import { type AnyCommand } from '../../../src/platform/commands/definition.ts';
import { runCommand } from '../../../src/platform/commands/run.ts';
import { StoreError } from '../../../src/platform/data/problems.ts';
import type { Store } from '../../../src/platform/data/store.ts';
import { closeOpenStores } from '../domain-model-base.ts';
import { uiComponentDataSet } from './data-set.ts';

afterEach(closeOpenStores);

/** The refusal a command gets, or a failure when it is not refused. */
async function refusal(store: Store, definition: AnyCommand, input: unknown): Promise<StoreError> {
  try {
    await runCommand(store, definition, input);
  } catch (error) {
    if (error instanceof StoreError) return error;
    throw error;
  }
  throw new Error(`${definition.name} was not refused`);
}

describe('LA-STD-CODE-R07-T59 a UI component is removed whole with the links it starts, refused while anything outside references it', () => {
  it('removes a UI component with its renders, meets and package rows', async () => {
    const store = await uiComponentDataSet();
    expect((await runCommand(store, REMOVE_UI_COMPONENT, { id: 'TL-UI01' })).changes.map((c) => c.table).sort()).toEqual(['meets', 'package_use', 'renders', 'ui_component']);
  });

  it('refuses a UI component an open question is about, naming the link', async () => {
    const store = await uiComponentDataSet({ role: [{ product_id: 'TL', name: 'Librarian', description: 'Runs the library.' }] });
    await runCommand(store, ADD_QUESTION, { id: 'TL-Q01', title: 'Split the catalog page', product_id: 'TL', owner: 'Librarian', description: 'Undecided.', about: ['TL-UI01'] });
    expect((await refusal(store, REMOVE_UI_COMPONENT, { id: 'TL-UI01' })).problems[0].message).toBe('UI component TL-UI01 is referenced, so it stays: TL-Q01 about TL-UI01');
  });
});
