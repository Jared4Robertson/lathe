// Flow steps: the kind, what the store refuses of a step's position, the gap check, what a step may fulfill, and a
// flow's fulfills against its steps'.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Workspace } from '../src/index.ts';
import { everyKind, load, refusals, removeData, withTable } from './helpers.ts';

const recordsOf = (ws: Workspace, check: string) => ws.problems.filter((p) => p.check === check).map((p) => p.record).sort();
const messagesOf = (ws: Workspace, check: string, record: string) =>
  ws.problems.filter((p) => p.check === check && p.record === record).map((p) => p.message).sort();

const STEP_CHECKS = ['step-order', 'flow-step-fulfills-outside-flow', 'flow-fulfills-differs-from-steps'];
const data = everyKind();
const step = data.flow_step[0];

let good: Workspace;
let broken: Workspace;
beforeAll(async () => {
  good = await load('flow-steps-good');
  broken = await load('flow-steps-broken');
});
afterAll(removeData);

describe('flow steps', () => {
  it('LA-AUT-T39 A flow step sits under a flow, needs a position, fulfills obligations and uses views, endpoints and components', () => {
    const kind = good.kinds.find((k) => k.kind === 'flow_step');
    expect(kind).toMatchObject({ parent_kinds: ['flow'], required_fields: ['path', 'position'], obligation: false, stage: 'design' });
    const rules = good.relations.filter((r) => r.source_kind === 'flow_step').map((r) => `${r.relation} ${r.target_kind}`).sort();
    expect(rules).toEqual([
      'fulfills domain_rule', 'fulfills interaction_requirement', 'fulfills pattern_rule', 'fulfills requirement',
      'uses component', 'uses endpoint', 'uses view',
    ]);
    const record = good.records.find((r) => r.id === 'FS-D-F01-S02');
    expect(record).toMatchObject({ kind: 'flow_step', parent: 'FS-D-F01', domain: 'FS-D', fields: { position: 2, path: 'main' } });
    expect(good.links.filter((l) => l.source === 'FS-D-F01-S02').map((l) => `${l.relation} ${l.target}`).sort()).toEqual([
      'fulfills FS-D-DR01', 'fulfills FS-D-E01-R01', 'fulfills FS-D-UC01-R02', 'uses FS-D-C01', 'uses FS-D-E01',
    ]);
  });

  it('LA-AUT-T40 A step position that is not a whole number is refused by the store', async () => {
    for (const position of ['two', 1.5]) {
      const problems = await refusals(withTable(data, 'flow_step', [{ ...step, position }]));
      expect(problems).toEqual([expect.objectContaining({ rule: 'column', file: 'data/flow_step.jsonl', line: 1 })]);
      expect(problems[0].message).toContain('is not a whole number');
    }
  });

  it('LA-AUT-T41 Two steps on one path of a flow with the same position are refused; steps of other flows may share it', async () => {
    const problems = await refusals(withTable(data, 'flow_step', [step, { ...step, id: 'TL-LEND-F01-S02', title: 'Twin' }]));
    expect(problems).toEqual([expect.objectContaining({ rule: 'unique', table: 'flow_step', key: 'TL-LEND-F01-S02' })]);
    // Another path of the same flow may use the position.
    expect(await refusals(withTable(data, 'flow_step', [step, { ...step, id: 'TL-LEND-F01-S02', title: 'Refused', path: 'refused' }]))).toEqual([]);
    // FB-D-F01-S01, FB-D-F02-S01 and FB-D-F03-S01 all have position 1, in three flows.
    expect(recordsOf(broken, 'step-order')).not.toContain('FB-D-F03-S01');
    expect(recordsOf(good, 'step-order')).toEqual([]);
  });

  it('LA-AUT-T42 A step with no position is refused, and a path whose positions skip a number is reported once', async () => {
    const { position: _position, ...without } = step;
    expect(await refusals(withTable(data, 'flow_step', [without]))).toEqual([expect.objectContaining({ rule: 'required', file: 'data/flow_step.jsonl' })]);
    // FB-D-F01's steps have positions 1, 2, 4 and 5: the first step after the gap is reported.
    expect(recordsOf(broken, 'step-order')).toEqual(['FB-D-F01-S04']);
    expect(messagesOf(broken, 'step-order', 'FB-D-F01-S04')).toEqual([
      'Flow step FB-D-F01-S04 has position 4 in flow FB-D-F01, but no step has position 3; number the steps of a flow 1, 2, 3 and so on, with no gaps.',
    ]);
    for (const p of broken.problems.filter((x) => x.check === 'step-order')) expect(p.severity).toBe('error');
  });

  it('LA-AUT-T43 A step that fulfills something its flow does not carry out is a warning naming what it compared', () => {
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

  it("LA-AUT-T44 A step may fulfill its flow's use case requirements, the rules they apply, and interaction requirements reached from them or under the flow", () => {
    // FS-D-F01's steps fulfill a requirement, an applied rule, an endpoint's interaction requirement that
    // fulfills a requirement, and an interaction requirement under the flow; FB-D-F03-S01 likewise.
    expect(recordsOf(good, 'flow-step-fulfills-outside-flow')).toEqual([]);
    expect(recordsOf(broken, 'flow-step-fulfills-outside-flow')).toEqual(['FB-D-F01-S04', 'FB-D-F01-S04', 'FB-D-F01-S04']);
  });

  it('LA-CHK-T30 A step whose flow carries out nothing is not compared, and a link to a missing target is refused by the store', async () => {
    expect(recordsOf(broken, 'flow-step-fulfills-outside-flow')).not.toContain('FB-D-F02-S01');
    const problems = await refusals(withTable(data, 'fulfills', [...data.fulfills, { source_id: step.id, target_id: 'TL-LEND-ZZ99' }]));
    expect(problems).toEqual([expect.objectContaining({ rule: 'foreign-key', table: 'fulfills' })]);
    expect(problems[0].message).toContain('"TL-LEND-ZZ99" names no obligation');
  });

  it('LA-AUT-T45 A flow with steps that fulfills something none of its steps does is a warning', () => {
    expect(recordsOf(broken, 'flow-fulfills-differs-from-steps')).toEqual(['FB-D-F01']);
    expect(messagesOf(broken, 'flow-fulfills-differs-from-steps', 'FB-D-F01')).toEqual([
      'Flow FB-D-F01 fulfills FB-D-DR01, but none of its steps does; move the link onto the step that carries it out.',
    ]);
    expect(broken.problems.find((p) => p.check === 'flow-fulfills-differs-from-steps')?.severity).toBe('warning');
  });

  it("LA-AUT-T46 A flow may repeat or leave out its steps' fulfills, and a flow without steps is not compared", () => {
    // FS-D-F01 repeats one of its steps' links; FB-D-F03 names none; FS-D-F02 has no steps.
    expect(recordsOf(good, 'flow-fulfills-differs-from-steps')).toEqual([]);
    expect(recordsOf(broken, 'flow-fulfills-differs-from-steps')).not.toContain('FB-D-F03');
  });

  it('LA-AUT-T47 A flow written as well-formed steps breaks nothing and raises no step problem', () => {
    expect(good.problems.filter((p) => p.severity === 'error')).toEqual([]);
    expect(good.problems.filter((p) => STEP_CHECKS.includes(p.check))).toEqual([]);
    expect(new Set(broken.problems.filter((p) => STEP_CHECKS.includes(p.check)).map((p) => p.check))).toEqual(new Set(STEP_CHECKS));
  });
});
