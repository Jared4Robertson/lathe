// The Domain event aggregate's commands, queries and refusals (LA-AUT-A7), run on a store as the CLI, the MCP tools
// and the HTTP API run them: each command changes one event through DomainEventRepository and is refused with its
// reason, changing nothing.
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { CHANGE_COMMAND } from '../../../src/authoring/command/commands/change-command.ts';
import { ADD_EVENT_TYPE } from '../../../src/authoring/domain-event/commands/add-event-type.ts';
import { CHANGE_DOMAIN_EVENT } from '../../../src/authoring/domain-event/commands/change-domain-event.ts';
import { CHANGE_EVENT_TYPE } from '../../../src/authoring/domain-event/commands/change-event-type.ts';
import { REMOVE_DOMAIN_EVENT } from '../../../src/authoring/domain-event/commands/remove-domain-event.ts';
import { REMOVE_EVENT_TYPE } from '../../../src/authoring/domain-event/commands/remove-event-type.ts';
import { GET_DOMAIN_EVENT, LIST_DOMAIN_EVENTS, NEXT_DOMAIN_EVENT_ID } from '../../../src/authoring/domain-event/queries.ts';
import { runAggregateCommand } from '../../../src/cli/aggregates.ts';
import { callTool } from '../../../src/cli/mcp.ts';
import { closeStores, handleApi } from '../../../src/server/api.ts';
import { InputError, type AnyCommand } from '../../../src/platform/commands/definition.ts';
import { runCommand, runQuery } from '../../../src/platform/commands/run.ts';
import { StoreError } from '../../../src/platform/data/problems.ts';
import type { Store } from '../../../src/platform/data/store.ts';
import { writeData } from '../../helpers.ts';
import { closeOpenStores, domainModelBase } from '../domain-model-base.ts';
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

type Whole = ReturnType<typeof GET_DOMAIN_EVENT.run>;

describe('LA-AUT-UC25-R50-T01 each Domain event command (LA-AUT-A7) changes one event through DomainEventRepository, and is reached by name from the CLI, the MCP tools and HTTP', () => {
  it('builds the data set with its own Add commands, and reads an event whole by its ID or its event type\'s', async () => {
    const store = await domainEventDataSet();
    const whole = runQuery(store, GET_DOMAIN_EVENT, { id: 'TL-LEND-EV01-ET' }) as Whole;
    expect(whole.record).toEqual({ id: 'TL-LEND-EV01-ET', kind: 'event_type' });
    expect(whole.event.id).toBe('TL-LEND-EV01');
    expect(whole.fields.map((f) => [f.position, f.name])).toEqual([
      [1, 'Loan ID'],
      [2, 'Due'],
    ]);
    expect(whole.eventType).toEqual({ eventType: { id: 'TL-LEND-EV01-ET', title: 'LoanOpened', domain_event_id: 'TL-LEND-EV01', delivery: 'outbox', file: 'src/lending/events.ts' }, meets: ['TL-STD-CODE-R01'], packages: [] });
    expect(runQuery(store, LIST_DOMAIN_EVENTS, { aggregate_id: 'TL-LEND-A1' })).toEqual([
      { id: 'TL-LEND-EV01', title: 'Loan opened' },
      { id: 'TL-LEND-EV02', title: 'Loan closed' },
    ]);
    expect(runQuery(store, NEXT_DOMAIN_EVENT_ID, { kind: 'domain_event', parent: 'TL-LEND-A1' })).toBe('TL-LEND-EV03');
    expect(runQuery(store, NEXT_DOMAIN_EVENT_ID, { kind: 'event_type', parent: 'TL-LEND-EV02' })).toBe('TL-LEND-EV02-ET');
    expect(() => runQuery(store, NEXT_DOMAIN_EVENT_ID, { kind: 'event_type', parent: 'TL-LEND-EV01' })).toThrow(/already has its event type/);
  });

  it('changes an event and its event type, writing only its own tables', async () => {
    const store = await domainEventDataSet();
    expect((await runCommand(store, CHANGE_DOMAIN_EVENT, { id: 'TL-LEND-EV02', published: true, fields: [{ name: 'Loan ID', meaning: 'Which loan.', type: 'text', required: true }] })).tables).toEqual(['domain_event', 'event_field']);
    expect((await runCommand(store, CHANGE_EVENT_TYPE, { id: 'TL-LEND-EV01-ET', delivery: null, packages: ['zod'] })).tables).toEqual(['event_type', 'package_use']);
    expect(store.record('TL-LEND-EV01-ET')?.row).not.toHaveProperty('delivery');
  });

  it('refuses a second event type, an input that is not the command\'s, and an event that is not there', async () => {
    const store = await domainEventDataSet();
    const second = await refusal(store, ADD_EVENT_TYPE, { id: 'TL-LEND-EV01-ET2', title: 'LoanOpenedAgain', domain_event_id: 'TL-LEND-EV01' });
    expect(second.problems[0]).toMatchObject({ rule: 'one-event-type', message: 'domain event TL-LEND-EV01 already has its event type, so TL-LEND-EV01-ET2 cannot be a second: an event has one' });
    await expect(runCommand(store, CHANGE_DOMAIN_EVENT, { id: 'TL-LEND-EV01', aggregate_id: 'TL-LEND-A1' })).rejects.toThrow(/change-domain-event takes no aggregate_id/);
    await expect(runCommand(store, CHANGE_DOMAIN_EVENT, { id: 'TL-LEND-EV01', published: 'yes' })).rejects.toThrow(InputError);
    expect((await refusal(store, CHANGE_DOMAIN_EVENT, { id: 'TL-LEND-EV09', title: 'x' })).problems[0]).toMatchObject({ rule: 'missing', message: 'there is no domain event TL-LEND-EV09' });
  });

  it('runs `lathe domain-event <command>`, the domain_event_ tools and POST /api/domain-event/<command>', async () => {
    const root = writeData(domainModelBase({ aggregate: [{ id: 'TL-LEND-A1', title: 'Loan', domain_id: 'TL-LEND', identity: 'Loan ID', description: 'A loan.' }] }));
    const out: string[] = [];
    const io = { out: (t: string) => out.push(t), err: (t: string) => out.push(t) };
    expect(await runAggregateCommand(['domain-event', 'add-domain-event', '--id', 'TL-LEND-EV01', '--title', 'Loan opened', '--aggregate_id', 'TL-LEND-A1', '--published', 'false', '--description', 'A tool went out.', '--root', root], io)).toBe(0);
    expect(out.pop()).toContain('Added domain_event TL-LEND-EV01');
    expect((await callTool(root, 'domain_event_add_event_type', { id: 'TL-LEND-EV01-ET', title: 'LoanOpened', domain_event_id: 'TL-LEND-EV01' })).isError).toBeUndefined();
    const server = createServer((req, res) => void handleApi(root, req, res, new URL(req.url ?? '/', 'http://localhost').pathname));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const post = (route: string, body: unknown) => fetch(`${base}${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    try {
      expect((await post('/api/domain-event/change-domain-event', { id: 'TL-LEND-EV01', published: true })).status).toBe(200);
      expect((await post('/api/domain-event/remove-domain-event', { id: 'TL-LEND-EV09' })).status).toBe(422);
    } finally {
      await closeStores(root);
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

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
