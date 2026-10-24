// Acceptance tests over HTTP: each proves one use case requirement.
// Each test name starts with its test record ID (specs/tool-library/lending/02-design/tests/).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DAY_MS, startApi, type Api } from './helpers.ts';

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
    expect(Date.parse(res.body.dueAt) - Date.parse(res.body.borrowedAt)).toBe(14 * DAY_MS);
    expect(res.body.returnedAt).toBeNull();
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
    api.clock.advanceDays(15);
    const r2 = await borrow(late, await tool('F'));
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

  it('TL-LEND-T23 A return after the due date is flagged as late', async () => {
    const m = await member();
    const onTime = (await borrow(m, await tool('A'))).body;
    const late = (await borrow(m, await tool('B'))).body;
    api.clock.advanceDays(14);
    expect((await api.call('POST', `/loans/${onTime.id}/return`, { condition: 'good' })).body.late).toBe(false);
    api.clock.advanceMs(1);
    expect((await api.call('POST', `/loans/${late.id}/return`, { condition: 'good' })).body.late).toBe(true);
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

    // The loan is still active and can be returned; the reported damage stays (TL-LEND-Q01).
    const res = await api.call('POST', `/loans/${loan.id}/return`, { condition: 'good' });
    expect(res.status).toBe(200);
    expect(await statusOf(t)).toBe('needs_repair');
  });
});
