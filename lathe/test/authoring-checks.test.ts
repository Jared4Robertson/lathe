// Authoring's invariants that Lathe's checks (lathe/data/check.jsonl) report when a workspace loads: each starts from
// the complete product, which breaks none of them, and changes one thing to break the rule.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Workspace } from '../src/index.ts';
import { adding, changing, complete, loadData, ofCheck, removeData, without } from './helpers.ts';

afterAll(removeData);

let clean: Workspace;
beforeAll(async () => {
  clean = await loadData(complete());
});

describe("Authoring's invariants kept by checks", () => {
  it('LA-AUT-INV29-T A view, integration, value object, specification or UI component that nothing uses is an error', async () => {
    const unused = ['view-unused', 'integration-unused', 'value-object-unused', 'specification-unused', 'ui-component-unused'];
    for (const check of unused) expect(ofCheck(clean, check), check).toEqual([]);
    let data = without(complete(), 'happens_in', () => true);
    data = without(data, 'exchanges_with', () => true);
    data = without(data, 'checks', () => true);
    data = without(data, 'renders', () => true);
    data = changing(data, 'entity_field', (r) => r.type_value_object_id === 'EX-VO01', { type_value_object_id: undefined, type: 'text' });
    const ws = await loadData(data);
    expect(unused.map((check) => ofCheck(ws, check).map((p) => [p.severity, p.record]))).toEqual([
      [['error', 'EX-V01']],
      [['error', 'EX-INT01']],
      [['error', 'EX-VO01']],
      [['error', 'EX-LEND-SP01']],
      [['error', 'EX-UI01']],
    ]);
    expect(ofCheck(ws, 'value-object-unused')[0].message).toContain('Value object EX-VO01 is used by nothing');
  });

  it("LA-AUT-INV30-T A pattern rule test naming a domain that neither follows the pattern nor has a use case that does is an error", async () => {
    // In the complete product the rule's test names EX-LEND, whose use case EX-LEND-UC02 follows the pattern.
    expect(ofCheck(clean, 'pattern-rule-test-outside-followers')).toEqual([]);
    const outside = adding(complete(), {
      domain: [{ id: 'EX-SHOP', title: 'Shop', product_id: 'EX', subdomain_type: 'supporting' }],
      pattern_rule_test: [{ id: 'EX-PAT-ACT-R01-T02', title: 'In the shop', pattern_rule_id: 'EX-PAT-ACT-R01', domain_id: 'EX-SHOP', level: 'service', state: 'not automated yet' }],
    });
    expect(ofCheck(await loadData(outside), 'pattern-rule-test-outside-followers')).toEqual([
      expect.objectContaining({ severity: 'error', record: 'EX-PAT-ACT-R01-T02', message: expect.stringContaining('which does not follow pattern EX-PAT-ACT') }),
    ]);
    // The domain following the pattern itself is enough.
    const following = adding(outside, { follows: [{ source_id: 'EX-SHOP', target_id: 'EX-PAT-ACT' }] });
    expect(ofCheck(await loadData(following), 'pattern-rule-test-outside-followers')).toEqual([]);
  });

  it('LA-AUT-INV31-T An event a policy hears whose event type is not delivered by outbox is a warning', async () => {
    // In the complete product EX-LEND-EV01, which policy EX-LEND-PO01 hears, is delivered by outbox.
    expect(ofCheck(clean, 'event-not-by-outbox')).toEqual([]);
    const inProcess = changing(complete(), 'event_type', (r) => r.id === 'EX-LEND-EV01-ET', { delivery: 'in process' });
    expect(ofCheck(await loadData(inProcess), 'event-not-by-outbox')).toEqual([
      expect.objectContaining({
        severity: 'warning',
        record: 'EX-LEND-EV01',
        message: 'Domain event EX-LEND-EV01 is heard by policy EX-LEND-PO01, but its event type EX-LEND-EV01-ET is delivered in process; deliver it by outbox.',
      }),
    ]);
  });

  it('LA-AUT-INV32-T A test run at a level its kind does not allow is a warning; one its kind allows is not', async () => {
    expect(ofCheck(clean, 'test-level-not-allowed')).toEqual([]);
    const ws = await loadData(changing(complete(), 'constraint_test', () => true, { level: 'browser' }));
    expect(ofCheck(ws, 'test-level-not-allowed')).toEqual([
      expect.objectContaining({
        severity: 'warning',
        record: 'EX-VO01-C01-T',
        message: 'Constraint test EX-VO01-C01-T runs at level browser, which a constraint test does not allow; run it at unit, integration.',
      }),
    ]);
    expect(ofCheck(await loadData(changing(complete(), 'constraint_test', () => true, { level: 'integration' })), 'test-level-not-allowed')).toEqual([]);
  });
});
