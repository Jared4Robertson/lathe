// Acceptance tests over HTTP: each proves a use case requirement and the endpoint's
// interaction requirements that carry it out (TL-LEND-E0n-R0n), or an interaction requirement alone.
// Each test name starts with its test record ID (specs/tool-library/lending/02-design/tests/).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LAST_MINUTE_OF_DUE_DATE, START_DUE_DATE, START_OF_NEXT_DAY, startApi, type Api } from './helpers.ts';

let api: Api;
beforeEach(async () => {
  api = await startApi();
});
afterEach(async () => {
  await api.close();
});

async function member(name = 'Kim', email = `${name.toLowerCase()}@example.org`): Promise<number> {
  const res = await api.call('POST', '/members', { name, email });
  expect(res.status).toBe(201);
  return res.body.id;
}

async function tool(name = 'Drill'): Promise<number> {
  const res = await api.call('POST', '/tools', { name });
  expect(res.status).toBe(201);
  return res.body.id;
}

async function borrow(memberId: number, toolId: number) {
  return api.call('POST', '/loans', { memberId, toolId });
}

async function statusOf(toolId: number): Promise<string> {
  const res = await api.call('GET', '/tools');
  return res.body.find((t: { id: number }) => t.id === toolId).status;
}

describe('TL-LEND-UC01 Register a member', () => {
  it('TL-LEND-T11 A registration without a name or a valid email is rejected', async () => {
    for (const body of [{ email: 'a@example.org' }, { name: 'Al' }, { name: '  ', email: 'a@example.org' }, { name: 'Al', email: 'not-an-email' }]) {
      const res = await api.call('POST', '/members', body);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_request');
    }
  });

  it('TL-LEND-T12 Registering an email that is already registered is rejected with 409', async () => {
    await member('Lee', 'lee@example.org');
    const res = await api.call('POST', '/members', { name: 'Lee Again', email: 'Lee@Example.org' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('email_taken');
  });

  it("TL-LEND-T13 A registration returns the new member with its ID", async () => {
    const res = await api.call('POST', '/members', { name: ' Mo ', email: 'MO@example.org' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Mo', email: 'mo@example.org', joinedAt: api.clock.now().toISOString() });
    expect(Number.isInteger(res.body.id)).toBe(true);
  });
});

describe('TL-LEND-UC02 Add a tool', () => {
  it('TL-LEND-T14 A tool without a name is rejected', async () => {
    const res = await api.call('POST', '/tools', { description: 'No name' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_request');
  });

  it('TL-LEND-T15 A new tool is in good condition and available in the catalog', async () => {
    const res = await api.call('POST', '/tools', { name: 'Circular saw', description: '7 1/4 inch blade' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Circular saw', condition: 'good', status: 'available' });
    expect(await statusOf(res.body.id)).toBe('available');
  });
});

describe('TL-LEND-UC03 Borrow a tool', () => {
  it('TL-LEND-T16 A loan is returned with its due date 14 days ahead', async () => {
    const res = await borrow(await member(), await tool());
    expect(res.status).toBe(201);
    expect(res.body.borrowedAt).toBe(api.clock.now().toISOString());
    expect(res.body.dueDate).toBe(START_DUE_DATE);
    expect(res.body).not.toHaveProperty('dueAt');
    expect(res.body.returnedAt).toBeNull();

    // Borrowed at 23:30 in New York, when UTC is already on the next day: the New York date counts.
    api.clock.set('2026-03-03T04:30:00.000Z');
    const late = await borrow(await member('Uma'), await tool('Saw'));
    expect(late.body.dueDate).toBe('2026-03-16');
  });

  it('TL-LEND-T17 An unavailable tool is refused with the reason', async () => {
    const a = await member('Nia');
    const b = await member('Oz');
    const onLoan = await tool('Jigsaw');
    const damaged = await tool('Router');
    await borrow(a, onLoan);
    await api.call('POST', `/tools/${damaged}/damage`, { note: 'Collet stuck' });

    const r1 = await borrow(b, onLoan);
    expect(r1.status).toBe(409);
    expect(r1.body.error).toBe('tool_on_loan');
    const r2 = await borrow(b, damaged);
    expect(r2.status).toBe(409);
    expect(r2.body.error).toBe('tool_needs_repair');
  });

  it('TL-LEND-T18 A member who cannot borrow is refused with the reason', async () => {
    const full = await member('Pat');
    for (const name of ['A', 'B', 'C']) await borrow(full, await tool(name));
    const r1 = await borrow(full, await tool('D'));
    expect(r1.status).toBe(409);
    expect(r1.body.error).toBe('loan_limit_reached');

    const late = await member('Quinn');
    await borrow(late, await tool('E'));
    api.clock.set(LAST_MINUTE_OF_DUE_DATE);
    expect((await borrow(late, await tool('F'))).status).toBe(201);
    api.clock.set(START_OF_NEXT_DAY);
    const r2 = await borrow(late, await tool('G'));
    expect(r2.status).toBe(409);
    expect(r2.body.error).toBe('member_overdue');
  });

  it('TL-LEND-T19 Borrowing with an unknown member or tool returns 404', async () => {
    const m = await member('Ray');
    const t = await tool();
    const r1 = await borrow(999, t);
    expect(r1.status).toBe(404);
    expect(r1.body.error).toBe('member_not_found');
    const r2 = await borrow(m, 999);
    expect(r2.status).toBe(404);
    expect(r2.body.error).toBe('tool_not_found');
  });

  it('TL-LEND-T28 A borrow with a missing or malformed ID is rejected', async () => {
    const m = await member();
    const t = await tool();
    for (const body of [{ toolId: t }, { memberId: m, toolId: 0 }, { memberId: String(m), toolId: t }, { memberId: m, toolId: 1.5 }]) {
      const res = await api.call('POST', '/loans', body);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_request');
    }
  });

  it('TL-LEND-T31 When several borrow checks fail, the first in order is reported', async () => {
    const errorOf = async (memberId: unknown, toolId: unknown) =>
      (await api.call('POST', '/loans', { memberId, toolId })).body.error;

    expect(await errorOf('999', 999)).toBe('invalid_request');
    expect(await errorOf(999, 999)).toBe('member_not_found');

    // A member at the loan limit, borrowing a tool that is both on loan and damaged.
    const full = await member('Vic');
    for (const name of ['A', 'B', 'C']) await borrow(full, await tool(name));
    const busy = await tool('Lathe');
    await borrow(await member('Wren'), busy);
    await api.call('POST', `/tools/${busy}/damage`, { note: 'Belt slipping' });
    expect(await errorOf(full, busy)).toBe('loan_limit_reached');
    expect(await errorOf(await member('Xan'), busy)).toBe('tool_needs_repair');

    // Once Vic's loans are overdue, being overdue comes before being at the limit.
    api.clock.set(START_OF_NEXT_DAY);
    expect(await errorOf(full, busy)).toBe('member_overdue');
  });
});

describe('TL-LEND-UC04 Return a tool', () => {
  it('TL-LEND-T20 A return without a valid condition is rejected', async () => {
    const loan = (await borrow(await member(), await tool())).body;
    for (const body of [{}, { condition: 'fine' }]) {
      const res = await api.call('POST', `/loans/${loan.id}/return`, body);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_condition');
    }
    expect((await api.call('POST', '/loans/999/return', { condition: 'good' })).status).toBe(404);
  });

  it('TL-LEND-T21 A tool returned in good condition is available again', async () => {
    const t = await tool();
    const loan = (await borrow(await member(), t)).body;
    expect(await statusOf(t)).toBe('on_loan');
    const res = await api.call('POST', `/loans/${loan.id}/return`, { condition: 'good' });
    expect(res.status).toBe(200);
    expect(res.body.returnCondition).toBe('good');
    expect(await statusOf(t)).toBe('available');
  });

  it('TL-LEND-T22 A tool returned needing repair is taken out of lending', async () => {
    const t = await tool();
    const loan = (await borrow(await member('Sam'), t)).body;
    await api.call('POST', `/loans/${loan.id}/return`, { condition: 'needs_repair', note: 'Chuck wobbles' });
    const entry = (await api.call('GET', '/tools')).body.find((x: { id: number }) => x.id === t);
    expect(entry).toMatchObject({ status: 'needs_repair', condition: 'needs_repair', damageNote: 'Chuck wobbles' });
    const res = await borrow(await member('Tia'), t);
    expect(res.body.error).toBe('tool_needs_repair');
  });

  it('TL-LEND-T23 A return on a day after the due date is flagged as late', async () => {
    const m = await member();
    const onTime = (await borrow(m, await tool('A'))).body;
    const late = (await borrow(m, await tool('B'))).body;
    // 23:59 on the due date in New York (already the next day in UTC): on time.
    api.clock.set(LAST_MINUTE_OF_DUE_DATE);
    expect((await api.call('POST', `/loans/${onTime.id}/return`, { condition: 'good' })).body.late).toBe(false);
    // 00:00 the next day in New York: late.
    api.clock.set(START_OF_NEXT_DAY);
    expect((await api.call('POST', `/loans/${late.id}/return`, { condition: 'good' })).body.late).toBe(true);
  });

  it('TL-LEND-T32 Returning an unknown or already returned loan is refused', async () => {
    const unknown = await api.call('POST', '/loans/999/return', { condition: 'good' });
    expect(unknown.status).toBe(404);
    expect(unknown.body.error).toBe('loan_not_found');

    const t = await tool();
    const loan = (await borrow(await member(), t)).body;
    await api.call('POST', `/loans/${loan.id}/return`, { condition: 'needs_repair', note: 'Blade chipped' });
    const again = await api.call('POST', `/loans/${loan.id}/return`, { condition: 'good', note: 'Fine' });
    expect(again.status).toBe(409);
    expect(again.body.error).toBe('already_returned');
    // The second return changed nothing: the tool still needs repair with the first note.
    const entry = (await api.call('GET', '/tools')).body.find((x: { id: number }) => x.id === t);
    expect(entry).toMatchObject({ condition: 'needs_repair', damageNote: 'Blade chipped' });
  });
});

describe('TL-LEND-UC05 Report damage', () => {
  it('TL-LEND-T24 A librarian marks a tool as needing repair with a note', async () => {
    const t = await tool();
    const noNote = await api.call('POST', `/tools/${t}/damage`, {});
    expect(noNote.status).toBe(400);
    const res = await api.call('POST', `/tools/${t}/damage`, { note: 'Cord frayed' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ condition: 'needs_repair', damageNote: 'Cord frayed', status: 'needs_repair' });
    expect((await api.call('POST', '/tools/999/damage', { note: 'x' })).status).toBe(404);
  });

  it('TL-LEND-T25 Marking a tool repaired returns it to lending', async () => {
    const unknown = await api.call('POST', '/tools/999/repair');
    expect(unknown.status).toBe(404);
    expect(unknown.body.error).toBe('tool_not_found');

    const t = await tool();
    const notDamaged = await api.call('POST', `/tools/${t}/repair`);
    expect(notDamaged.status).toBe(409);
    expect(notDamaged.body.error).toBe('tool_not_damaged');

    await api.call('POST', `/tools/${t}/damage`, { note: 'Cord frayed' });
    const res = await api.call('POST', `/tools/${t}/repair`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ condition: 'good', damageNote: null, status: 'available' });
    expect((await borrow(await member(), t)).status).toBe(201);
  });

  it('TL-LEND-T26 Reporting damage on a tool on loan does not end the loan', async () => {
    const t = await tool();
    const loan = (await borrow(await member(), t)).body;
    await api.call('POST', `/tools/${t}/damage`, { note: 'Reported by phone' });
    expect(await statusOf(t)).toBe('on_loan');

    // The loan is still active and can be returned; the reported damage stays (TL-LEND-DR11).
    const res = await api.call('POST', `/loans/${loan.id}/return`, { condition: 'good' });
    expect(res.status).toBe(200);
    expect(await statusOf(t)).toBe('needs_repair');
  });
});

// The Librarian action pattern's rules, proved for every TL-LEND use case that follows it:
// UC01 register a member, UC02 add a tool, UC04 return a tool, UC05 report damage.
describe('TL-PAT-LIBRARIAN-ACTION Librarian action', () => {
  async function catalog(): Promise<{ id: number }[]> {
    return (await api.call('GET', '/tools')).body;
  }

  it('TL-LEND-T33 Each librarian action missing its required input is refused, says what is missing, and saves nothing', async () => {
    // TL-LEND-UC01: no name. The email stays free, so nothing was saved.
    const noName = await api.call('POST', '/members', { email: 'ana@example.org' });
    expect(noName).toMatchObject({ status: 400, body: { error: 'invalid_request' } });
    expect(noName.body.message).toMatch(/name/);
    const noEmail = await api.call('POST', '/members', { name: 'Ana' });
    expect(noEmail.status).toBe(400);
    expect(noEmail.body.message).toMatch(/email/);
    expect((await api.call('POST', '/members', { name: 'Ana', email: 'ana@example.org' })).status).toBe(201);

    // TL-LEND-UC02: no name. The catalog is still empty.
    const noToolName = await api.call('POST', '/tools', { description: 'Cordless' });
    expect(noToolName).toMatchObject({ status: 400, body: { error: 'invalid_request' } });
    expect(noToolName.body.message).toMatch(/name/);
    expect(await catalog()).toEqual([]);

    // TL-LEND-UC04: no condition. The loan stays active and the tool stays on loan.
    const t = await tool();
    const loan = (await borrow(await member('Bo'), t)).body;
    const noCondition = await api.call('POST', `/loans/${loan.id}/return`, { note: 'Fine' });
    expect(noCondition).toMatchObject({ status: 400, body: { error: 'invalid_condition' } });
    expect(noCondition.body.message).toMatch(/condition/);
    expect(await statusOf(t)).toBe('on_loan');

    // TL-LEND-UC05: no note. The tool keeps its condition.
    const spare = await tool('Sander');
    const noNote = await api.call('POST', `/tools/${spare}/damage`, { note: '  ' });
    expect(noNote).toMatchObject({ status: 400, body: { error: 'invalid_request' } });
    expect(noNote.body.message).toMatch(/note/);
    expect((await catalog()).find((x) => x.id === spare)).toMatchObject({ condition: 'good', damageNote: null, status: 'available' });
  });

  it('TL-LEND-T34 Each successful librarian action saves its record and shows it as stored', async () => {
    // TL-LEND-UC01: the member shown is saved: the same email cannot register again.
    const registered = await api.call('POST', '/members', { name: ' Cy ', email: 'CY@example.org' });
    expect(registered.status).toBe(201);
    expect(registered.body).toMatchObject({ id: expect.any(Number), name: 'Cy', email: 'cy@example.org' });
    expect((await api.call('POST', '/members', { name: 'Cy', email: 'cy@example.org' })).body.error).toBe('email_taken');

    // TL-LEND-UC02: the tool shown is the catalog entry.
    const added = await api.call('POST', '/tools', { name: ' Ladder ', description: '3 m' });
    expect(added.status).toBe(201);
    expect(await catalog()).toEqual([added.body]);

    // TL-LEND-UC05: the entry shown after reporting damage is the catalog entry.
    const damaged = await api.call('POST', `/tools/${added.body.id}/damage`, { note: 'Bent rung' });
    expect(damaged.status).toBe(200);
    expect((await catalog()).find((x) => x.id === added.body.id)).toEqual(damaged.body);

    // TL-LEND-UC04: the returned loan shown is saved: it cannot be returned again, and the tool reflects it.
    const t = await tool('Clamp');
    const loan = (await borrow(registered.body.id, t)).body;
    const returned = await api.call('POST', `/loans/${loan.id}/return`, { condition: 'needs_repair', note: 'Jaw loose' });
    expect(returned.status).toBe(200);
    expect(returned.body).toMatchObject({ id: loan.id, returnCondition: 'needs_repair', returnNote: 'Jaw loose', late: false });
    expect((await api.call('POST', `/loans/${loan.id}/return`, { condition: 'good' })).body.error).toBe('already_returned');
    expect((await catalog()).find((x) => x.id === t)).toMatchObject({ condition: 'needs_repair', damageNote: 'Jaw loose' });
  });
});
