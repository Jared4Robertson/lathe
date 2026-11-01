// The Integration aggregate's commands, queries and refusals (LA-AUT-A14), run on a store as the CLI, the MCP tools and
// the HTTP API run them: each command changes one integration through IntegrationRepository and is refused with its
// reason, changing nothing.
import { afterEach, describe, expect, it } from 'vitest';
import { REMOVE_ADAPTER } from '../../../src/authoring/integration/commands/remove-adapter.ts';
import { REMOVE_INTEGRATION } from '../../../src/authoring/integration/commands/remove-integration.ts';
import { REMOVE_INTEGRATION_TEST } from '../../../src/authoring/integration/commands/remove-integration-test.ts';
import { ADD_QUESTION } from '../../../src/authoring/product/commands/add-question.ts';
import { type AnyCommand } from '../../../src/platform/commands/definition.ts';
import { runCommand } from '../../../src/platform/commands/run.ts';
import { StoreError } from '../../../src/platform/data/problems.ts';
import type { Store } from '../../../src/platform/data/store.ts';
import { closeOpenStores } from '../domain-model-base.ts';
import { integrationDataSet } from './data-set.ts';

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

describe('LA-STD-CODE-R07-T58 an integration, or a record in one, is removed with what it holds, refused while anything outside references it', () => {
  it('removes a test, an adapter with its links and packages, and an integration whole', async () => {
    const store = await integrationDataSet();
    expect((await runCommand(store, REMOVE_INTEGRATION_TEST, { id: 'TL-INT01-T01' })).changes.map((c) => c.table).sort()).toEqual(['integration_test', 'starts_from']);
    expect((await runCommand(store, REMOVE_ADAPTER, { id: 'TL-INT01-AD' })).changes.map((c) => c.table).sort()).toEqual(['adapter', 'meets', 'package_use']);
    const removed = await integrationDataSet();
    expect(new Set((await runCommand(removed, REMOVE_INTEGRATION, { id: 'TL-INT01' })).changes.map((c) => c.table))).toEqual(new Set(['integration', 'adapter', 'meets', 'package_use', 'integration_test', 'starts_from']));
  });

  it('refuses an integration an open question is about, naming the link', async () => {
    const store = await integrationDataSet({ role: [{ product_id: 'TL', name: 'Librarian', description: 'Runs the library.' }] });
    await runCommand(store, ADD_QUESTION, { id: 'TL-Q02', title: 'Which payments service', product_id: 'TL', owner: 'Librarian', description: 'Undecided.', about: ['TL-INT02'] });
    expect((await refusal(store, REMOVE_INTEGRATION, { id: 'TL-INT02' })).problems[0].message).toBe('Integration TL-INT02 is referenced, so it stays: TL-Q02 about TL-INT02');
  });
});
