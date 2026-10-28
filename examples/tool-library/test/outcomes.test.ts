// The outcome report TL-LEND-RP01 (examples/tool-library/data/): it measures TL-BO01 to TL-BO04 for a month from the
// library's records, through the services as the API runs them. Each test name starts with the report's ID.
import { describe, expect, it } from 'vitest';
import { DEFAULT_TIME_ZONE } from '../src/model.ts';
import { measureOutcomes } from '../src/outcomes.ts';
import { services } from './helpers.ts';

/** March 2026 in the library: four loans, one returned late, one on a tool that needed repair and still out. */
function march() {
  const s = services();
  const { clock, members, tools, lending, store } = s;
  const ada = members.register({ name: 'Ada', email: 'ada@example.org' });
  const ben = members.register({ name: 'Ben', email: 'ben@example.org' });
  const cy = members.register({ name: 'Cy', email: 'cy@example.org' });
  const drill = tools.add({ name: 'Drill' });
  const saw = tools.add({ name: 'Saw' });
  const ladder = tools.add({ name: 'Ladder' });
  // 2 March: Ada borrows the drill and Ben the saw, both due 16 March.
  const adaDrill = lending.borrow({ memberId: ada.id, toolId: drill.id });
  const benSaw = lending.borrow({ memberId: ben.id, toolId: saw.id });
  // 3 March: the ladder is damaged; 4 March: a loan of it is written straight to the store, as the rules would refuse.
  clock.advanceDays(1);
  tools.reportDamage(ladder.id, 'Cracked rung');
  clock.advanceDays(1);
  store.insertLoan(cy.id, ladder.id, clock.now().toISOString(), '2026-03-18');
  // 9 March: damage reported on the saw while Ben has it; 10 March he returns it, 11 March it is repaired.
  clock.advanceDays(5);
  tools.reportDamage(saw.id, 'Blade bent');
  clock.advanceDays(1);
  lending.return(benSaw.id, { condition: 'good' });
  clock.advanceDays(1);
  tools.markRepaired(saw.id);
  // 12 March: Ada borrows the repaired saw, due 26 March.
  clock.advanceDays(1);
  const adaSaw = lending.borrow({ memberId: ada.id, toolId: saw.id });
  // 20 March: Ada returns the drill late and the saw on time.
  clock.advanceDays(8);
  lending.return(adaDrill.id, { condition: 'good' });
  lending.return(adaSaw.id, { condition: 'good' });
  // 1 April: a fourth tool joins the catalog.
  clock.set('2026-04-01T14:00:00.000Z');
  tools.add({ name: 'Sander' });
  return s;
}

describe('Outcome report', () => {
  it('TL-LEND-RP01 measures loans per tool, late loans, loans of tools needing repair and active members for a month', () => {
    const { store } = march();
    const now = new Date('2026-04-02T14:00:00.000Z');
    expect(measureOutcomes(store, '2026-03', now, DEFAULT_TIME_ZONE)).toEqual({
      month: '2026-03',
      // Four loans opened over the three tools in the catalog by 31 March.
      toolsInUse: { loans: 4, tools: 3, loansPerTool: 4 / 3 },
      // Of the four due in March, the drill came back late and the ladder is still out and overdue.
      backOnTime: { due: 4, late: 2, shareLate: 0.5 },
      // The ladder was lent while it needed repair; the saw only after its repair.
      damagedLent: 1,
      // Ada, Ben and Cy each opened a loan in the 90 days to 31 March.
      activeMembers: 3,
    });
    // April: no loans opened or due, four tools, and the same three members still within 90 days.
    expect(measureOutcomes(store, '2026-04', now, DEFAULT_TIME_ZONE)).toEqual({
      month: '2026-04',
      toolsInUse: { loans: 0, tools: 4, loansPerTool: 0 },
      backOnTime: { due: 0, late: 0, shareLate: 0 },
      damagedLent: 0,
      activeMembers: 3,
    });
    // By the end of July, March's borrowers are past 90 days.
    expect(measureOutcomes(store, '2026-07', now, DEFAULT_TIME_ZONE).activeMembers).toBe(0);
  });

  it('TL-LEND-RP01 refuses a month that is not YYYY-MM', () => {
    const { store } = services();
    for (const month of ['2026-3', '2026-13', 'March']) {
      expect(() => measureOutcomes(store, month, new Date(), DEFAULT_TIME_ZONE)).toThrow(RangeError);
    }
  });
});
