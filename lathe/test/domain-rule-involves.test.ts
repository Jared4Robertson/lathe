// Domain rules across aggregates (FORMAT.md section 17): the involves relation from a domain rule to an
// aggregate, the domain-rule-involves check, and the record format's words for them.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadWorkspace, type Workspace } from '../src/index.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const CHECK = 'domain-rule-involves';

let ws: Workspace;
beforeAll(async () => {
  // rule-involves: Lending (RI-D) has Loan, Tool and Member; Accounts (RI-E) has Account. DR01 and DR09 sit
  // under Lending and involve two and three of its aggregates; DR08 sits under Tool with no involves.
  ws = await loadWorkspace(path.join(here, 'fixtures', 'rule-involves'));
});

const messagesOf = (id: string) => ws.problems.filter((p) => p.check === CHECK && p.record === id).map((p) => p.message);

describe('the involves relation', () => {
  it('LA-AUT-T111 A domain rule involves aggregates, labeled "Involves" and "Involved in" with no role, and the record format says when', () => {
    expect(ws.relations.filter((r) => r.relation === 'involves')).toEqual([{
      relation: 'involves', source_kind: 'domain_rule', target_kind: 'aggregate', role: '',
      forward_label: 'Involves', reverse_label: 'Involved in',
      description: expect.stringContaining('holds across this aggregate'),
    }]);
    expect(ws.links.filter((l) => l.source === 'RI-D-DR01')).toEqual([
      { source: 'RI-D-DR01', relation: 'involves', target: 'RI-D-A1' },
      { source: 'RI-D-DR01', relation: 'involves', target: 'RI-D-A2' },
    ]);
    expect(ws.kinds.find((k) => k.kind === 'domain_rule')?.description).toContain('naming with `involves` the two or more aggregates');
    const format = readFileSync(path.join(here, '..', 'FORMAT.md'), 'utf8');
    const section = format.split(/^## /m).find((s) => s.startsWith('17. Entities')) ?? '';
    expect(section).toContain('sits under the domain and names with `involves` the two or more aggregates of that domain it ties together');
    expect(section).toContain("a rule across domains is a domain event's job");
    expect(section).toContain('`domain-rule-involves`');
  });
});

describe('the domain-rule-involves check', () => {
  it('LA-AUT-T108 A rule under a domain that involves fewer than two aggregates is a warning that says to move a one-aggregate rule onto it; a link that dangles is not counted', () => {
    expect(messagesOf('RI-D-DR02')).toEqual([
      'Domain rule RI-D-DR02 sits under the domain RI-D but involves no aggregate; name with involves the two or more '
        + 'aggregates it ties together, or move it under the aggregate it is about.',
    ]);
    const one = 'sits under the domain RI-D but involves only RI-D-A1; a rule about one aggregate belongs under it, so move it '
      + 'under RI-D-A1, or name with involves every aggregate it ties together.';
    expect(messagesOf('RI-D-DR03')).toEqual([`Domain rule RI-D-DR03 ${one}`]);
    // DR05 also involves RI-D-A9, which does not exist: dangling-link reports it, and it does not count.
    expect(messagesOf('RI-D-DR05')).toEqual([`Domain rule RI-D-DR05 ${one}`]);
    expect(ws.problems.filter((p) => p.record === 'RI-D-DR05' && p.check === 'dangling-link')).toHaveLength(1);
    for (const id of ['RI-D-DR01', 'RI-D-DR09']) expect(messagesOf(id), id).toEqual([]);
  });

  it('LA-AUT-T109 A rule under a domain that involves an aggregate of another domain is a warning that says a rule across domains is a domain event\'s job', () => {
    expect(messagesOf('RI-D-DR04')).toEqual([
      'Domain rule RI-D-DR04 involves RI-E-A1, an aggregate of RI-E, not of its own domain RI-D; a rule across domains is '
        + "a domain event's job, so have one domain raise an event and the other react to it.",
    ]);
  });

  it('LA-AUT-T110 A rule under an aggregate or an entity that uses involves is a warning; one without involves is not', () => {
    expect(messagesOf('RI-D-DR06')).toEqual([
      'Domain rule RI-D-DR06 sits under the aggregate RI-D-A1 and involves RI-D-A2; its place already says what it is '
        + 'about, so drop involves, or move it under its domain if it holds across aggregates.',
    ]);
    expect(messagesOf('RI-D-DR07')).toEqual([
      'Domain rule RI-D-DR07 sits under the entity RI-D-EN01 and involves RI-D-A1, RI-D-A2; its place already says what '
        + 'it is about, so drop involves, or move it under its domain if it holds across aggregates.',
    ]);
    expect(messagesOf('RI-D-DR08')).toEqual([]);
    // Every finding is a warning, and only the six rules above are reported.
    const found = ws.problems.filter((p) => p.check === CHECK);
    expect(found.every((p) => p.severity === 'warning')).toBe(true);
    expect(found.map((p) => p.record)).toEqual(['RI-D-DR02', 'RI-D-DR03', 'RI-D-DR04', 'RI-D-DR05', 'RI-D-DR06', 'RI-D-DR07']);
  });
});
