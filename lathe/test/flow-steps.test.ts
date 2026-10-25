// Flow steps (FORMAT.md section 14): the kind, the order check, what a step may fulfill, and a flow's
// fulfills against its steps'.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadWorkspace, type Workspace } from '../src/index.ts';

const fixture = (name: string) => path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', name);
const recordsOf = (ws: Workspace, check: string) => ws.problems.filter((p) => p.check === check).map((p) => p.record).sort();
const messagesOf = (ws: Workspace, check: string, record: string) =>
  ws.problems.filter((p) => p.check === check && p.record === record).map((p) => p.message).sort();

const STEP_CHECKS = ['flow-step-order', 'flow-step-fulfills-outside-flow', 'flow-fulfills-differs-from-steps'];

let good: Workspace;
let broken: Workspace;
beforeAll(async () => {
  good = await loadWorkspace(fixture('flow-steps-good'));
  broken = await loadWorkspace(fixture('flow-steps-broken'));
});

describe('flow steps', () => {
  it('LA-AUT-T41 A flow step sits under a flow, needs an order, fulfills obligations and uses views, endpoints and components', () => {
    const kind = good.kinds.find((k) => k.kind === 'flow_step');
    expect(kind).toMatchObject({ parent_kinds: ['flow'], required_fields: ['order'], obligation: false, stage: 'design' });
    const rules = good.relations.filter((r) => r.source_kind === 'flow_step').map((r) => `${r.relation} ${r.target_kind}`).sort();
    expect(rules).toEqual([
      'fulfills domain_rule', 'fulfills interaction_requirement', 'fulfills pattern_rule', 'fulfills requirement',
      'uses component', 'uses endpoint', 'uses view',
    ]);
    const step = good.records.find((r) => r.id === 'FS-D-F01-S02');
    expect(step).toMatchObject({ kind: 'flow_step', parent: 'FS-D-F01', domain: 'FS-D', fields: { order: '2' } });
    expect(good.links.filter((l) => l.source === 'FS-D-F01-S02').map((l) => `${l.relation} ${l.target}`)).toEqual([
      'uses FS-D-E01', 'uses FS-D-C01', 'fulfills FS-D-UC01-R02', 'fulfills FS-D-DR01', 'fulfills FS-D-E01-R01',
    ]);
  });

  it('LA-AUT-T42 A step order that is not a whole number is an error', () => {
    expect(messagesOf(broken, 'flow-step-order', 'FB-D-F01-S02')).toEqual([
      'Flow step FB-D-F01-S02 has order "two", which is not a whole number such as 1 or 2.',
    ]);
    for (const p of broken.problems.filter((x) => x.check === 'flow-step-order')) expect(p.severity).toBe('error');
  });

  it('LA-AUT-T43 Two steps of one flow with the same order are an error, 1 and 01 alike; steps of other flows may share it', () => {
    expect(recordsOf(broken, 'flow-step-order')).toEqual(['FB-D-F01-S01', 'FB-D-F01-S02', 'FB-D-F01-S03']);
    expect(messagesOf(broken, 'flow-step-order', 'FB-D-F01-S01')).toEqual([
      'Flow step FB-D-F01-S01 has order 1 in flow FB-D-F01, the same as FB-D-F01-S03; each step of a flow needs its own order.',
    ]);
    // FB-D-F02-S01 and FB-D-F03-S01 also have order 1, in other flows.
    expect(recordsOf(broken, 'flow-step-order')).not.toContain('FB-D-F03-S01');
    expect(recordsOf(good, 'flow-step-order')).toEqual([]);
  });

  it('LA-AUT-T44 A step with no order is reported once, as a missing required field', () => {
    expect(recordsOf(broken, 'missing-required-field')).toEqual(['FB-D-F01-S05']);
    expect(broken.problems.filter((p) => p.record === 'FB-D-F01-S05').map((p) => p.check)).toEqual(['missing-required-field']);
  });

  it('LA-AUT-T45 A step that fulfills something its flow does not carry out is a warning naming what it compared', () => {
    const messages = messagesOf(broken, 'flow-step-fulfills-outside-flow', 'FB-D-F01-S04');
    expect(messages.map((m) => m.split(',')[0])).toEqual([
      'Flow step FB-D-F01-S04 fulfills FB-D-DR02',
      'Flow step FB-D-F01-S04 fulfills FB-D-E01-R01',
      'Flow step FB-D-F01-S04 fulfills FB-D-UC02-R01',
    ]);
    expect(messages[0]).toContain('which its flow FB-D-F01 does not carry out');
    expect(messages[0]).toContain('a use case the flow carries out (FB-D-UC01)');
    expect(messages[0]).toContain('a domain rule one of them applies');
    expect(messages[0]).toContain('nor a rule of a pattern one of them or the domain follows');
    expect(messages[0]).toContain('an interaction requirement that fulfills any of these or sits under the flow');
    for (const p of broken.problems.filter((x) => x.check === 'flow-step-fulfills-outside-flow')) expect(p.severity).toBe('warning');
  });

  it("LA-AUT-T46 A step may fulfill its flow's use case requirements, the rules they apply, and interaction requirements reached from them or under the flow", () => {
    // FS-D-F01's steps fulfill a requirement, an applied rule, an endpoint's interaction requirement that
    // fulfills a requirement, and an interaction requirement under the flow; FB-D-F03-S01 likewise.
    expect(recordsOf(good, 'flow-step-fulfills-outside-flow')).toEqual([]);
    expect(recordsOf(broken, 'flow-step-fulfills-outside-flow')).toEqual(['FB-D-F01-S04', 'FB-D-F01-S04', 'FB-D-F01-S04']);
  });

  it('LA-CHK-T30 A step whose flow carries out nothing is not compared, and a missing target is only a dangling link', () => {
    expect(recordsOf(broken, 'flow-step-fulfills-outside-flow')).not.toContain('FB-D-F02-S01');
    expect(messagesOf(broken, 'flow-step-fulfills-outside-flow', 'FB-D-F01-S04').join(' ')).not.toContain('FB-D-ZZ99');
    expect(messagesOf(broken, 'dangling-link', 'FB-D-F01-S04')).toEqual(['FB-D-F01-S04 fulfills FB-D-ZZ99, which does not exist.']);
  });

  it('LA-AUT-T47 A flow with steps that fulfills something none of its steps does is a warning', () => {
    expect(recordsOf(broken, 'flow-fulfills-differs-from-steps')).toEqual(['FB-D-F01']);
    expect(messagesOf(broken, 'flow-fulfills-differs-from-steps', 'FB-D-F01')).toEqual([
      'Flow FB-D-F01 fulfills FB-D-DR01, but none of its steps does; move the link onto the step that carries it out.',
    ]);
    expect(broken.problems.find((p) => p.check === 'flow-fulfills-differs-from-steps')?.severity).toBe('warning');
  });

  it("LA-AUT-T48 A flow may repeat or leave out its steps' fulfills, and a flow without steps is not compared", () => {
    // FS-D-F01 repeats one of its steps' links; FB-D-F03 names none; FS-D-F02 has no steps.
    expect(recordsOf(good, 'flow-fulfills-differs-from-steps')).toEqual([]);
    expect(recordsOf(broken, 'flow-fulfills-differs-from-steps')).not.toContain('FB-D-F03');
  });

  it('LA-AUT-T49 A flow written as well-formed steps breaks nothing and raises no step problem', () => {
    expect(good.problems.filter((p) => p.severity === 'error')).toEqual([]);
    expect(good.problems.filter((p) => STEP_CHECKS.includes(p.check))).toEqual([]);
    expect(new Set(broken.problems.filter((p) => STEP_CHECKS.includes(p.check)).map((p) => p.check))).toEqual(new Set(STEP_CHECKS));
  });
});
