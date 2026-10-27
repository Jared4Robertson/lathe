// Domain rules across aggregates: the involves relation from a domain rule to an aggregate, the
// domain-rule-involves check, and the reference's words for them.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildReference, type Workspace } from '../src/index.ts';
import { everyKind, fixture, load, refusals, removeData, withTable } from './helpers.ts';

const CHECK = 'domain-rule-involves';

let ws: Workspace;
beforeAll(async () => {
  // rule-involves: Lending (RI-D) has Loan, Tool and Member; Accounts (RI-E) has Account. DR01 and DR09 sit
  // under Lending and involve two and three of its aggregates; DR08 sits under Tool with no involves.
  ws = await load('rule-involves');
});
afterAll(removeData);

const messagesOf = (id: string) => ws.problems.filter((p) => p.check === CHECK && p.record === id).map((p) => p.message);

describe('the involves relation', () => {
  it('LA-AUT-T109 A domain rule involves aggregates, labeled "Involves" and "Involved in" with no role, and the reference says when', async () => {
    expect(ws.relations.filter((r) => r.relation === 'involves')).toEqual([{
      relation: 'involves', source_kind: 'domain_rule', target_kind: 'aggregate', role: '',
      forward_label: 'Involves', reverse_label: 'Involved in',
      description: expect.stringContaining('holds across this aggregate'),
    }]);
    expect(ws.links.filter((l) => l.source === 'RI-D-DR01')).toEqual([
      { source: 'RI-D-DR01', relation: 'involves', target: 'RI-D-A1' },
      { source: 'RI-D-DR01', relation: 'involves', target: 'RI-D-A2' },
    ]);
    expect(ws.kinds.find((k) => k.kind === 'domain_rule')?.description).toContain('unless it holds across aggregates, when it names them with involves');
    const reference = await buildReference(fixture('rule-involves'));
    const check = reference.checks.find((c) => c.check === CHECK)!;
    expect(check.kinds).toEqual(['domain_rule', 'aggregate']);
    expect(check.explanation).toContain('says with `involves` which aggregates it ties together');
    expect(check.explanation).toContain("a rule across domains is a domain event's job");
  });
});

describe('the domain-rule-involves check', () => {
  it('LA-AUT-T106 A rule under a domain that involves fewer than two aggregates is a warning that says to move a one-aggregate rule onto it; a link to no aggregate is refused', async () => {
    expect(messagesOf('RI-D-DR02')).toEqual([
      'Domain rule RI-D-DR02 sits under the domain RI-D but involves no aggregate; name with involves the two or more '
        + 'aggregates it ties together, or move it under the aggregate it is about.',
    ]);
    const one = 'sits under the domain RI-D but involves only RI-D-A1; a rule about one aggregate belongs under it, so move it '
      + 'under RI-D-A1, or name with involves every aggregate it ties together.';
    expect(messagesOf('RI-D-DR03')).toEqual([`Domain rule RI-D-DR03 ${one}`]);
    expect(messagesOf('RI-D-DR05')).toEqual([`Domain rule RI-D-DR05 ${one}`]);
    // An involves link to a record that is not an aggregate never loads.
    const data = everyKind();
    const problems = await refusals(withTable(data, 'involves', [...data.involves, { source_id: 'TL-LEND-DR02', target_id: 'TL-LEND-A9' }]));
    expect(problems).toEqual([expect.objectContaining({ rule: 'foreign-key', table: 'involves' })]);
    expect(problems[0].message).toContain('"TL-LEND-A9" names no aggregate');
    for (const id of ['RI-D-DR01', 'RI-D-DR09']) expect(messagesOf(id), id).toEqual([]);
  });

  it('LA-AUT-T107 A rule under a domain that involves an aggregate of another domain is a warning that says a rule across domains is a domain event\'s job', () => {
    expect(messagesOf('RI-D-DR04')).toEqual([
      'Domain rule RI-D-DR04 involves RI-E-A1, an aggregate of RI-E, not of its own domain RI-D; a rule across domains is '
        + "a domain event's job, so have one domain raise an event and the other react to it.",
    ]);
  });

  it('LA-AUT-T108 A rule under an aggregate or an entity that uses involves is a warning; one without involves is not', () => {
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
