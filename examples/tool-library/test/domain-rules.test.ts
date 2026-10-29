// Domain model tests: each proves one constraint, invariant, specification, policy or domain service
// against the model, the command handlers, the outbox and an in-memory store.
// Each test name starts with its test record ID (examples/tool-library/data/).
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TIME_ZONE,
  LOAN_DAYS,
  LendingError,
  assertTimeZone,
  dueDate,
  isCondition,
  isOverdue,
  parseEmail,
  parseName,
  parseNote,
} from '../src/model.ts';
import { RETURNED_NEEDING_REPAIR } from '../src/event-handlers.ts';
import type { Store } from '../src/platform/data.ts';
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

describe('Value objects', () => {
  it('TL-VO01-C01-T A name is trimmed and not blank', () => {
    expect(parseName(' Ada Lovelace ')).toBe('Ada Lovelace');
    for (const value of ['', '   ', undefined, null, 7]) expect(parseName(value)).toBeNull();
  });

  it('TL-VO02-C01-T An email address looks like an address', () => {
    expect(parseEmail('ada@example.org')).toBe('ada@example.org');
    for (const value of ['not-an-email', 'ada@example', '@example.org', 'a da@example.org', '', undefined, 7]) {
      expect(parseEmail(value)).toBeNull();
    }
  });

  it('TL-VO02-C02-T An email address is kept trimmed and in lower case', () => {
    expect(parseEmail('  Ada@Example.ORG ')).toBe('ada@example.org');
    expect(parseEmail('ADA@example.org')).toBe(parseEmail('ada@EXAMPLE.org'));
  });

  it('TL-VO03-C01-T A condition is good or needs repair', () => {
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

  it('TL-VO04-C01-T A note is trimmed and not blank', () => {
    expect(parseNote(' Chuck wobbles ')).toBe('Chuck wobbles');
    for (const value of ['', '   ', undefined, null, 7]) expect(parseNote(value)).toBeNull();
  });
});

describe('Member', () => {
  it('TL-LEND-INV01-T A second member with the same email is rejected, whatever its case', () => {
    const { members, store } = services();
    members.register({ name: 'Ada', email: 'ada@example.org' });
    rejectsWith(() => members.register({ name: 'Ada Two', email: 'ADA@example.org ' }), 'email_taken');
    // The schema backs the invariant up even without the command handler.
    expect(() => store.insertMember('Ada Three', 'ada@example.org', new Date().toISOString())).toThrow();
  });

  it('TL-LEND-SP03-T A member with 3 active loans cannot borrow a fourth', () => {
    const { members, tools, lending } = services();
    const m = members.register({ name: 'Bo', email: 'bo@example.org' });
    const ids = [1, 2, 3, 4].map((n) => tools.add({ name: `Tool ${n}` }).id);
    for (const toolId of ids.slice(0, 3)) lending.borrow({ memberId: m.id, toolId });
    rejectsWith(() => lending.borrow({ memberId: m.id, toolId: ids[3] }), 'loan_limit_reached');

    // Returning one frees a slot.
    lending.return(1, { condition: 'good' });
    expect(lending.borrow({ memberId: m.id, toolId: ids[3] }).toolId).toBe(ids[3]);
  });

  it('TL-LEND-SP02-T A member with an overdue loan cannot borrow', () => {
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

describe('Tool', () => {
  it('TL-LEND-SP04-T A tool that needs repair cannot be lent', () => {
    const { members, tools, lending } = services();
    const m = members.register({ name: 'Ed', email: 'ed@example.org' });
    const t = tools.add({ name: 'Sander' });
    tools.reportDamage(t.id, 'Pad is torn');
    rejectsWith(() => lending.borrow({ memberId: m.id, toolId: t.id }), 'tool_needs_repair');
  });

  it('TL-LEND-INV02-T A good return does not clear damage reported during the loan', () => {
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

  it('TL-LEND-INV03-T A tool on loan cannot be lent again until it is returned', () => {
    const { members, tools, lending, store } = services();
    const a = members.register({ name: 'Fay', email: 'fay@example.org' });
    const b = members.register({ name: 'Gus', email: 'gus@example.org' });
    const t = tools.add({ name: 'Wheelbarrow' });
    const loan = lending.borrow({ memberId: a.id, toolId: t.id });
    rejectsWith(() => lending.borrow({ memberId: b.id, toolId: t.id }), 'tool_on_loan');
    // The schema backs the invariant up even without the command handler.
    expect(() => store.insertLoan(b.id, t.id, new Date().toISOString(), START_DUE_DATE)).toThrow();

    lending.return(loan.id, { condition: 'good' });
    expect(lending.borrow({ memberId: b.id, toolId: t.id }).memberId).toBe(b.id);
  });
});

describe('Loan', () => {
  it("TL-LEND-INV04-T A loan is due 14 calendar days after it starts, in the library's time zone", () => {
    const { members, tools, lending, clock, store } = services();
    const m = members.register({ name: 'Hal', email: 'hal@example.org' });
    const t = tools.add({ name: 'Hedge trimmer' });
    const loan = lending.borrow({ memberId: m.id, toolId: t.id });
    expect(loan.borrowedAt).toBe(clock.now().toISOString());
    expect(loan.dueDate).toBe(START_DUE_DATE);
    expect(LOAN_DAYS).toBe(14);

    // In another library time zone, the loan is due on that zone's date.
    const auckland = services({ timeZone: 'Pacific/Auckland' });
    const a = auckland.members.register({ name: 'Hana', email: 'hana@example.org' });
    const at = auckland.tools.add({ name: 'Mower' });
    auckland.clock.set('2026-03-02T12:00:00.000Z'); // 01:00 on 3 March in Auckland, 07:00 on 2 March in New York.
    expect(auckland.lending.borrow({ memberId: a.id, toolId: at.id }).dueDate).toBe('2026-03-17');
    // The store accepts only a date as the due date.
    expect(() => store.insertLoan(m.id, tools.add({ name: 'Rake' }).id, clock.now().toISOString(), '2026-03-16T10:00:00Z')).toThrow();
  });

  it("TL-LEND-DS01-T01 The library calendar counts days in the library's time zone", () => {
    const ny = DEFAULT_TIME_ZONE;
    expect(ny).toBe('America/New_York');
    // Across a year end.
    expect(dueDate(new Date('2026-12-25T15:00:00Z'), ny)).toBe('2027-01-08');
    // 23:30 on 2 March in New York is already 3 March in UTC: the New York date counts.
    expect(dueDate(new Date('2026-03-03T04:30:00Z'), ny)).toBe('2026-03-16');
    // The time zone is a setting: the same instant is 3 March in Auckland.
    expect(dueDate(new Date('2026-03-03T04:30:00Z'), 'Pacific/Auckland')).toBe('2026-03-17');
    // An unknown time zone is refused, by the calendar and so by the lending service.
    expect(() => assertTimeZone('Mars/Olympus_Mons')).toThrow(RangeError);
    expect(() => services({ timeZone: 'Mars/Olympus_Mons' })).toThrow(RangeError);
  });

  it("TL-LEND-SP01-T A loan is overdue only while it is active after its due date, in the library's time zone", () => {
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

  it('TL-LEND-INV05-T A returned loan cannot be returned again', () => {
    const { members, tools, lending } = services();
    const m = members.register({ name: 'Ivy', email: 'ivy@example.org' });
    const t = tools.add({ name: 'Pressure washer' });
    const loan = lending.borrow({ memberId: m.id, toolId: t.id });
    lending.return(loan.id, { condition: 'good' });
    rejectsWith(() => lending.return(loan.id, { condition: 'needs_repair' }), 'already_returned');
  });

  it("TL-LEND-INV06-T A return records the tool's condition on the loan", () => {
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

describe('Policies', () => {
  /** The outbox's rows, oldest first. */
  function outboxRows(store: Store) {
    return store.db.prepare('SELECT type, delivered_at FROM outbox ORDER BY id').all() as { type: string; delivered_at: string | null }[];
  }

  it('TL-LEND-PO01-T Return a tool changes only the loan, and saves Tool returned to the outbox with it', () => {
    const { members, tools, lending, clock, delivered, store } = services({ policies: false });
    const m = members.register({ name: 'Lu', email: 'lu@example.org' });
    const t = tools.add({ name: 'Router' });
    const loan = lending.borrow({ memberId: m.id, toolId: t.id });
    clock.advanceDays(2);

    const returned = lending.return(loan.id, { condition: 'needs_repair', note: 'Bit stuck' });
    expect(returned).toMatchObject({ returnCondition: 'needs_repair', returnNote: 'Bit stuck', late: false });
    // With no event handler hearing Tool returned, the tool is untouched: only the policy takes it out of lending.
    expect(tools.get(t.id)).toMatchObject({ condition: 'good', damageNote: null, damageReportedAt: null, status: 'available' });
    expect(delivered.at(-1)).toEqual({
      type: 'ToolReturned',
      loanId: loan.id,
      memberId: m.id,
      toolId: t.id,
      returnedAt: clock.now().toISOString(),
      condition: 'needs_repair',
      note: 'Bit stuck',
      late: false,
    });
    // Every event was saved to the outbox and relayed; a refused return saves none.
    expect(() => lending.return(loan.id, { condition: 'good' })).toThrow(LendingError);
    expect(outboxRows(store).map((r) => r.type)).toEqual(['MemberRegistered', 'ToolAdded', 'LoanOpened', 'ToolReturned']);
    expect(outboxRows(store).filter((r) => r.delivered_at === null)).toEqual([]);
  });

  it('TL-LEND-PO01-T A tool returned needing repair is marked as needing repair through the outbox', () => {
    const { members, tools, lending, clock, delivered, store } = services();
    const m = members.register({ name: 'Mo', email: 'mo@example.org' });
    const [chuck, blank, good] = ['Drill', 'Jigsaw', 'Clamp'].map((name) => tools.add({ name }).id);
    const loans = [chuck, blank, good].map((toolId) => lending.borrow({ memberId: m.id, toolId }).id);
    delivered.length = 0;

    // Tool returned is relayed from the outbox, and Report damage is invoked with the return note as the damage note.
    lending.return(loans[0], { condition: 'needs_repair', note: 'Chuck wobbles' });
    expect(delivered.map((e) => e.type)).toEqual(['ToolReturned', 'DamageReported']);
    expect(delivered[1]).toEqual({ type: 'DamageReported', toolId: chuck, note: 'Chuck wobbles', reportedAt: clock.now().toISOString() });
    expect(tools.get(chuck)).toMatchObject({ condition: 'needs_repair', damageNote: 'Chuck wobbles', damageReportedAt: clock.now().toISOString(), status: 'needs_repair' });
    expect(outboxRows(store).slice(-2)).toEqual([
      { type: 'ToolReturned', delivered_at: clock.now().toISOString() },
      { type: 'DamageReported', delivered_at: clock.now().toISOString() },
    ]);

    // With no return note, the damage note says it came back needing repair.
    lending.return(loans[1], { condition: 'needs_repair', note: '  ' });
    expect(tools.get(blank)).toMatchObject({ condition: 'needs_repair', damageNote: RETURNED_NEEDING_REPAIR });

    // A good return invokes nothing.
    delivered.length = 0;
    lending.return(loans[2], { condition: 'good' });
    expect(delivered.map((e) => e.type)).toEqual(['ToolReturned']);
    expect(tools.get(good)).toMatchObject({ condition: 'good', status: 'available' });
  });

  it('TL-LEND-PO01-T A failed event handler leaves Tool returned in the outbox, delivered on the next relay run', () => {
    const failures: string[] = [];
    const { members, tools, lending, outbox, store } = services({ onFailure: (_err, event) => failures.push(event.type) });
    const m = members.register({ name: 'Nia', email: 'nia@example.org' });
    const t = tools.add({ name: 'Sledgehammer' });
    const loan = lending.borrow({ memberId: m.id, toolId: t.id });
    // Make Report damage fail: the tools table refuses any change.
    store.db.exec("CREATE TRIGGER no_tool_updates BEFORE UPDATE ON tools BEGIN SELECT RAISE(ABORT, 'tools are read-only'); END;");

    // The return stands, the failure is reported, and the event stays undelivered.
    expect(lending.return(loan.id, { condition: 'needs_repair', note: 'Head loose' }).returnCondition).toBe('needs_repair');
    expect(failures).toEqual(['ToolReturned']);
    expect(store.findLoan(loan.id)).toMatchObject({ returnCondition: 'needs_repair', returnNote: 'Head loose' });
    expect(tools.get(t.id)).toMatchObject({ condition: 'good', damageNote: null });
    expect(outboxRows(store).at(-1)).toEqual({ type: 'ToolReturned', delivered_at: null });

    // Once the fault clears, the next relay run delivers it, and the tool is taken out of lending.
    store.db.exec('DROP TRIGGER no_tool_updates');
    outbox.relay();
    expect(tools.get(t.id)).toMatchObject({ condition: 'needs_repair', damageNote: 'Head loose' });
    expect(outboxRows(store).filter((r) => r.delivered_at === null)).toEqual([]);
    expect(failures).toEqual(['ToolReturned']);
  });
});
