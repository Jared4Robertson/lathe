// The Meta model read (LA-PLT-RM08, LA-PLT-QRY11): every kind in reading order with its label, stage and parents, the
// six stages, each relation's pairs with their words both ways, and each table's columns, read from the schema through
// the read model's reader, as the app names and draws every record and field.
import { afterEach, describe, expect, it } from 'vitest';
import { GET_META_MODEL } from '../../../src/platform/meta-model/queries.ts';
import type { MetaModel } from '../../../src/platform/meta-model/read-model.ts';
import { runQuery } from '../../../src/platform/commands/run.ts';
import type { Store } from '../../../src/platform/data/store.ts';
import { closeTwoProducts, twoProducts } from '../../checking/problems/data-set.ts';

afterEach(closeTwoProducts);

const read = async (): Promise<MetaModel> => {
  const store: Store = await twoProducts();
  return runQuery({ schema: store.schema, rows: (t) => store.rows(t), record: (id) => store.record(id) }, GET_META_MODEL, {}) as MetaModel;
};

describe('LA-PRD-UC11-R10-T02 The meta model read gives the kinds in the schema\'s reading order, the stages, the relations\' words and each table\'s columns', () => {
  it('reads the kinds in order, each with its stage, parents and ID scope', async () => {
    const model = await read();
    const kinds = model.kinds.map((k) => k.kind);
    expect(kinds[0]).toBe('product');
    expect(kinds.indexOf('domain')).toBeLessThan(kinds.indexOf('aggregate'));
    expect(kinds.indexOf('aggregate')).toBeLessThan(kinds.indexOf('entity'));
    const positions = model.kinds.map((k) => k.position).filter((p): p is number => p !== null);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(model.kinds.find((k) => k.kind === 'entity')).toMatchObject({ label: 'Entity', stage: 'domain-model', parent_kinds: ['aggregate'], parent_columns: ['aggregate_id'], declared_by: null });
    expect(model.kinds.find((k) => k.kind === 'specification')).toMatchObject({ parent_kinds: [], id_scope: 'domain' });
  });

  it('reads the six stages in order and each relation pair with its words read from both ends', async () => {
    const model = await read();
    expect(model.stages.map((s) => s.stage)).toEqual(['discovery', 'domain-model', 'use-cases', 'interface-design', 'technical-specification', 'test-plan']);
    const fulfills = model.relations.find((r) => r.relation === 'fulfills');
    expect(fulfills).toMatchObject({ source_kind: 'flow_step', target_kind: 'uc_requirement' });
    expect(fulfills?.forward_label).toBeTruthy();
    expect(fulfills?.reverse_label).toBeTruthy();
  });

  it('gives every table but the link tables its columns, a part table\'s and a check\'s among them', async () => {
    const model = await read();
    expect(model.columns.entity.map((c) => c.name)).toContain('aggregate_id');
    expect(model.columns.entity_field.map((c) => c.name)).toContain('type_value_object_id');
    expect(model.columns.check).toBeDefined();
    expect(model.columns.fulfills).toBeUndefined();
  });
});
