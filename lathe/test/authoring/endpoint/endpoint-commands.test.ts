// The Endpoint aggregate's commands, queries and refusals (LA-AUT-A13), run on a store as the CLI, the MCP tools and
// the HTTP API run them: each command changes one endpoint through EndpointRepository and is refused with its reason,
// changing nothing.
import { afterEach, describe, expect, it } from 'vitest';
import { REMOVE_API_REQUIREMENT } from '../../../src/authoring/endpoint/commands/remove-api-requirement.ts';
import { REMOVE_ENDPOINT } from '../../../src/authoring/endpoint/commands/remove-endpoint.ts';
import { REMOVE_ENDPOINT_HANDLER } from '../../../src/authoring/endpoint/commands/remove-endpoint-handler.ts';
import { REMOVE_ENDPOINT_TEST } from '../../../src/authoring/endpoint/commands/remove-endpoint-test.ts';
import { ADD_QUESTION } from '../../../src/authoring/product/commands/add-question.ts';
import { CHANGE_QUESTION } from '../../../src/authoring/product/commands/change-question.ts';
import { type AnyCommand } from '../../../src/platform/commands/definition.ts';
import { runCommand } from '../../../src/platform/commands/run.ts';
import { StoreError } from '../../../src/platform/data/problems.ts';
import type { Store } from '../../../src/platform/data/store.ts';
import { closeOpenStores } from '../domain-model-base.ts';
import { endpointDataSet } from './data-set.ts';

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

describe('LA-STD-CODE-R07-T57 an endpoint, or a record in one, is removed with what it holds, refused while anything outside references it', () => {
  it('removes a test, a handler with its links, a requirement with its tests, and an endpoint whole', async () => {
    const store = await endpointDataSet();
    expect((await runCommand(store, REMOVE_ENDPOINT_TEST, { id: 'TL-LEND-EP01-R01-T01' })).changes.map((c) => c.table).sort()).toEqual(['endpoint_test', 'starts_from']);
    expect((await runCommand(store, REMOVE_ENDPOINT_HANDLER, { id: 'TL-LEND-EP01-H' })).changes.map((c) => c.table).sort()).toEqual(['endpoint_handler', 'meets']);
    expect((await runCommand(store, REMOVE_API_REQUIREMENT, { id: 'TL-LEND-EP01-R01' })).changes.map((c) => c.table)).toEqual(['api_requirement']);
    expect((await runCommand(store, REMOVE_ENDPOINT, { id: 'TL-LEND-EP01' })).changes.map((c) => c.table)).toEqual(['endpoint']);
  });

  it('removes an endpoint whole with everything in it, and refuses one an open question is about, naming the link', async () => {
    const store = await endpointDataSet({ role: [{ product_id: 'TL', name: 'Librarian', description: 'Runs the library.' }] });
    await runCommand(store, ADD_QUESTION, { id: 'TL-LEND-Q01', title: 'Should a loan take a due date', domain_id: 'TL-LEND', owner: 'Librarian', description: 'Undecided.', about: ['TL-LEND-EP01-R01'] });
    expect((await refusal(store, REMOVE_ENDPOINT, { id: 'TL-LEND-EP01' })).problems[0].message).toBe('Endpoint TL-LEND-EP01 is referenced, so it stays: TL-LEND-Q01 about TL-LEND-EP01-R01');
    await runCommand(store, CHANGE_QUESTION, { id: 'TL-LEND-Q01', about: [] });
    const removed = await runCommand(store, REMOVE_ENDPOINT, { id: 'TL-LEND-EP01' });
    expect(new Set(removed.changes.map((c) => c.table))).toEqual(new Set(['endpoint', 'api_requirement', 'endpoint_test', 'starts_from', 'endpoint_handler', 'meets']));
  });
});
