// The View aggregate's commands, queries and refusals (LA-AUT-A12), run on a store as the CLI, the MCP tools and the
// HTTP API run them: each command changes one view through ViewRepository and is refused with its reason, changing
// nothing.
import { afterEach, describe, expect, it } from 'vitest';
import { ADD_VIEW_REQUIREMENT } from '../../../src/authoring/view/commands/add-view-requirement.ts';
import { CHANGE_VIEW_REQUIREMENT } from '../../../src/authoring/view/commands/change-view-requirement.ts';
import { REMOVE_VIEW } from '../../../src/authoring/view/commands/remove-view.ts';
import { REMOVE_VIEW_REQUIREMENT } from '../../../src/authoring/view/commands/remove-view-requirement.ts';
import { REMOVE_VIEW_TEST } from '../../../src/authoring/view/commands/remove-view-test.ts';
import { type AnyCommand } from '../../../src/platform/commands/definition.ts';
import { runCommand } from '../../../src/platform/commands/run.ts';
import { StoreError } from '../../../src/platform/data/problems.ts';
import type { Store } from '../../../src/platform/data/store.ts';
import { closeOpenStores } from '../domain-model-base.ts';
import { viewDataSet } from './data-set.ts';

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

describe('LA-STD-CODE-R07-T56 a view, or a record in one, is removed with what it holds, refused while anything outside references it', () => {
  it('removes a test alone, a requirement with its tests, and a view whole', async () => {
    const store = await viewDataSet();
    expect((await runCommand(store, REMOVE_VIEW_TEST, { id: 'TL-V01-R01-T01' })).changes.map((c) => c.table).sort()).toEqual(['starts_from', 'view_test']);
    await runCommand(store, CHANGE_VIEW_REQUIREMENT, { id: 'TL-V01-R01', title: 'Due dates show' });
    expect((await runCommand(store, REMOVE_VIEW_REQUIREMENT, { id: 'TL-V01-R01' })).changes.map((c) => c.table)).toEqual(['view_requirement']);
    await runCommand(store, ADD_VIEW_REQUIREMENT, { id: 'TL-V02-R01', title: 'Overdue loans first', view_id: 'TL-V02', statement: 'Overdue loans MUST come first.' });
    const removed = await runCommand(store, REMOVE_VIEW, { id: 'TL-V02' });
    expect(removed.changes.map((c) => c.table).sort()).toEqual(['view', 'view_requirement']);
  });

  it('refuses a view a UI component renders, naming the link', async () => {
    const store = await viewDataSet();
    expect((await refusal(store, REMOVE_VIEW, { id: 'TL-V01' })).problems[0].message).toBe('View TL-V01 is referenced, so it stays: TL-UI01 renders TL-V01');
  });
});
