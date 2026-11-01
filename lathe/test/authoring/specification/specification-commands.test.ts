// The Specification aggregate's commands, queries and refusals (LA-AUT-A5), run on a store as the CLI, the MCP tools
// and the HTTP API run them: each command changes one specification through SpecificationRepository and is refused
// with its reason, changing nothing.
import { afterEach, describe, expect, it } from 'vitest';
import { ADD_PREDICATE } from '../../../src/authoring/specification/commands/add-predicate.ts';
import { REMOVE_PREDICATE } from '../../../src/authoring/specification/commands/remove-predicate.ts';
import { REMOVE_SPECIFICATION } from '../../../src/authoring/specification/commands/remove-specification.ts';
import { REMOVE_SPECIFICATION_TEST } from '../../../src/authoring/specification/commands/remove-specification-test.ts';
import type { AnyCommand } from '../../../src/platform/commands/definition.ts';
import { runCommand } from '../../../src/platform/commands/run.ts';
import { StoreError } from '../../../src/platform/data/problems.ts';
import type { Store } from '../../../src/platform/data/store.ts';
import { closeOpenStores, domainModelBase, storeOn } from '../domain-model-base.ts';
import { AROUND, specificationDataSet } from './data-set.ts';

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

describe('LA-STD-CODE-R07-T50 a specification, or a record in one, is removed with what it holds, refused while anything outside references it', () => {
  it('removes a predicate and a test with the links they start, then the specification whole', async () => {
    const store = await specificationDataSet();
    expect((await runCommand(store, REMOVE_PREDICATE, { id: 'TL-LEND-SP02-PR' })).changes.map((c) => c.table).sort()).toEqual(['meets', 'package_use', 'predicate']);
    expect((await runCommand(store, REMOVE_SPECIFICATION_TEST, { id: 'TL-LEND-SP02-T' })).changes.map((c) => c.table).sort()).toEqual(['specification_test', 'starts_from']);
    await runCommand(store, ADD_PREDICATE, { id: 'TL-LEND-SP02-PR', title: 'isAtLoanLimit', specification_id: 'TL-LEND-SP02' });
    expect((await runCommand(store, REMOVE_SPECIFICATION, { id: 'TL-LEND-SP02' })).changes.map((c) => c.table).sort()).toEqual(['predicate', 'reads', 'specification']);
  });

  it('refuses to remove a specification a query selects by, naming it', async () => {
    const data = domainModelBase({
      ...AROUND,
      read_model: [{ id: 'TL-LEND-RM01', title: 'Catalog', domain_id: 'TL-LEND', description: 'Every tool.' }],
      query: [{ id: 'TL-LEND-QRY01', title: 'List free tools', read_model_id: 'TL-LEND-RM01', description: 'The free tools.' }],
      selects_by: [{ source_id: 'TL-LEND-QRY01', target_id: 'TL-LEND-SP01' }],
    });
    const store = await storeOn(data);
    expect((await refusal(store, REMOVE_SPECIFICATION, { id: 'TL-LEND-SP01' })).problems[0].message).toBe('Specification TL-LEND-SP01 is referenced, so it stays: TL-LEND-QRY01 selects by TL-LEND-SP01');
  });
});
