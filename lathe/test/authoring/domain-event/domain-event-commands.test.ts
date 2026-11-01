// The Domain event aggregate's commands, queries and refusals (LA-AUT-A7), run on a store as the CLI, the MCP tools
// and the HTTP API run them: each command changes one event through DomainEventRepository and is refused with its
// reason, changing nothing.
import { afterEach, describe, expect, it } from 'vitest';
import { CHANGE_COMMAND } from '../../../src/authoring/command/commands/change-command.ts';
import { ADD_EVENT_TYPE } from '../../../src/authoring/domain-event/commands/add-event-type.ts';
import { REMOVE_DOMAIN_EVENT } from '../../../src/authoring/domain-event/commands/remove-domain-event.ts';
import { REMOVE_EVENT_TYPE } from '../../../src/authoring/domain-event/commands/remove-event-type.ts';
import { type AnyCommand } from '../../../src/platform/commands/definition.ts';
import { runCommand } from '../../../src/platform/commands/run.ts';
import { StoreError } from '../../../src/platform/data/problems.ts';
import type { Store } from '../../../src/platform/data/store.ts';
import { closeOpenStores } from '../domain-model-base.ts';
import { domainEventDataSet } from './data-set.ts';

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

describe('LA-STD-CODE-R07-T31 a domain event, or its event type, is removed with what it holds, refused while anything outside references it', () => {
  it('removes an event type with its links, and an event whole with its fields and event type', async () => {
    const store = await domainEventDataSet();
    expect((await runCommand(store, REMOVE_EVENT_TYPE, { id: 'TL-LEND-EV01-ET' })).changes.map((c) => c.table).sort()).toEqual(['event_type', 'meets']);
    await runCommand(store, ADD_EVENT_TYPE, { id: 'TL-LEND-EV01-ET', title: 'LoanOpened', domain_event_id: 'TL-LEND-EV01' });
    const removed = await runCommand(store, REMOVE_DOMAIN_EVENT, { id: 'TL-LEND-EV01' });
    expect(removed.changes.map((c) => c.table).sort()).toEqual(['domain_event', 'event_field', 'event_field', 'event_type']);
  });

  it('refuses removing an event a command raises, naming the command', async () => {
    const store = await domainEventDataSet({
      entity: [{ id: 'TL-LEND-EN01', title: 'Loan', aggregate_id: 'TL-LEND-A1', role: 'root', description: 'The loan itself.' }],
      command: [{ id: 'TL-LEND-CMD01', title: 'Close a loan', entity_id: 'TL-LEND-EN01', description: 'Takes a tool back.' }],
    });
    await runCommand(store, CHANGE_COMMAND, { id: 'TL-LEND-CMD01', raises: ['TL-LEND-EV02'] });
    expect((await refusal(store, REMOVE_DOMAIN_EVENT, { id: 'TL-LEND-EV02' })).problems[0]).toMatchObject({ rule: 'referenced', message: 'Domain event TL-LEND-EV02 is referenced, so it stays: TL-LEND-CMD01 raises TL-LEND-EV02' });
  });
});
