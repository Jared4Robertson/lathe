// Tests over HTTP: use case tests prove a UC requirement as the actor meets it; endpoint tests prove
// an endpoint's API requirement (TL-LEND-EP0n-R0n), its statuses, codes and bodies; and the pattern
// rule tests prove what a librarian action does to what is stored.
// Where a use case test and an endpoint test share a scenario, it is one helper both run.
// Each test name starts with its test record ID (examples/tool-library/data/).
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

async function catalog(): Promise<{ id: number; status: string; condition: string; damageNote: string | null }[]> {
  return (await api.call('GET', '/tools')).body;
}

async function entryOf(toolId: number) {
  return (await catalog()).find((t) => t.id === toolId)!;
}

async function statusOf(toolId: number): Promise<string> {
  return (await entryOf(toolId)).status;
}

describe('TL-LEND-UC01 Register a member', () => {
  /** A registration without a name, without an email, with a blank name and with a malformed email. */
  async function badRegistrations() {
    const bodies = [{ email: 'a@example.org' }, { name: 'Al' }, { name: '  ', email: 'a@example.org' }, { name: 'Al', email: 'not-an-email' }];
    return Promise.all(bodies.map((body) => api.call('POST', '/members', body)));
  }

  it('TL-LEND-UC01-R01-T01 A registration without a name or a valid email is rejected', async () => {
    for (const res of await badRegistrations()) {
      expect(res.status).not.toBe(201);
      expect(res.body.message).toMatch(/name|email/);
    }
    // Nothing was saved: the email is still free.
    expect((await api.call('POST', '/members', { name: 'Al', email: 'a@example.org' })).status).toBe(201);
  });

  it('TL-LEND-EP01-R01-T01 A registration body without a name or a valid email gives 400 invalid_request', async () => {
    for (const res of await badRegistrations()) {
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_request');
    }
  });

  async function registerTwice() {
    await member('Lee', 'lee@example.org');
    return api.call('POST', '/members', { name: 'Lee Again', email: 'Lee@Example.org' });
  }

  it('TL-LEND-UC01-R02-T01 Registering an email that is already registered is refused, saying the email is taken', async () => {
    const res = await registerTwice();
    expect(res.status).not.toBe(201);
    expect(res.body.message).toMatch(/lee@example.org is already registered/);
  });

  it('TL-LEND-EP01-R02-T01 A registered email, in any case, gives 409 email_taken', async () => {
    const res = await registerTwice();
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('email_taken');
  });

  it('TL-LEND-UC01-R03-T01 A registration shows the new member with their ID', async () => {
    const res = await api.call('POST', '/members', { name: 'Mo', email: 'mo@example.org' });
    expect(Number.isInteger(res.body.id)).toBe(true);
    expect(res.body).toMatchObject({ name: 'Mo', email: 'mo@example.org' });
  });

  it('TL-LEND-EP01-R03-T01 A registration returns 201 with the member, trimmed and in lower case', async () => {
    const res = await api.call('POST', '/members', { name: ' Mo ', email: 'MO@example.org' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Mo', email: 'mo@example.org', joinedAt: api.clock.now().toISOString() });
    expect(Number.isInteger(res.body.id)).toBe(true);
  });
});

describe('TL-LEND-UC02 Add a tool', () => {
  it('TL-LEND-UC02-R01-T01 A tool without a name is rejected', async () => {
    const res = await api.call('POST', '/tools', { description: 'No name' });
    expect(res.status).not.toBe(201);
    expect(res.body.message).toMatch(/name/);
    expect(await catalog()).toEqual([]);
  });

  it('TL-LEND-UC02-R03-T01 An added tool reads the same in the catalog', async () => {
    const added = await api.call('POST', '/tools', { name: ' Ladder ', description: '3 m' });
    expect(await catalog()).toEqual([added.body]);
  });

  it('TL-LEND-EP02-R01-T01 A tool body without a name gives 400 invalid_request', async () => {
    for (const body of [{ description: 'No name' }, { name: '   ' }]) {
      const res = await api.call('POST', '/tools', body);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_request');
    }
  });

  it('TL-LEND-UC02-R02-T01 A new tool is in good condition and available in the catalog', async () => {
    const res = await api.call('POST', '/tools', { name: 'Circular saw', description: '7 1/4 inch blade' });
    expect(await entryOf(res.body.id)).toMatchObject({ condition: 'good', status: 'available' });
  });

  it('TL-LEND-EP02-R02-T01 Adding a tool returns 201 with an available catalog entry', async () => {
    const res = await api.call('POST', '/tools', { name: 'Circular saw' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Circular saw', description: '', condition: 'good', damageNote: null, status: 'available' });
    expect(res.body.addedAt).toBe(api.clock.now().toISOString());
  });

  it('TL-LEND-EP03-R01-T01 The catalog lists every tool in ID order with its condition and status', async () => {
    const a = await tool('Saw');
    const b = await tool('Plane');
    const res = await api.call('GET', '/tools');
    expect(res.status).toBe(200);
    expect(res.body.map((t: { id: number }) => t.id)).toEqual([a, b]);
    for (const entry of res.body) expect(entry).toMatchObject({ condition: 'good', damageNote: null, status: 'available' });
  });
});

describe('TL-LEND-UC03 Borrow a tool', () => {
  it('TL-LEND-UC03-R01-T01 A loan is shown with its due date, a date 14 days ahead', async () => {
    const res = await borrow(await member(), await tool());
    expect(res.body.dueDate).toBe(START_DUE_DATE);

    // Borrowed at 23:30 in New York, when UTC is already on the next day: the New York date counts.
    api.clock.set('2026-03-03T04:30:00.000Z');
    const late = await borrow(await member('Uma'), await tool('Saw'));
    expect(late.body.dueDate).toBe('2026-03-16');
  });

  it('TL-LEND-EP04-R05-T01 A borrow returns 201 with the loan and its due date, with no due time', async () => {
    const res = await borrow(await member(), await tool());
    expect(res.status).toBe(201);
    expect(res.body.borrowedAt).toBe(api.clock.now().toISOString());
    expect(res.body.dueDate).toBe(START_DUE_DATE);
    expect(res.body).not.toHaveProperty('dueAt');
    expect(res.body.returnedAt).toBeNull();
  });

  /** Borrowing a tool on loan, and a damaged tool. */
  async function borrowUnavailable() {
    const a = await member('Nia');
    const b = await member('Oz');
    const onLoan = await tool('Jigsaw');
    const damaged = await tool('Router');
    await borrow(a, onLoan);
    await api.call('POST', `/tools/${damaged}/damage`, { note: 'Collet stuck' });
    return { onLoan: await borrow(b, onLoan), damaged: await borrow(b, damaged) };
  }

  it('TL-LEND-UC03-R02-T01 An unavailable tool is refused with the reason', async () => {
    const { onLoan, damaged } = await borrowUnavailable();
    expect(onLoan.body.message).toMatch(/already on loan/);
    expect(damaged.body.message).toMatch(/needs repair/);
  });

  it('TL-LEND-EP04-R03-T01 An unavailable tool gives 409 tool_on_loan or tool_needs_repair', async () => {
    const { onLoan, damaged } = await borrowUnavailable();
    expect(onLoan).toMatchObject({ status: 409, body: { error: 'tool_on_loan' } });
    expect(damaged).toMatchObject({ status: 409, body: { error: 'tool_needs_repair' } });
  });

  /** A member at the loan limit; and a member who can borrow at 23:59 on a due date but not at 00:00 the next day. */
  async function borrowAsMemberWhoCannot() {
    const full = await member('Pat');
    for (const name of ['A', 'B', 'C']) await borrow(full, await tool(name));
    const atLimit = await borrow(full, await tool('D'));

    const late = await member('Quinn');
    await borrow(late, await tool('E'));
    api.clock.set(LAST_MINUTE_OF_DUE_DATE);
    const onDueDate = await borrow(late, await tool('F'));
    api.clock.set(START_OF_NEXT_DAY);
    const overdue = await borrow(late, await tool('G'));
    return { atLimit, onDueDate, overdue };
  }

  it('TL-LEND-UC03-R03-T01 A member who cannot borrow is refused with the reason', async () => {
    const { atLimit, onDueDate, overdue } = await borrowAsMemberWhoCannot();
    expect(atLimit.body.message).toMatch(/already holds 3 active loans/);
    expect(onDueDate.status).toBe(201);
    expect(overdue.body.message).toMatch(/overdue loan/);
  });

  it('TL-LEND-EP04-R02-T01 A member who cannot borrow gives 409 member_overdue or loan_limit_reached', async () => {
    const { atLimit, onDueDate, overdue } = await borrowAsMemberWhoCannot();
    expect(atLimit).toMatchObject({ status: 409, body: { error: 'loan_limit_reached' } });
    expect(onDueDate.status).toBe(201);
    expect(overdue).toMatchObject({ status: 409, body: { error: 'member_overdue' } });
  });

  /** Borrowing with an unknown member, and an unknown tool. */
  async function borrowUnknown() {
    const m = await member('Ray');
    const t = await tool();
    return { member: await borrow(999, t), tool: await borrow(m, 999) };
  }

  it('TL-LEND-UC03-R04-T01 An unknown member or tool is reported as not found', async () => {
    const res = await borrowUnknown();
    expect(res.member.body.message).toMatch(/no member 999/);
    expect(res.tool.body.message).toMatch(/no tool 999/);
  });

  it('TL-LEND-EP04-R01-T01 An unknown member or tool gives 404 member_not_found or tool_not_found', async () => {
    const res = await borrowUnknown();
    expect(res.member).toMatchObject({ status: 404, body: { error: 'member_not_found' } });
    expect(res.tool).toMatchObject({ status: 404, body: { error: 'tool_not_found' } });
  });

  it('TL-LEND-EP04-R01-T02 A borrow with a missing or malformed ID gives 400 invalid_request', async () => {
    const m = await member();
    const t = await tool();
    for (const body of [{ toolId: t }, { memberId: m, toolId: 0 }, { memberId: String(m), toolId: t }, { memberId: m, toolId: 1.5 }]) {
      const res = await api.call('POST', '/loans', body);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_request');
    }
  });

  it('TL-LEND-EP04-R04-T01 When several borrow checks fail, the first in order is reported', async () => {
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
  /** A return with no condition, and one with a condition that is not good or needs repair. */
  async function returnWithoutCondition() {
    const t = await tool();
    const loan = (await borrow(await member(), t)).body;
    const responses = [];
    for (const body of [{}, { condition: 'fine' }]) responses.push(await api.call('POST', `/loans/${loan.id}/return`, body));
    return { t, responses };
  }

  /** A tool lent to a member, then its active loan found from the tool; and the same for a tool not on loan and an unknown tool. */
  async function findLoans() {
    const t = await tool();
    const m = await member();
    const lent = (await borrow(m, t)).body;
    const found = await api.call('GET', `/tools/${t}/loan`);
    const idle = await tool('Plane');
    const notOnLoan = await api.call('GET', `/tools/${idle}/loan`);
    const unknown = await api.call('GET', '/tools/999/loan');
    return { t, m, lent, found, notOnLoan, unknown };
  }

  it('TL-LEND-UC04-R05-T01 The librarian finds the loan from the tool brought back', async () => {
    const { t, m, lent, found, notOnLoan } = await findLoans();
    expect(found.body).toMatchObject({ id: lent.id, memberId: m, toolId: t, dueDate: START_DUE_DATE });
    expect(notOnLoan.body.message).toMatch(/not on loan/);
  });

  it('TL-LEND-EP08-R01-T01 Finding a tool\'s loan returns 200 with the active loan', async () => {
    const { lent, found } = await findLoans();
    expect(found.status).toBe(200);
    expect(found.body).toEqual({ id: lent.id, memberId: lent.memberId, toolId: lent.toolId, borrowedAt: lent.borrowedAt, dueDate: lent.dueDate });
  });

  it('TL-LEND-EP08-R02-T01 A tool not on loan, or unknown, gives 404 loan_not_found', async () => {
    const { t, lent, notOnLoan, unknown } = await findLoans();
    expect(notOnLoan).toMatchObject({ status: 404, body: { error: 'loan_not_found' } });
    expect(unknown).toMatchObject({ status: 404, body: { error: 'loan_not_found' } });
    await api.call('POST', `/loans/${lent.id}/return`, { condition: 'good' });
    expect(await api.call('GET', `/tools/${t}/loan`)).toMatchObject({ status: 404, body: { error: 'loan_not_found' } });
  });

  it('TL-LEND-UC04-R01-T01 A return without a valid condition is rejected', async () => {
    const { t, responses } = await returnWithoutCondition();
    for (const res of responses) expect(res.body.message).toMatch(/condition/);
    expect(await statusOf(t)).toBe('on_loan');
  });

  it('TL-LEND-EP05-R01-T01 A return body without good or needs_repair gives 400 invalid_condition', async () => {
    const { responses } = await returnWithoutCondition();
    for (const res of responses) expect(res).toMatchObject({ status: 400, body: { error: 'invalid_condition' } });
  });

  it('TL-LEND-UC04-R02-T01 A tool returned in good condition is available again', async () => {
    const t = await tool();
    const loan = (await borrow(await member(), t)).body;
    await api.call('POST', `/loans/${loan.id}/return`, { condition: 'good' });
    expect(await statusOf(t)).toBe('available');
    expect((await borrow(await member('Ola'), t)).status).toBe(201);
  });

  it('TL-LEND-EP03-R01-T02 The catalog shows a tool on_loan while lent, and available after a good return', async () => {
    const t = await tool();
    const loan = (await borrow(await member(), t)).body;
    expect(await statusOf(t)).toBe('on_loan');
    await api.call('POST', `/loans/${loan.id}/return`, { condition: 'good' });
    expect(await statusOf(t)).toBe('available');
  });

  /** A tool returned needing repair, with a note. */
  async function returnNeedingRepair() {
    const t = await tool();
    const loan = (await borrow(await member('Sam'), t)).body;
    await api.call('POST', `/loans/${loan.id}/return`, { condition: 'needs_repair', note: 'Chuck wobbles' });
    return t;
  }

  it('TL-LEND-UC04-R03-T01 A tool returned needing repair is taken out of lending', async () => {
    const t = await returnNeedingRepair();
    // The policy runs after the return commits, before the return's response: the next request sees it.
    expect(await entryOf(t)).toMatchObject({ status: 'needs_repair', condition: 'needs_repair', damageNote: 'Chuck wobbles' });
    const res = await borrow(await member('Tia'), t);
    expect(res.body.error).toBe('tool_needs_repair');
  });

  /** A return at 23:59 on the due date in New York (already the next day in UTC), and one at 00:00 the next day. */
  async function returnOnAndAfterDueDate() {
    const m = await member();
    const onTime = (await borrow(m, await tool('A'))).body;
    const late = (await borrow(m, await tool('B'))).body;
    api.clock.set(LAST_MINUTE_OF_DUE_DATE);
    const first = await api.call('POST', `/loans/${onTime.id}/return`, { condition: 'good' });
    api.clock.set(START_OF_NEXT_DAY);
    const second = await api.call('POST', `/loans/${late.id}/return`, { condition: 'needs_repair', note: 'Dull' });
    return { onTime: first, late: second };
  }

  it('TL-LEND-UC04-R04-T01 A return on a day after the due date is flagged as late', async () => {
    const { onTime, late } = await returnOnAndAfterDueDate();
    expect(onTime.body.late).toBe(false);
    expect(late.body.late).toBe(true);
  });

  it('TL-LEND-EP05-R03-T01 A return returns 200 with the loan and whether it was late', async () => {
    const { onTime, late } = await returnOnAndAfterDueDate();
    expect(onTime.status).toBe(200);
    expect(onTime.body).toMatchObject({ dueDate: START_DUE_DATE, returnedAt: LAST_MINUTE_OF_DUE_DATE, returnCondition: 'good', returnNote: null, late: false });
    expect(late.status).toBe(200);
    expect(late.body).toMatchObject({ returnedAt: START_OF_NEXT_DAY, returnCondition: 'needs_repair', returnNote: 'Dull', late: true });
  });

  it('TL-LEND-EP05-R02-T01 Returning an unknown or already returned loan is refused', async () => {
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
    expect(await entryOf(t)).toMatchObject({ condition: 'needs_repair', damageNote: 'Blade chipped' });
  });
});

describe('TL-LEND-UC05 Report damage', () => {
  /** A damage report without a note, one with a note, and one for an unknown tool. */
  async function reportDamage() {
    const t = await tool();
    const noNote = await api.call('POST', `/tools/${t}/damage`, {});
    const ok = await api.call('POST', `/tools/${t}/damage`, { note: ' Cord frayed ' });
    const unknown = await api.call('POST', '/tools/999/damage', { note: 'x' });
    return { t, noNote, ok, unknown };
  }

  it('TL-LEND-UC05-R01-T01 A librarian marks a tool as needing repair, and must give a note', async () => {
    const { t, noNote } = await reportDamage();
    expect(noNote.body.message).toMatch(/note/);
    expect(await entryOf(t)).toMatchObject({ condition: 'needs_repair', damageNote: 'Cord frayed', status: 'needs_repair' });
  });

  it('TL-LEND-UC05-R04-T01 A tool after damage is reported reads the same in the catalog', async () => {
    const added = await api.call('POST', '/tools', { name: ' Ladder ', description: '3 m' });
    const damaged = await api.call('POST', `/tools/${added.body.id}/damage`, { note: 'Bent rung' });
    expect(await entryOf(added.body.id)).toEqual(damaged.body);
  });

  it('TL-LEND-EP06-R01-T01 A damage report without a note gives 400, and for an unknown tool 404', async () => {
    const { noNote, unknown } = await reportDamage();
    expect(noNote).toMatchObject({ status: 400, body: { error: 'invalid_request' } });
    expect(unknown).toMatchObject({ status: 404, body: { error: 'tool_not_found' } });
  });

  it('TL-LEND-EP06-R02-T01 A damage report returns 200 with the tool needing repair', async () => {
    const { ok } = await reportDamage();
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ condition: 'needs_repair', damageNote: 'Cord frayed', status: 'needs_repair' });
  });

  /** Repairing an unknown tool, a good tool, and a damaged tool. */
  async function markRepaired() {
    const unknown = await api.call('POST', '/tools/999/repair');
    const t = await tool();
    const notDamaged = await api.call('POST', `/tools/${t}/repair`);
    await api.call('POST', `/tools/${t}/damage`, { note: 'Cord frayed' });
    const ok = await api.call('POST', `/tools/${t}/repair`);
    return { t, unknown, notDamaged, ok };
  }

  it('TL-LEND-UC06-R01-T01 Marking a tool repaired returns it to lending', async () => {
    const { t, notDamaged } = await markRepaired();
    expect(notDamaged.body.message).toMatch(/not marked as needing repair/);
    expect(await entryOf(t)).toMatchObject({ condition: 'good', damageNote: null, status: 'available' });
    expect((await borrow(await member(), t)).status).toBe(201);
  });

  it('TL-LEND-UC06-R02-T01 A repaired tool reads the same in the catalog', async () => {
    const added = await api.call('POST', '/tools', { name: ' Ladder ', description: '3 m' });
    await api.call('POST', `/tools/${added.body.id}/damage`, { note: 'Bent rung' });
    const repaired = await api.call('POST', `/tools/${added.body.id}/repair`);
    expect(await entryOf(added.body.id)).toEqual(repaired.body);
  });

  it('TL-LEND-EP07-R01-T01 Repairing an unknown tool gives 404, and a good tool 409 tool_not_damaged', async () => {
    const { unknown, notDamaged } = await markRepaired();
    expect(unknown).toMatchObject({ status: 404, body: { error: 'tool_not_found' } });
    expect(notDamaged).toMatchObject({ status: 409, body: { error: 'tool_not_damaged' } });
  });

  it('TL-LEND-EP07-R02-T01 Marking a tool repaired returns 200 with it available', async () => {
    const { ok } = await markRepaired();
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ condition: 'good', damageNote: null, status: 'available' });
  });

  /** Damage reported on a tool on loan, then the loan returned as good. */
  async function damageDuringLoan() {
    const t = await tool();
    const loan = (await borrow(await member(), t)).body;
    const report = await api.call('POST', `/tools/${t}/damage`, { note: 'Reported by phone' });
    const statusAfterReport = await statusOf(t);
    const returned = await api.call('POST', `/loans/${loan.id}/return`, { condition: 'good' });
    return { t, report, statusAfterReport, returned };
  }

  it('TL-LEND-UC05-R03-T01 Damage reported during a loan does not end the loan', async () => {
    const { statusAfterReport, returned } = await damageDuringLoan();
    expect(statusAfterReport).toBe('on_loan');
    expect(returned.status).toBe(200);
  });

  it('TL-LEND-UC04-R02-T02 A good return leaves a tool needing repair when damage was reported during the loan', async () => {
    const { t } = await damageDuringLoan();
    expect(await statusOf(t)).toBe('needs_repair');
  });

  it('TL-LEND-EP06-R02-T02 A damage report on a tool on loan keeps its status on_loan', async () => {
    const { report } = await damageDuringLoan();
    expect(report.body).toMatchObject({ condition: 'needs_repair', status: 'on_loan' });
  });

  it('TL-LEND-EP06-R04-T01 A second damage report on a tool that needs repair gives 409 and keeps the first', async () => {
    const t = await tool();
    await api.call('POST', `/tools/${t}/damage`, { note: 'Cord frayed' });
    const second = await api.call('POST', `/tools/${t}/damage`, { note: 'Switch sticks' });
    expect(second).toMatchObject({ status: 409, body: { error: 'tool_already_damaged' } });
    expect(await entryOf(t)).toMatchObject({ condition: 'needs_repair', damageNote: 'Cord frayed' });
  });
});

describe('TL-LEND-UC07 See the tools waiting for repair', () => {
  /** Three tools damaged on three days, the second while on loan, and a tool in good condition. */
  async function waitingTools() {
    const [good, late, lent, early] = await Promise.all(['Clamp', 'Mower', 'Saw', 'Drill'].map((name) => tool(name)));
    await api.call('POST', `/tools/${early}/damage`, { note: 'Chuck wobbles' });
    api.clock.advanceDays(1);
    await borrow(await member(), lent);
    await api.call('POST', `/tools/${lent}/damage`, { note: 'Blade nicked, reported by phone' });
    api.clock.advanceDays(1);
    await api.call('POST', `/tools/${late}/damage`, { note: 'Will not start' });
    const listed = await api.call('GET', '/tools/waiting-for-repair');
    return { good, late, lent, early, listed };
  }

  it('TL-LEND-UC07-R01-T01 The tools waiting for repair are listed, the longest waiting first, with what is wrong', async () => {
    const { good, late, lent, early, listed } = await waitingTools();
    expect(listed.body.map((t: { id: number }) => t.id)).toEqual([early, lent, late]);
    expect(listed.body.map((t: { id: number }) => t.id)).not.toContain(good);
    expect(listed.body[0]).toMatchObject({ name: 'Drill', damageNote: 'Chuck wobbles' });
  });

  it('TL-LEND-UC07-R02-T01 A waiting tool still out on loan is shown as on loan', async () => {
    const { lent, listed } = await waitingTools();
    for (const entry of listed.body) expect(entry.onLoan).toBe(entry.id === lent);
  });

  it('TL-LEND-EP09-R01-T01 Listing the tools waiting for repair returns 200 with each entry, the oldest damage first', async () => {
    const { early, listed } = await waitingTools();
    expect(listed.status).toBe(200);
    expect(listed.body[0]).toEqual({
      id: early,
      name: 'Drill',
      damageNote: 'Chuck wobbles',
      damageReportedAt: '2026-03-02T10:00:00.000Z',
      onLoan: false,
    });
    const times = listed.body.map((t: { damageReportedAt: string }) => t.damageReportedAt);
    expect(times).toEqual([...times].sort());
    // Once repaired, a tool leaves the list.
    await api.call('POST', `/tools/${early}/repair`);
    expect((await api.call('GET', '/tools/waiting-for-repair')).body).toHaveLength(2);
  });
});

describe('TL-LEND-UC08 Renew a loan', () => {
  /** A loan renewed 10 days in, then renewed again. */
  async function renewTwice() {
    const loan = (await borrow(await member('Rin'), await tool('Ladder'))).body;
    api.clock.advanceDays(10);
    const first = await api.call('POST', `/loans/${loan.id}/renew`);
    const second = await api.call('POST', `/loans/${loan.id}/renew`);
    return { loan, first, second };
  }

  /** Renewing an unknown loan, an overdue one and a returned one. */
  async function refusedRenewals() {
    const m = await member();
    const overdue = (await borrow(m, await tool('Saw'))).body;
    const returned = (await borrow(m, await tool('Drill'))).body;
    await api.call('POST', `/loans/${returned.id}/return`, { condition: 'good' });
    api.clock.advanceDays(15);
    return {
      overdue,
      unknown: await api.call('POST', '/loans/999/renew'),
      late: await api.call('POST', `/loans/${overdue.id}/renew`),
      afterReturn: await api.call('POST', `/loans/${returned.id}/renew`),
    };
  }

  it('TL-LEND-UC08-R01-T01 A renewal moves the due date 14 days on and tells the member the new one', async () => {
    const { first } = await renewTwice();
    expect(first.body.dueDate).toBe('2026-03-30');
    expect((await api.call('GET', `/tools/${first.body.toolId}/loan`)).body.dueDate).toBe('2026-03-30');
  });

  it('TL-LEND-UC08-R02-T01 An overdue, returned or unknown loan is refused a renewal with the reason', async () => {
    const { overdue, unknown, late, afterReturn } = await refusedRenewals();
    expect(unknown.body.message).toMatch(/no loan 999/);
    expect(late.body.message).toMatch(/overdue/);
    expect(afterReturn.body.message).toMatch(/already returned/);
    expect((await api.call('GET', `/tools/${overdue.toolId}/loan`)).body.dueDate).toBe(START_DUE_DATE);
  });

  it('TL-LEND-UC08-R03-T01 A second renewal is refused, saying the loan was already renewed', async () => {
    const { second } = await renewTwice();
    expect(second.status).not.toBe(200);
    expect(second.body.message).toMatch(/already renewed/);
  });

  it('TL-LEND-EP10-R01-T01 Renewing an unknown loan gives 404 loan_not_found, and a returned one 409 already_returned', async () => {
    const { unknown, afterReturn } = await refusedRenewals();
    expect(unknown).toMatchObject({ status: 404, body: { error: 'loan_not_found' } });
    expect(afterReturn).toMatchObject({ status: 409, body: { error: 'already_returned' } });
  });

  it('TL-LEND-EP10-R02-T01 Renewing an overdue loan gives 409 loan_overdue, and a renewed one 409 already_renewed', async () => {
    const { late } = await refusedRenewals();
    expect(late).toMatchObject({ status: 409, body: { error: 'loan_overdue' } });
    const { loan, second } = await renewTwice();
    expect(second).toMatchObject({ status: 409, body: { error: 'already_renewed' } });
    // Renewed and then overdue, a loan gives loan_overdue.
    api.clock.advanceDays(30);
    expect(await api.call('POST', `/loans/${loan.id}/renew`)).toMatchObject({ status: 409, body: { error: 'loan_overdue' } });
  });

  it('TL-LEND-EP10-R03-T01 A renewal returns 200 with the loan and its new due date', async () => {
    const { loan, first } = await renewTwice();
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ ...loan, dueDate: '2026-03-30' });
  });
});

// The Librarian action pattern's rules, proved in TL-LEND for every use case that follows it:
// UC01 register a member, UC02 add a tool, UC04 return a tool, UC05 report damage, UC06 mark a tool repaired.
describe('TL-PAT-LIBRARIAN-ACTION Librarian action', () => {
  it('TL-PAT-LIBRARIAN-ACTION-R01-T01 Each librarian action missing its required input is refused, says what is missing, and saves nothing', async () => {
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
    expect(await entryOf(spare)).toMatchObject({ condition: 'good', damageNote: null, status: 'available' });
  });

  it('TL-PAT-LIBRARIAN-ACTION-R02-T01 Each successful librarian action saves its record and shows it as stored', async () => {
    // TL-LEND-UC01: the member shown is saved: the same email cannot register again.
    const registered = await api.call('POST', '/members', { name: ' Cy ', email: 'CY@example.org' });
    expect(registered.status).toBe(201);
    expect(registered.body).toMatchObject({ id: expect.any(Number), name: 'Cy', email: 'cy@example.org' });
    expect((await api.call('POST', '/members', { name: 'Cy', email: 'cy@example.org' })).body.error).toBe('email_taken');

    // TL-LEND-UC02 and UC05: the tool shown is saved.
    const added = await api.call('POST', '/tools', { name: ' Ladder ', description: '3 m' });
    expect(added.status).toBe(201);
    expect(added.body).toMatchObject({ id: expect.any(Number), name: 'Ladder', description: '3 m' });
    const damaged = await api.call('POST', `/tools/${added.body.id}/damage`, { note: 'Bent rung' });
    expect(damaged.status).toBe(200);
    expect(await entryOf(added.body.id)).toMatchObject({ condition: 'needs_repair', damageNote: 'Bent rung' });

    // TL-LEND-UC04: the returned loan shown is saved: it cannot be returned again, and the tool reflects it.
    const t = await tool('Clamp');
    const loan = (await borrow(registered.body.id, t)).body;
    const returned = await api.call('POST', `/loans/${loan.id}/return`, { condition: 'needs_repair', note: 'Jaw loose' });
    expect(returned.status).toBe(200);
    expect(returned.body).toMatchObject({ id: loan.id, returnCondition: 'needs_repair', returnNote: 'Jaw loose', late: false });
    expect((await api.call('POST', `/loans/${loan.id}/return`, { condition: 'good' })).body.error).toBe('already_returned');
    expect(await entryOf(t)).toMatchObject({ condition: 'needs_repair', damageNote: 'Jaw loose' });
  });
});
