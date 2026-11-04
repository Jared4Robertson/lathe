// Journey tests: each journey's main path end to end, from its trigger to its result, across the use cases and the
// handoffs it carries out, asked of the HTTP API as the librarian and the members would ask it. Each step's own
// behavior is proved by its use case's and policy's tests; these prove the steps hand on to each other.
// Each test name starts with its test record ID (examples/tool-library/data/journey_test.jsonl).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LAST_MINUTE_OF_DUE_DATE, START_DUE_DATE, startApi, type Api } from './helpers.ts';

let api: Api;
beforeEach(async () => {
  api = await startApi();
});
afterEach(async () => {
  await api.close();
});

async function register(name: string): Promise<number> {
  const res = await api.call('POST', '/members', { name, email: `${name.toLowerCase()}@example.org` });
  expect(res.status).toBe(201);
  expect(Number.isInteger(res.body.id)).toBe(true);
  return res.body.id;
}

async function addTool(name: string): Promise<number> {
  const res = await api.call('POST', '/tools', { name });
  expect(res.status).toBe(201);
  return res.body.id;
}

async function entryOf(toolId: number): Promise<{ id: number; status: string; condition: string; damageNote: string | null }> {
  const res = await api.call('GET', '/tools');
  expect(res.status).toBe(200);
  return res.body.find((t: { id: number }) => t.id === toolId);
}

describe('Journeys', () => {
  it('TL-JR01-T A tool returned needing repair is back in lending once marked repaired', async () => {
    const kim = await register('Kim');
    const drill = await addTool('Drill');
    const loan = await api.call('POST', '/loans', { memberId: kim, toolId: drill });
    expect(loan.status).toBe(201);

    // S01: the librarian takes the tool back needing repair, with a note.
    const returned = await api.call('POST', `/loans/${loan.body.id}/return`, { condition: 'needs_repair', note: 'Chuck wobbles' });
    expect(returned.status).toBe(200);

    // S02, the handoff: the library takes the tool out of lending, its return note its damage note; it cannot be borrowed.
    expect(await entryOf(drill)).toMatchObject({ status: 'needs_repair', condition: 'needs_repair', damageNote: 'Chuck wobbles' });
    const refused = await api.call('POST', '/loans', { memberId: kim, toolId: drill });
    expect(refused).toMatchObject({ status: 409, body: { error: 'tool_needs_repair' } });

    // S03: the librarian sees it among the tools waiting for repair.
    const waiting = await api.call('GET', '/tools/waiting-for-repair');
    expect(waiting.status).toBe(200);
    expect(waiting.body.map((t: { id: number }) => t.id)).toEqual([drill]);
    expect(JSON.stringify(waiting.body[0])).toContain('Chuck wobbles');

    // S04: once fixed, the librarian puts it back in lending.
    const repaired = await api.call('POST', `/tools/${drill}/repair`);
    expect(repaired.status).toBe(200);
    expect((await api.call('GET', '/tools/waiting-for-repair')).body).toEqual([]);

    // The result: good condition, no damage note, and the member can borrow it again.
    expect(await entryOf(drill)).toMatchObject({ status: 'available', condition: 'good', damageNote: null });
    const again = await api.call('POST', '/loans', { memberId: kim, toolId: drill });
    expect(again.status).toBe(201);
    expect(again.body).toMatchObject({ memberId: kim, toolId: drill });
  });

  it('TL-JR02-T A member borrows a tool and returns it on time, and the next member can borrow it', async () => {
    const first = await register('Ana');
    const next = await register('Ben');
    const saw = await addTool('Saw');

    // S01: the first member borrows the tool and is told its due date.
    const loan = await api.call('POST', '/loans', { memberId: first, toolId: saw });
    expect(loan.status).toBe(201);
    expect(loan.body.dueDate).toBe(START_DUE_DATE);
    expect(await entryOf(saw)).toMatchObject({ status: 'on_loan' });

    // S03: the member brings it back on the due date, at its last minute, and the librarian records the return.
    api.clock.set(LAST_MINUTE_OF_DUE_DATE);
    const returned = await api.call('POST', `/loans/${loan.body.id}/return`, { condition: 'good' });
    expect(returned.status).toBe(200);
    expect(returned.body.late).toBe(false);

    // The result: the tool is on the shelf, and the next member borrows it.
    expect(await entryOf(saw)).toMatchObject({ status: 'available', condition: 'good' });
    const lent = await api.call('POST', '/loans', { memberId: next, toolId: saw });
    expect(lent.status).toBe(201);
    expect(lent.body).toMatchObject({ memberId: next, toolId: saw });
  });

  it('TL-JR03-T A newly registered member opens their first loan', async () => {
    const ladder = await addTool('Ladder');

    // S01: the librarian registers the neighbor and is shown their member ID.
    const registered = await api.call('POST', '/members', { name: 'Noor', email: 'noor@example.org' });
    expect(registered.status).toBe(201);
    const id: number = registered.body.id;
    expect(Number.isInteger(id)).toBe(true);

    // S02: the new member borrows their first tool with that ID.
    const loan = await api.call('POST', '/loans', { memberId: id, toolId: ladder });
    expect(loan.status).toBe(201);
    expect(loan.body).toMatchObject({ memberId: id, toolId: ladder, dueDate: START_DUE_DATE });

    // The result: their one open loan, the only one in the library, with its due date.
    const open = await api.call('GET', `/tools/${ladder}/loan`);
    expect(open.status).toBe(200);
    expect(open.body).toMatchObject({ id: loan.body.id, memberId: id, dueDate: START_DUE_DATE });
    const onLoan = (await api.call('GET', '/tools')).body.filter((t: { status: string }) => t.status === 'on_loan');
    expect(onLoan.map((t: { id: number }) => t.id)).toEqual([ladder]);
  });
});
