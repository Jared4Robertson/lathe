// The outcome report TL-LEND-RP01 (examples/tool-library/data/): it measures TL-BO01, TL-BO02, TL-BO04 and TL-BO05 for a month from the
// library's records, through the command handlers as the API runs them. Each test name starts with the report's ID.
import { describe, expect, it } from 'vitest';
import { borrowTool, returnTool } from '../src/loan-commands.ts';
import { registerMember } from '../src/member-commands.ts';
import { DEFAULT_TIME_ZONE } from '../src/model.ts';
import { OutcomeMeasuresReader, getOutcomeMeasures } from '../src/outcomes.ts';
import { addTool, markToolRepaired, reportDamage } from '../src/tool-commands.ts';
import { lending } from './helpers.ts';

/** March 2026 in the library: four loans, one returned late, one on a tool that needed repair and still out, and one repair. */
function march() {
  const l = lending();
  const { clock } = l;
  const ada = registerMember(l, { name: 'Ada', email: 'ada@example.org' });
  const ben = registerMember(l, { name: 'Ben', email: 'ben@example.org' });
  const cy = registerMember(l, { name: 'Cy', email: 'cy@example.org' });
  const drill = addTool(l, { name: 'Drill' });
  const saw = addTool(l, { name: 'Saw' });
  const ladder = addTool(l, { name: 'Ladder' });
  // 2 March: Ada borrows the drill and Ben the saw, both due 16 March.
  const adaDrill = borrowTool(l, { memberId: ada.id, toolId: drill.id });
  const benSaw = borrowTool(l, { memberId: ben.id, toolId: saw.id });
  // 3 March: the ladder is damaged; 4 March: a loan of it is saved straight through its repository, as the rules would refuse.
  clock.advanceDays(1);
  reportDamage(l, ladder.id, 'Cracked rung');
  clock.advanceDays(1);
  l.loans.add({ memberId: cy.id, toolId: ladder.id, borrowedAt: clock.now().toISOString(), dueDate: '2026-03-18', return: null });
  // 9 March: damage reported on the saw while Ben has it; 10 March he returns it, 11 March it is repaired.
  clock.advanceDays(5);
  reportDamage(l, saw.id, 'Blade bent');
  clock.advanceDays(1);
  returnTool(l, benSaw.id, { condition: 'good' });
  clock.advanceDays(1);
  markToolRepaired(l, saw.id);
  // 12 March: Ada borrows the repaired saw, due 26 March.
  clock.advanceDays(1);
  const adaSaw = borrowTool(l, { memberId: ada.id, toolId: saw.id });
  // 20 March: Ada returns the drill late and the saw on time.
  clock.advanceDays(8);
  returnTool(l, adaDrill.id, { condition: 'good' });
  returnTool(l, adaSaw.id, { condition: 'good' });
  // 1 April: a fourth tool joins the catalog.
  clock.set('2026-04-01T14:00:00.000Z');
  addTool(l, { name: 'Sander' });
  return l;
}

describe('TL-LEND-DS02-T01 Outcome report', () => {
  it('TL-LEND-RP01 measures loans per tool, late loans, days to repair and active members for a month', () => {
    const l = march();
    const now = new Date('2026-04-02T14:00:00.000Z');
    expect(getOutcomeMeasures(new OutcomeMeasuresReader(l), '2026-03', now, DEFAULT_TIME_ZONE)).toEqual({
      month: '2026-03',
      // Four loans opened over the three tools in the catalog by 31 March.
      toolsInUse: { loans: 4, tools: 3, loansPerTool: 4 / 3 },
      // Of the four due in March, the drill came back late and the ladder is still out and overdue.
      backOnTime: { due: 4, late: 2, shareLate: 0.5 },
      // The saw, damaged on 9 March, was repaired on 11 March; the ladder is not repaired yet.
      backInService: { repaired: 1, medianDays: 2 },
      // Ada, Ben and Cy each opened a loan in the 90 days to 31 March.
      activeMembers: 3,
    });
    // April: no loans opened or due, four tools, and the same three members still within 90 days.
    expect(getOutcomeMeasures(new OutcomeMeasuresReader(l), '2026-04', now, DEFAULT_TIME_ZONE)).toEqual({
      month: '2026-04',
      toolsInUse: { loans: 0, tools: 4, loansPerTool: 0 },
      backOnTime: { due: 0, late: 0, shareLate: 0 },
      backInService: { repaired: 0, medianDays: null },
      activeMembers: 3,
    });
    // By the end of July, March's borrowers are past 90 days.
    expect(getOutcomeMeasures(new OutcomeMeasuresReader(l), '2026-07', now, DEFAULT_TIME_ZONE).activeMembers).toBe(0);
  });

  it('TL-LEND-RP01 refuses a month that is not YYYY-MM', () => {
    const l = lending();
    for (const month of ['2026-3', '2026-13', 'March']) {
      expect(() => getOutcomeMeasures(new OutcomeMeasuresReader(l), month, new Date(), DEFAULT_TIME_ZONE)).toThrow(RangeError);
    }
  });
});
