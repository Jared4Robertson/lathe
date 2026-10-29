// Domain model tests: each proves one constraint, invariant, specification, policy or domain service
// against the aggregates, the command handlers, the outbox and an in-memory database.
// Each test name starts with its test record ID (examples/tool-library/data/).
import { describe, expect, it } from 'vitest';
import type { Database } from '../src/database.ts';
import { RETURNED_NEEDING_REPAIR } from '../src/event-handlers.ts';
import { isOverdue } from '../src/loan.ts';
import { borrowTool, returnTool } from '../src/loan-commands.ts';
import { registerMember } from '../src/member-commands.ts';
import {
  DEFAULT_TIME_ZONE,
  LOAN_DAYS,
  LendingError,
  assertTimeZone,
  dueDate,
  isCondition,
  parseEmail,
  parseName,
  parseNote,
} from '../src/model.ts';
import { addTool, markToolRepaired, reportDamage } from '../src/tool-commands.ts';
import { LAST_MINUTE_OF_DUE_DATE, START_DUE_DATE, START_OF_NEXT_DAY, lending } from './helpers.ts';

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
    const l = lending();
    expect(isCondition('good')).toBe(true);
    expect(isCondition('needs_repair')).toBe(true);
    expect(isCondition('broken')).toBe(false);

    const m = registerMember(l, { name: 'Di', email: 'di@example.org' });
    const t = addTool(l, { name: 'Ladder' });
    expect(t.condition).toBe('good');
    const loan = borrowTool(l, { memberId: m.id, toolId: t.id });
    rejectsWith(() => returnTool(l, loan.id, { condition: 'broken' }), 'invalid_condition');
    expect(() => l.db.sqlite.prepare("UPDATE tools SET condition = 'broken' WHERE id = ?").run(t.id)).toThrow();
  });

  it('TL-VO04-C01-T A note is trimmed and not blank', () => {
    expect(parseNote(' Chuck wobbles ')).toBe('Chuck wobbles');
    for (const value of ['', '   ', undefined, null, 7]) expect(parseNote(value)).toBeNull();
  });
});

describe('Member', () => {
  it('TL-LEND-INV01-T A second member with the same email is rejected, whatever its case', () => {
    const l = lending();
    registerMember(l, { name: 'Ada', email: 'ada@example.org' });
    rejectsWith(() => registerMember(l, { name: 'Ada Two', email: 'ADA@example.org ' }), 'email_taken');
    // The repository refuses it even without the command handler, and the schema backs it up even without the repository.
    rejectsWith(() => l.members.add({ name: 'Ada Three', email: 'ada@example.org', joinedAt: new Date().toISOString() }), 'email_taken');
    expect(() =>
      l.db.sqlite.prepare('INSERT INTO members (name, email, joined_at) VALUES (?, ?, ?)').run('Ada Four', 'ada@example.org', new Date().toISOString()),
    ).toThrow();
  });

  it('TL-LEND-SP03-T A member with 3 active loans cannot borrow a fourth', () => {
    const l = lending();
    const m = registerMember(l, { name: 'Bo', email: 'bo@example.org' });
    const ids = [1, 2, 3, 4].map((n) => addTool(l, { name: `Tool ${n}` }).id);
    for (const toolId of ids.slice(0, 3)) borrowTool(l, { memberId: m.id, toolId });
    rejectsWith(() => borrowTool(l, { memberId: m.id, toolId: ids[3] }), 'loan_limit_reached');

    // Returning one frees a slot.
    returnTool(l, 1, { condition: 'good' });
    expect(borrowTool(l, { memberId: m.id, toolId: ids[3] }).toolId).toBe(ids[3]);
  });

  it('TL-LEND-SP02-T A member with an overdue loan cannot borrow', () => {
    const l = lending();
    const m = registerMember(l, { name: 'Cy', email: 'cy@example.org' });
    const [drill, saw, plane] = ['Drill', 'Saw', 'Plane'].map((name) => addTool(l, { name }));
    const loan = borrowTool(l, { memberId: m.id, toolId: drill.id });
    expect(loan.dueDate).toBe(START_DUE_DATE);

    // 23:59 on the due date in New York (already the next day in UTC): not overdue yet.
    l.clock.set(LAST_MINUTE_OF_DUE_DATE);
    expect(borrowTool(l, { memberId: m.id, toolId: saw.id }).toolId).toBe(saw.id);

    // 00:00 the next day in New York: overdue, so borrowing is refused.
    l.clock.set(START_OF_NEXT_DAY);
    rejectsWith(() => borrowTool(l, { memberId: m.id, toolId: plane.id }), 'member_overdue');

    returnTool(l, loan.id, { condition: 'good' });
    expect(borrowTool(l, { memberId: m.id, toolId: plane.id }).toolId).toBe(plane.id);
  });
});

describe('Tool', () => {
  it('TL-LEND-SP04-T A tool that needs repair cannot be lent', () => {
    const l = lending();
    const m = registerMember(l, { name: 'Ed', email: 'ed@example.org' });
    const t = addTool(l, { name: 'Sander' });
    reportDamage(l, t.id, 'Pad is torn');
    rejectsWith(() => borrowTool(l, { memberId: m.id, toolId: t.id }), 'tool_needs_repair');
  });

  it('TL-LEND-INV02-T A tool needing repair keeps its damage report until it is marked repaired', () => {
    const l = lending();
    const m = registerMember(l, { name: 'Kai', email: 'kai@example.org' });
    const t = addTool(l, { name: 'Chainsaw' });
    const loan = borrowTool(l, { memberId: m.id, toolId: t.id });
    const first = reportDamage(l, t.id, 'Chain snapped, reported by phone').damage;

    // A second damage report is refused, and the first stands.
    rejectsWith(() => reportDamage(l, t.id, 'Bar bent'), 'tool_already_damaged');
    expect(l.tools.get(t.id).damage).toEqual(first);

    // A good return does not clear it.
    const { loan: returned } = returnTool(l, loan.id, { condition: 'good' });
    expect(returned.return?.condition).toBe('good');
    expect(l.tools.get(t.id)).toMatchObject({ condition: 'needs_repair', damage: first });
    rejectsWith(() => borrowTool(l, { memberId: m.id, toolId: t.id }), 'tool_needs_repair');

    // Only marking it repaired puts it back into lending, and then damage can be reported again.
    markToolRepaired(l, t.id);
    expect(l.tools.get(t.id)).toMatchObject({ condition: 'good', damage: null });
    expect(borrowTool(l, { memberId: m.id, toolId: t.id }).toolId).toBe(t.id);
    expect(reportDamage(l, t.id, 'Bar bent').damage?.note).toBe('Bar bent');
  });

  it('TL-LEND-INV03-T A tool on loan cannot be lent again until it is returned', () => {
    const l = lending();
    const a = registerMember(l, { name: 'Fay', email: 'fay@example.org' });
    const b = registerMember(l, { name: 'Gus', email: 'gus@example.org' });
    const t = addTool(l, { name: 'Wheelbarrow' });
    const loan = borrowTool(l, { memberId: a.id, toolId: t.id });
    rejectsWith(() => borrowTool(l, { memberId: b.id, toolId: t.id }), 'tool_on_loan');
    // The schema backs the invariant up even without the aggregate.
    expect(() =>
      l.loans.add({ memberId: b.id, toolId: t.id, borrowedAt: new Date().toISOString(), dueDate: START_DUE_DATE, return: null }),
    ).toThrow();

    returnTool(l, loan.id, { condition: 'good' });
    expect(borrowTool(l, { memberId: b.id, toolId: t.id }).memberId).toBe(b.id);
  });
});

describe('Loan', () => {
  it("TL-LEND-INV04-T A loan is due 14 calendar days after it starts, in the library's time zone", () => {
    const l = lending();
    const m = registerMember(l, { name: 'Hal', email: 'hal@example.org' });
    const t = addTool(l, { name: 'Hedge trimmer' });
    const loan = borrowTool(l, { memberId: m.id, toolId: t.id });
    expect(loan.borrowedAt).toBe(l.clock.now().toISOString());
    expect(loan.dueDate).toBe(START_DUE_DATE);
    expect(LOAN_DAYS).toBe(14);

    // In another library time zone, the loan is due on that zone's date.
    const auckland = lending({ timeZone: 'Pacific/Auckland' });
    const a = registerMember(auckland, { name: 'Hana', email: 'hana@example.org' });
    const at = addTool(auckland, { name: 'Mower' });
    auckland.clock.set('2026-03-02T12:00:00.000Z'); // 01:00 on 3 March in Auckland, 07:00 on 2 March in New York.
    expect(borrowTool(auckland, { memberId: a.id, toolId: at.id }).dueDate).toBe('2026-03-17');
    // The database accepts only a date as the due date.
    const rake = addTool(l, { name: 'Rake' });
    expect(() =>
      l.loans.add({ memberId: m.id, toolId: rake.id, borrowedAt: l.clock.now().toISOString(), dueDate: '2026-03-16T10:00:00Z', return: null }),
    ).toThrow();
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
    // An unknown time zone is refused, by the calendar and so when the Lending domain is opened.
    expect(() => assertTimeZone('Mars/Olympus_Mons')).toThrow(RangeError);
    expect(() => lending({ timeZone: 'Mars/Olympus_Mons' })).toThrow(RangeError);
  });

  it("TL-LEND-SP01-T A loan is overdue only while it is active after its due date, in the library's time zone", () => {
    const ny = DEFAULT_TIME_ZONE;
    const active = { dueDate: START_DUE_DATE, return: null };
    // Still not overdue at 23:59 on the due date in New York, though UTC is on the next day.
    expect(isOverdue(active, new Date(LAST_MINUTE_OF_DUE_DATE), ny)).toBe(false);
    expect(isOverdue(active, new Date('2026-03-17T03:59:59.999Z'), ny)).toBe(false);
    // Overdue from 00:00 on the next day in New York.
    expect(isOverdue(active, new Date(START_OF_NEXT_DAY), ny)).toBe(true);
    // In winter (EST, UTC-5) the day turns at 05:00 UTC.
    const winter = { dueDate: '2026-01-10', return: null };
    expect(isOverdue(winter, new Date('2026-01-11T04:59:59.999Z'), ny)).toBe(false);
    expect(isOverdue(winter, new Date('2026-01-11T05:00:00.000Z'), ny)).toBe(true);
    // The same instant counts in the configured time zone: in UTC it is already the next day.
    expect(isOverdue(active, new Date(LAST_MINUTE_OF_DUE_DATE), 'UTC')).toBe(true);
    // A returned loan is never overdue.
    const returned = { dueDate: START_DUE_DATE, return: { returnedAt: '2026-03-20T00:00:00.000Z', condition: 'good' as const, note: null } };
    expect(isOverdue(returned, new Date('2026-04-01T12:00:00Z'), ny)).toBe(false);
  });

  it('TL-LEND-INV05-T A returned loan cannot be returned again', () => {
    const l = lending();
    const m = registerMember(l, { name: 'Ivy', email: 'ivy@example.org' });
    const t = addTool(l, { name: 'Pressure washer' });
    const loan = borrowTool(l, { memberId: m.id, toolId: t.id });
    const { loan: returned } = returnTool(l, loan.id, { condition: 'good' });
    rejectsWith(() => returnTool(l, loan.id, { condition: 'needs_repair' }), 'already_returned');
    expect(l.loans.get(loan.id).return).toEqual(returned.return);
  });

  it("TL-LEND-INV06-T A return records the tool's condition on the loan", () => {
    const l = lending();
    const m = registerMember(l, { name: 'Jo', email: 'jo@example.org' });
    const t = addTool(l, { name: 'Tile cutter' });
    const loan = borrowTool(l, { memberId: m.id, toolId: t.id });
    l.clock.advanceDays(3);
    returnTool(l, loan.id, { condition: 'needs_repair', note: 'Blade chipped' });
    expect(l.loans.get(loan.id).return).toEqual({ returnedAt: l.clock.now().toISOString(), condition: 'needs_repair', note: 'Blade chipped' });
  });
});

describe('Policies', () => {
  /** The outbox's rows, oldest first. */
  function outboxRows(db: Database) {
    return db.sqlite.prepare('SELECT type, delivered_at FROM outbox ORDER BY id').all() as { type: string; delivered_at: string | null }[];
  }

  it('TL-LEND-PO01-T Return a tool changes only the loan, and saves Tool returned to the outbox with it', () => {
    const l = lending({ policies: false });
    const m = registerMember(l, { name: 'Lu', email: 'lu@example.org' });
    const t = addTool(l, { name: 'Router' });
    const loan = borrowTool(l, { memberId: m.id, toolId: t.id });
    l.clock.advanceDays(2);

    const returned = returnTool(l, loan.id, { condition: 'needs_repair', note: 'Bit stuck' });
    expect(returned.late).toBe(false);
    expect(returned.loan.return).toMatchObject({ condition: 'needs_repair', note: 'Bit stuck' });
    // With no event handler hearing Tool returned, the tool is untouched: only the policy takes it out of lending.
    expect(l.tools.get(t.id)).toMatchObject({ condition: 'good', damage: null });
    expect(l.delivered.at(-1)).toEqual({
      type: 'ToolReturned',
      loanId: loan.id,
      memberId: m.id,
      toolId: t.id,
      returnedAt: l.clock.now().toISOString(),
      condition: 'needs_repair',
      note: 'Bit stuck',
      late: false,
    });
    // Every event was saved to the outbox and relayed; a refused return saves none.
    expect(() => returnTool(l, loan.id, { condition: 'good' })).toThrow(LendingError);
    expect(outboxRows(l.db).map((r) => r.type)).toEqual(['MemberRegistered', 'ToolAdded', 'LoanOpened', 'ToolReturned']);
    expect(outboxRows(l.db).filter((r) => r.delivered_at === null)).toEqual([]);
  });

  it('TL-LEND-PO01-T A tool returned needing repair is marked as needing repair through the outbox', () => {
    const l = lending();
    const m = registerMember(l, { name: 'Mo', email: 'mo@example.org' });
    const pat = registerMember(l, { name: 'Pat', email: 'pat@example.org' });
    const [chuck, blank, good, phoned] = ['Drill', 'Jigsaw', 'Clamp', 'Planer'].map((name) => addTool(l, { name }).id);
    const loans = [chuck, blank, good].map((toolId) => borrowTool(l, { memberId: m.id, toolId }).id);
    loans.push(borrowTool(l, { memberId: pat.id, toolId: phoned }).id);
    l.delivered.length = 0;

    // Tool returned is relayed from the outbox, and Report damage is invoked with the return note as the damage note.
    returnTool(l, loans[0], { condition: 'needs_repair', note: 'Chuck wobbles' });
    const now = l.clock.now().toISOString();
    expect(l.delivered.map((e) => e.type)).toEqual(['ToolReturned', 'DamageReported']);
    expect(l.delivered[1]).toEqual({ type: 'DamageReported', toolId: chuck, note: 'Chuck wobbles', reportedAt: now });
    expect(l.tools.get(chuck)).toMatchObject({ condition: 'needs_repair', damage: { note: 'Chuck wobbles', reportedAt: now } });
    expect(outboxRows(l.db).slice(-2)).toEqual([
      { type: 'ToolReturned', delivered_at: now },
      { type: 'DamageReported', delivered_at: now },
    ]);

    // With no return note, the damage note says it came back needing repair.
    returnTool(l, loans[1], { condition: 'needs_repair', note: '  ' });
    expect(l.tools.get(blank)).toMatchObject({ condition: 'needs_repair', damage: { note: RETURNED_NEEDING_REPAIR } });

    // A good return invokes nothing.
    l.delivered.length = 0;
    returnTool(l, loans[2], { condition: 'good' });
    expect(l.delivered.map((e) => e.type)).toEqual(['ToolReturned']);
    expect(l.tools.get(good)).toMatchObject({ condition: 'good', damage: null });

    // A tool that already needs repair keeps its first damage report (TL-LEND-INV02), and Tool returned is delivered.
    const phonedIn = reportDamage(l, phoned, 'Blade nicked, reported by phone').damage;
    l.delivered.length = 0;
    returnTool(l, loans[3], { condition: 'needs_repair', note: 'Blade nicked' });
    expect(l.delivered.map((e) => e.type)).toEqual(['ToolReturned']);
    expect(l.tools.get(phoned).damage).toEqual(phonedIn);
    expect(outboxRows(l.db).filter((r) => r.delivered_at === null)).toEqual([]);
  });

  it('TL-LEND-PO01-T A failed event handler leaves Tool returned in the outbox, delivered on the next relay run', () => {
    const failures: string[] = [];
    const l = lending({ onFailure: (_err, event) => failures.push(event.type) });
    const m = registerMember(l, { name: 'Nia', email: 'nia@example.org' });
    const t = addTool(l, { name: 'Sledgehammer' });
    const loan = borrowTool(l, { memberId: m.id, toolId: t.id });
    // Make Report damage fail: the tools table refuses any change.
    l.db.sqlite.exec("CREATE TRIGGER no_tool_updates BEFORE UPDATE ON tools BEGIN SELECT RAISE(ABORT, 'tools are read-only'); END;");

    // The return stands, the failure is reported, and the event stays undelivered.
    expect(returnTool(l, loan.id, { condition: 'needs_repair', note: 'Head loose' }).loan.return?.condition).toBe('needs_repair');
    expect(failures).toEqual(['ToolReturned']);
    expect(l.loans.get(loan.id).return).toMatchObject({ condition: 'needs_repair', note: 'Head loose' });
    expect(l.tools.get(t.id)).toMatchObject({ condition: 'good', damage: null });
    expect(outboxRows(l.db).at(-1)).toEqual({ type: 'ToolReturned', delivered_at: null });

    // Once the fault clears, the next relay run delivers it, and the tool is taken out of lending.
    l.db.sqlite.exec('DROP TRIGGER no_tool_updates');
    l.outbox.relay();
    expect(l.tools.get(t.id)).toMatchObject({ condition: 'needs_repair', damage: { note: 'Head loose' } });
    expect(outboxRows(l.db).filter((r) => r.delivered_at === null)).toEqual([]);
    expect(failures).toEqual(['ToolReturned']);

    // Handed the same event again, it changes nothing: the tool already needs repair.
    const damage = l.tools.get(t.id).damage;
    const event = l.outbox.history('ToolReturned').at(-1)!;
    l.db.sqlite.prepare('UPDATE outbox SET delivered_at = NULL WHERE type = ?').run('ToolReturned');
    l.outbox.relay();
    expect(l.tools.get(t.id).damage).toEqual(damage);
    expect(event.loanId).toBe(loan.id);
    expect(failures).toEqual(['ToolReturned']);
  });
});
