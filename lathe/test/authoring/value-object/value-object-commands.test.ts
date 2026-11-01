// The Value object aggregate's commands, queries and refusals (LA-AUT-A9), run on a store as the CLI, the MCP tools and
// the HTTP API run them: each command changes one value object through ValueObjectRepository and is refused with its
// reason, changing nothing.
import { afterEach, describe, expect, it } from 'vitest';
import { ADD_CONSTRAINT_TEST } from '../../../src/authoring/value-object/commands/add-constraint-test.ts';
import { REMOVE_CONSTRAINT } from '../../../src/authoring/value-object/commands/remove-constraint.ts';
import { REMOVE_CONSTRAINT_TEST } from '../../../src/authoring/value-object/commands/remove-constraint-test.ts';
import { REMOVE_VALUE_OBJECT } from '../../../src/authoring/value-object/commands/remove-value-object.ts';
import { REMOVE_VALUE_TYPE } from '../../../src/authoring/value-object/commands/remove-value-type.ts';
import type { AnyCommand } from '../../../src/platform/commands/definition.ts';
import { runCommand } from '../../../src/platform/commands/run.ts';
import { StoreError } from '../../../src/platform/data/problems.ts';
import type { Store } from '../../../src/platform/data/store.ts';
import { closeOpenStores, domainModelBase, storeOn } from '../domain-model-base.ts';
import { valueObjectDataSet } from './data-set.ts';

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

describe('LA-STD-CODE-R07-T51 a value object, or a record in one, is removed with what it holds, refused while anything outside references it', () => {
  it('removes a constraint with its test, a value type, then the value object whole', async () => {
    const store = await valueObjectDataSet();
    expect((await runCommand(store, REMOVE_CONSTRAINT_TEST, { id: 'TL-VO01-C01-T' })).changes.map((c) => c.table).sort()).toEqual(['constraint_test', 'starts_from']);
    await runCommand(store, ADD_CONSTRAINT_TEST, { id: 'TL-VO01-C01-T', title: 'One at sign', constraint_id: 'TL-VO01-C01', level: 'unit', state: 'not automated yet', accepts: 'a@b', refuses: 'a@b@c' });
    expect((await runCommand(store, REMOVE_CONSTRAINT, { id: 'TL-VO01-C01' })).changes.map((c) => c.table).sort()).toEqual(['constraint', 'constraint_test']);
    expect((await runCommand(store, REMOVE_VALUE_TYPE, { id: 'TL-VO01-VT' })).changes.map((c) => c.table).sort()).toEqual(['meets', 'value_type']);
    expect((await runCommand(store, REMOVE_VALUE_OBJECT, { id: 'TL-VO01' })).changes.map((c) => c.table).sort()).toEqual(['value_object', 'value_object_field']);
  });

  it('refuses to remove a value object a field types, naming it', async () => {
    const store = await storeOn(
      domainModelBase({
        value_object: [{ id: 'TL-VO01', title: 'Email address', description: 'How the library reaches a member.' }],
        aggregate: [{ id: 'TL-LEND-A2', title: 'Member', domain_id: 'TL-LEND', identity: 'Member ID', description: 'Someone who borrows tools.' }],
        entity: [{ id: 'TL-LEND-EN03', title: 'Member', aggregate_id: 'TL-LEND-A2', role: 'root', description: 'The member.' }],
        entity_field: [{ entity_id: 'TL-LEND-EN03', position: 1, name: 'Email', meaning: 'How to reach them.', type_value_object_id: 'TL-VO01', required: true }],
      }),
    );
    expect((await refusal(store, REMOVE_VALUE_OBJECT, { id: 'TL-VO01' })).problems[0].message).toMatch(/^Value object TL-VO01 is referenced, so it stays: .*TL-LEND-EN03/);
  });
});
