// The stage domains' rules that Lathe's checks (lathe/data/check.jsonl) report when a workspace loads: each starts from the
// complete product, which breaks none of them, and changes one thing to break the rule.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Workspace } from '../src/index.ts';
import { changing, complete, loadData, ofCheck, removeData, without } from './helpers.ts';

afterAll(removeData);

let clean: Workspace;
beforeAll(async () => {
  clean = await loadData(complete());
});

describe("The stage domains' rules kept by checks", () => {
  it('LA-IXD-UC18-R05-T02 A view, integration, value object, specification or UI component that nothing uses is an error', async () => {
    const unused = ['view-unused', 'integration-unused', 'value-object-unused', 'specification-unused', 'ui-component-unused'];
    for (const check of unused) expect(ofCheck(clean, check), check).toEqual([]);
    let data = without(complete(), 'presents', () => true);
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

  it('LA-CHK-UC01-R09-T02 A test run at a level its kind does not allow is a warning; one its kind allows is not', async () => {
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
