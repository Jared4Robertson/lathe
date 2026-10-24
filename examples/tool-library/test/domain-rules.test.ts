// Domain rule tests: each proves one domain rule against the services and store.
// Each test name starts with its test record ID (specs/tool-library/lending/02-design/tests/).
import { describe, expect, it } from 'vitest';
import { LOAN_DAYS, LendingError, dueAt, isCondition, isOverdue } from '../src/model.ts';
import { DAY_MS, services } from './helpers.ts';

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
    const loan = lending.borrow({ memberId: m.id, toolId: drill.id });

    clock.advanceDays(LOAN_DAYS);
    clock.advanceMs(1);
    rejectsWith(() => lending.borrow({ memberId: m.id, toolId: saw.id }), 'member_overdue');

    lending.return(loan.id, { condition: 'good' });
    expect(lending.borrow({ memberId: m.id, toolId: saw.id }).toolId).toBe(saw.id);
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

  it('TL-LEND-T05 A tool that needs repair cannot be lent', () => {
    const { members, tools, lending } = services();
    const m = members.register({ name: 'Ed', email: 'ed@example.org' });
    const t = tools.add({ name: 'Sander' });
    tools.reportDamage(t.id, 'Pad is torn');
    rejectsWith(() => lending.borrow({ memberId: m.id, toolId: t.id }), 'tool_needs_repair');
  });

  it('TL-LEND-T06 A tool on loan cannot be lent again until it is returned', () => {
    const { members, tools, lending, store } = services();
    const a = members.register({ name: 'Fay', email: 'fay@example.org' });
    const b = members.register({ name: 'Gus', email: 'gus@example.org' });
    const t = tools.add({ name: 'Wheelbarrow' });
    const loan = lending.borrow({ memberId: a.id, toolId: t.id });
    rejectsWith(() => lending.borrow({ memberId: b.id, toolId: t.id }), 'tool_on_loan');
    // The schema backs the rule up even without the service.
    expect(() => store.insertLoan(b.id, t.id, new Date().toISOString(), new Date().toISOString())).toThrow();

    lending.return(loan.id, { condition: 'good' });
    expect(lending.borrow({ memberId: b.id, toolId: t.id }).memberId).toBe(b.id);
  });
});

describe('Loan rules', () => {
  it('TL-LEND-T07 A loan is due 14 days after it starts', () => {
    const { members, tools, lending, clock } = services();
    const m = members.register({ name: 'Hal', email: 'hal@example.org' });
    const t = tools.add({ name: 'Hedge trimmer' });
    const loan = lending.borrow({ memberId: m.id, toolId: t.id });
    expect(loan.borrowedAt).toBe(clock.now().toISOString());
    expect(Date.parse(loan.dueAt) - Date.parse(loan.borrowedAt)).toBe(14 * DAY_MS);
    expect(dueAt(new Date('2026-12-25T00:00:00Z')).toISOString()).toBe('2027-01-08T00:00:00.000Z');
  });

  it('TL-LEND-T08 A loan is overdue only while it is active after its due time', () => {
    const due = '2026-03-16T10:00:00.000Z';
    expect(isOverdue({ dueAt: due, returnedAt: null }, new Date(due))).toBe(false);
    expect(isOverdue({ dueAt: due, returnedAt: null }, new Date(Date.parse(due) + 1))).toBe(true);
    expect(isOverdue({ dueAt: due, returnedAt: '2026-03-20T00:00:00.000Z' }, new Date('2026-04-01T00:00:00Z'))).toBe(false);
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
