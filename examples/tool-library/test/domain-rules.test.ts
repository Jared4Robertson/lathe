// Domain rule tests: each proves one domain rule against the services and store.
// Each test name starts with its test record ID (specs/tool-library/lending/02-design/tests/),
// except the test for TL-LEND-DR05, which is keyed by the rule it proves, as Client keys its tests.
import { describe, expect, it } from 'vitest';
import { DEFAULT_TIME_ZONE, LOAN_DAYS, LendingError, dueDate, isCondition, isOverdue } from '../src/model.ts';
import { LAST_MINUTE_OF_DUE_DATE, START_DUE_DATE, START_OF_NEXT_DAY, services } from './helpers.ts';

function rejectsWith(fn: () => unknown, code: string): void {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(LendingError);
    expect((err as LendingError).code).toBe(code);
    return;
  }
  throw new Error(`Expected a LendingError with code ${code}`);
}

describe('Member rules', () => {
  it('TL-LEND-T01 A second member with the same email is rejected, whatever its case', () => {
    const { members, store } = services();
    members.register({ name: 'Ada', email: 'ada@example.org' });
    rejectsWith(() => members.register({ name: 'Ada Two', email: 'ADA@example.org ' }), 'email_taken');
    // The schema backs the rule up even without the service.
    expect(() => store.insertMember('Ada Three', 'ada@example.org', new Date().toISOString())).toThrow();
  });

  it('TL-LEND-T02 A member with 3 active loans cannot borrow a fourth', () => {
    const { members, tools, lending } = services();
    const m = members.register({ name: 'Bo', email: 'bo@example.org' });
    const ids = [1, 2, 3, 4].map((n) => tools.add({ name: `Tool ${n}` }).id);
    for (const toolId of ids.slice(0, 3)) lending.borrow({ memberId: m.id, toolId });
    rejectsWith(() => lending.borrow({ memberId: m.id, toolId: ids[3] }), 'loan_limit_reached');

    // Returning one frees a slot.
    lending.return(1, { condition: 'good' });
    expect(lending.borrow({ memberId: m.id, toolId: ids[3] }).toolId).toBe(ids[3]);
  });

  it('TL-LEND-T03 A member with an overdue loan cannot borrow', () => {
    const { members, tools, lending, clock } = services();
    const m = members.register({ name: 'Cy', email: 'cy@example.org' });
    const drill = tools.add({ name: 'Drill' });
    const saw = tools.add({ name: 'Saw' });
    const plane = tools.add({ name: 'Plane' });
    const loan = lending.borrow({ memberId: m.id, toolId: drill.id });
    expect(loan.dueDate).toBe(START_DUE_DATE);

    // 23:59 on the due date in New York (already the next day in UTC): not overdue yet.
    clock.set(LAST_MINUTE_OF_DUE_DATE);
    expect(lending.borrow({ memberId: m.id, toolId: saw.id }).toolId).toBe(saw.id);

    // 00:00 the next day in New York: overdue, so borrowing is refused.
    clock.set(START_OF_NEXT_DAY);
    rejectsWith(() => lending.borrow({ memberId: m.id, toolId: plane.id }), 'member_overdue');

    lending.return(loan.id, { condition: 'good' });
    expect(lending.borrow({ memberId: m.id, toolId: plane.id }).toolId).toBe(plane.id);
  });
});

describe('Tool rules', () => {
  it("TL-LEND-T04 A tool's condition is only good or needs repair", () => {
    const { members, tools, lending, store } = services();
    expect(isCondition('good')).toBe(true);
    expect(isCondition('needs_repair')).toBe(true);
    expect(isCondition('broken')).toBe(false);

    const m = members.register({ name: 'Di', email: 'di@example.org' });
    const t = tools.add({ name: 'Ladder' });
    expect(t.condition).toBe('good');
    const loan = lending.borrow({ memberId: m.id, toolId: t.id });
    rejectsWith(() => lending.return(loan.id, { condition: 'broken' }), 'invalid_condition');
    expect(() => store.db.prepare("UPDATE tools SET condition = 'broken' WHERE id = ?").run(t.id)).toThrow();
  });

  it('TL-LEND-DR05 A tool that needs repair cannot be lent', () => {
    const { members, tools, lending } = services();
    const m = members.register({ name: 'Ed', email: 'ed@example.org' });
    const t = tools.add({ name: 'Sander' });
    tools.reportDamage(t.id, 'Pad is torn');
    rejectsWith(() => lending.borrow({ memberId: m.id, toolId: t.id }), 'tool_needs_repair');
  });

  it('TL-LEND-T27 A good return does not clear damage reported during the loan', () => {
    const { members, tools, lending } = services();
    const m = members.register({ name: 'Kai', email: 'kai@example.org' });
    const t = tools.add({ name: 'Chainsaw' });
    const loan = lending.borrow({ memberId: m.id, toolId: t.id });
    tools.reportDamage(t.id, 'Chain snapped, reported by phone');

    const returned = lending.return(loan.id, { condition: 'good' });
    expect(returned.returnCondition).toBe('good');
    expect(tools.get(t.id)).toMatchObject({
      condition: 'needs_repair',
      damageNote: 'Chain snapped, reported by phone',
      status: 'needs_repair',
    });
    rejectsWith(() => lending.borrow({ memberId: m.id, toolId: t.id }), 'tool_needs_repair');

    // Only marking it repaired puts it back into lending.
    tools.markRepaired(t.id);
    expect(lending.borrow({ memberId: m.id, toolId: t.id }).toolId).toBe(t.id);
  });

  it('TL-LEND-T06 A tool on loan cannot be lent again until it is returned', () => {
    const { members, tools, lending, store } = services();
    const a = members.register({ name: 'Fay', email: 'fay@example.org' });
    const b = members.register({ name: 'Gus', email: 'gus@example.org' });
    const t = tools.add({ name: 'Wheelbarrow' });
    const loan = lending.borrow({ memberId: a.id, toolId: t.id });
    rejectsWith(() => lending.borrow({ memberId: b.id, toolId: t.id }), 'tool_on_loan');
    // The schema backs the rule up even without the service.
    expect(() => store.insertLoan(b.id, t.id, new Date().toISOString(), START_DUE_DATE)).toThrow();

    lending.return(loan.id, { condition: 'good' });
    expect(lending.borrow({ memberId: b.id, toolId: t.id }).memberId).toBe(b.id);
  });
});

describe('Loan rules', () => {
  it("TL-LEND-T07 A loan is due 14 calendar days after it starts, in the library's time zone", () => {
    const { members, tools, lending, clock, store } = services();
    const m = members.register({ name: 'Hal', email: 'hal@example.org' });
    const t = tools.add({ name: 'Hedge trimmer' });
    const loan = lending.borrow({ memberId: m.id, toolId: t.id });
    expect(loan.borrowedAt).toBe(clock.now().toISOString());
    expect(loan.dueDate).toBe(START_DUE_DATE);
    expect(LOAN_DAYS).toBe(14);

    const ny = DEFAULT_TIME_ZONE;
    expect(ny).toBe('America/New_York');
    // Across a year end.
    expect(dueDate(new Date('2026-12-25T15:00:00Z'), ny)).toBe('2027-01-08');
    // 23:30 on 2 March in New York is already 3 March in UTC: the New York date counts.
    expect(dueDate(new Date('2026-03-03T04:30:00Z'), ny)).toBe('2026-03-16');
    // The time zone is a setting: the same instant is 3 March in Auckland.
    expect(dueDate(new Date('2026-03-03T04:30:00Z'), 'Pacific/Auckland')).toBe('2026-03-17');
    const auckland = services('Pacific/Auckland');
    const a = auckland.members.register({ name: 'Hana', email: 'hana@example.org' });
    const at = auckland.tools.add({ name: 'Mower' });
    auckland.clock.set('2026-03-02T12:00:00.000Z'); // 01:00 on 3 March in Auckland, 07:00 on 2 March in New York.
    expect(auckland.lending.borrow({ memberId: a.id, toolId: at.id }).dueDate).toBe('2026-03-17');
    // An unknown time zone is refused, and the store accepts only a date as the due date.
    expect(() => services('Mars/Olympus_Mons')).toThrow(RangeError);
    expect(() => store.insertLoan(m.id, tools.add({ name: 'Rake' }).id, clock.now().toISOString(), '2026-03-16T10:00:00Z')).toThrow();
  });

  it("TL-LEND-T08 A loan is overdue only while it is active after its due date, in the library's time zone", () => {
    const ny = DEFAULT_TIME_ZONE;
    const active = { dueDate: START_DUE_DATE, returnedAt: null };
    // Still not overdue at 23:59 on the due date in New York, though UTC is on the next day.
    expect(isOverdue(active, new Date(LAST_MINUTE_OF_DUE_DATE), ny)).toBe(false);
    expect(isOverdue(active, new Date('2026-03-17T03:59:59.999Z'), ny)).toBe(false);
    // Overdue from 00:00 on the next day in New York.
    expect(isOverdue(active, new Date(START_OF_NEXT_DAY), ny)).toBe(true);
    // In winter (EST, UTC-5) the day turns at 05:00 UTC.
    const winter = { dueDate: '2026-01-10', returnedAt: null };
    expect(isOverdue(winter, new Date('2026-01-11T04:59:59.999Z'), ny)).toBe(false);
    expect(isOverdue(winter, new Date('2026-01-11T05:00:00.000Z'), ny)).toBe(true);
    // The same instant counts in the configured time zone: in UTC it is already the next day.
    expect(isOverdue(active, new Date(LAST_MINUTE_OF_DUE_DATE), 'UTC')).toBe(true);
    // A returned loan is never overdue.
    expect(isOverdue({ dueDate: START_DUE_DATE, returnedAt: '2026-03-20T00:00:00.000Z' }, new Date('2026-04-01T12:00:00Z'), ny)).toBe(false);
  });

  it('TL-LEND-T09 A returned loan cannot be returned again', () => {
    const { members, tools, lending } = services();
    const m = members.register({ name: 'Ivy', email: 'ivy@example.org' });
    const t = tools.add({ name: 'Pressure washer' });
    const loan = lending.borrow({ memberId: m.id, toolId: t.id });
    lending.return(loan.id, { condition: 'good' });
    rejectsWith(() => lending.return(loan.id, { condition: 'needs_repair' }), 'already_returned');
  });

  it("TL-LEND-T10 A return records the tool's condition on the loan", () => {
    const { members, tools, lending, clock } = services();
    const m = members.register({ name: 'Jo', email: 'jo@example.org' });
    const t = tools.add({ name: 'Tile cutter' });
    const loan = lending.borrow({ memberId: m.id, toolId: t.id });
    clock.advanceDays(3);
    const returned = lending.return(loan.id, { condition: 'needs_repair', note: 'Blade chipped' });
    expect(returned.returnedAt).toBe(clock.now().toISOString());
    expect(returned.returnCondition).toBe('needs_repair');
    expect(returned.returnNote).toBe('Blade chipped');
  });
});
