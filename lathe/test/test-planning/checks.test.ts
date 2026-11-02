// Lathe's checks of the Test planning domain, one at a time: each starts from the complete product, which gives no
// problem, and changes one thing to break the rule. LA-PAT-AGGREGATE-TESTS-R04: each of the domain's check rows is tested here.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Workspace } from '../../src/index.ts';
import { adding, complete, loadData, ofCheck, records, removeData } from '../helpers.ts';

afterAll(removeData);

let clean: Workspace;
beforeAll(async () => {
  clean = await loadData(complete());
});

/** A check row's tests, under its name. */
const check = (name: string, body: () => void) => describe(name, body);

check('test-title-not-a-result', () => {
  it('LA-STD-MODELING-R08-T02 a test titled "Tests that…" or "Should…" is a warning; a result, or the noun Tests first, is not', async () => {
    expect(ofCheck(clean, 'test-title-not-a-result')).toEqual([]);
    const titled = (titles: string[]) =>
      adding(complete(), {
        use_case_test: titles.map((title, i) => ({
          id: `EX-LEND-UC01-R01-T0${i + 2}`,
          title,
          uc_requirement_id: 'EX-LEND-UC01-R01',
          level: 'service',
          state: 'not automated yet',
          when: 'A member asks for a tool on loan.',
          then: 'The library refuses.',
        })),
      });
    const data = titled(['Tests that a lent tool is refused', 'Should refuse a lent tool', 'Test whether a tool is lent', 'Tests run one at a time', 'A lent tool is refused again']);
    const found = ofCheck(await loadData(data), 'test-title-not-a-result');
    expect(records(found)).toEqual(['EX-LEND-UC01-R01-T02', 'EX-LEND-UC01-R01-T03', 'EX-LEND-UC01-R01-T04']);
    expect(found[1].message).toBe(
      'Use case test EX-LEND-UC01-R01-T03 is titled "Should refuse a lent tool", which says what it tests or should do; title a test by the result it shows, such as "An overdue loan is refused a renewal".',
    );
  });
});
