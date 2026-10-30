// Group names (group_name) compare trimmed and in any letter case: groupRecords sorts records into one group per name
// so compared, headed as first written.
import { describe, expect, it } from 'vitest';
import type { SpecRecord } from '../src/specs/data';
import { groupRecords } from '../src/specs/groups';

const requirement = (n: number, group?: string): SpecRecord => ({
  id: `TL-LEND-UC01-R0${n}`,
  kind: 'uc_requirement',
  title: `Requirement ${n}`,
  parent: 'TL-LEND-UC01',
  product: 'TL',
  domain: 'TL-LEND',
  row: { id: `TL-LEND-UC01-R0${n}`, title: `Requirement ${n}`, use_case_id: 'TL-LEND-UC01', ...(group === undefined ? {} : { group_name: group }) },
  file: 'data/uc_requirement.jsonl',
  line: n });

describe('group names', () => {
  it('LA-VO18-C01-T Group names equal trimmed and in any letter case are one group; others are not', () => {
    const records = [
      requirement(1, 'Validation'),
      requirement(2),
      requirement(3, '  validation '),
      requirement(4, 'VALIDATION'),
      requirement(5, 'Paging'),
      requirement(6, 'Validations'),
      requirement(7, '   '),
    ];
    expect(groupRecords(records).map((g) => [g.key, g.heading, g.records.map((r) => r.id)])).toEqual([
      ['', null, ['TL-LEND-UC01-R02', 'TL-LEND-UC01-R07']],
      ['validation', 'Validation', ['TL-LEND-UC01-R01', 'TL-LEND-UC01-R03', 'TL-LEND-UC01-R04']],
      ['paging', 'Paging', ['TL-LEND-UC01-R05']],
      ['validations', 'Validations', ['TL-LEND-UC01-R06']],
    ]);
  });
});
