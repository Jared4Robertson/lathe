import { describe, expect, it } from 'vitest';
import { recordIndexOf } from './read-view';
import { workspace } from './fixtures/workspace';
import { productKindWorkspace } from './fixtures/product-kinds';

// The space's record index (app/src/exploring/record-summaries/record-index.ts), built from the space's reads: the
// record summaries (list-record-summaries), the meta model (get-meta-model), the folder tree, problems and coverage,
// each answered by its own query over the served data.

describe('LA-EXP-UC02-R08-T03 the space\'s record index, from the record summaries and the meta model', () => {
  it('reads a record per row of each kind table, with its one parent, and its product and domain up the chain', () => {
    const index = recordIndexOf(workspace(), 'DM');
    expect(index.byId.get('DM-SHOP-UC01')).toMatchObject({ kind: 'use_case', parent: 'DM-SHOP-CAP01', product: 'DM', domain: 'DM-SHOP', file: 'use_case.jsonl' });
    expect(index.byId.get('DM-SHOP-EP01')).toMatchObject({ parent: 'DM-SHOP-CMD01', product: 'DM', domain: 'DM-SHOP' });
    expect(index.byId.get('DM-SHOP-Q01')).toMatchObject({ parent: 'DM-SHOP', product: 'DM', domain: 'DM-SHOP' });
    expect(index.byId.get('DM-Q01')).toMatchObject({ parent: 'DM', product: 'DM', domain: null });
    expect(index.byId.get('DM')).toMatchObject({ parent: null, product: 'DM', domain: null });
    expect(index.children.get('DM-SHOP-CAP01')!.map((r) => r.id)).toEqual(['DM-SHOP-UC01']);
  });

  it('gives a kind with no owner its product from its ID, and a specification its domain too', () => {
    const index = recordIndexOf(workspace(), 'DM');
    expect(index.byId.get('DM-VO01')).toMatchObject({ kind: 'value_object', parent: null, product: 'DM', domain: null });
    expect(index.byId.get('DM-V01')).toMatchObject({ kind: 'view', parent: null, product: 'DM', domain: 'DM-SHOP' });
    expect(index.byId.get('DM-SHOP-SP01')).toMatchObject({ kind: 'specification', parent: null, product: 'DM', domain: 'DM-SHOP' });
    expect(index.byId.get('DM-VO01-C01')).toMatchObject({ parent: 'DM-VO01', product: 'DM', domain: null });
  });

  it('holds no column of a record beyond its summary, and gives each its data file and line', () => {
    const data = workspace();
    const req = recordIndexOf(data, 'DM').byId.get('DM-SHOP-UC01-R01')!;
    expect(Object.keys(req).sort()).toEqual(['digest', 'domain', 'file', 'group', 'id', 'kind', 'level', 'line', 'names', 'parent', 'product', 'testState', 'title']);
    const rows = data.sources[0].tables.uc_requirement!;
    expect(req.line).toBe(rows.findIndex((r) => r.id === req.id) + 1);
  });

  it('reads each relation table as links, both ways', () => {
    const index = recordIndexOf(workspace(), 'DM');
    expect(index.outgoing.get('DM-SHOP-UC01-FL-S01')!.map((l) => `${l.relation} ${l.target}`)).toContain('fulfills DM-SHOP-UC01-R01');
    expect(index.incoming.get('DM-SHOP-EV01')!.map((l) => `${l.relation} ${l.source}`)).toEqual(['raises DM-SHOP-CMD01']);
  });
});

describe('LA-AUT-UC08-R05-T01 the meta model gives kinds, stages and relations from the schema, kinds in the schema\'s order', () => {
  it('reads kinds in order, with their stage, parents and ID scope', () => {
    const { meta } = recordIndexOf(workspace(), 'DM');
    const kinds = meta.kindList;
    const positions = kinds.map((k) => k.position);
    expect(positions).toEqual([...positions].sort((a, b) => a! - b!));
    expect(kinds.slice(0, 3).map((k) => k.kind)).toEqual(['product', 'business_outcome', 'domain']);
    expect(kinds.at(-1)!.kind).toBe('question');
    expect(meta.kinds.get('uc_requirement')).toMatchObject({ label: 'UC requirement', stage: 'use-cases', parent_kinds: ['use_case'], obligation: true, id_scope: 'parent' });
    expect(meta.kinds.get('endpoint')!.parent_kinds).toEqual(['command', 'query']);
    expect(meta.kinds.get('view')).toMatchObject({ parent_kinds: [], id_scope: 'product' });
    expect(meta.stages.map((s) => s.stage)).toEqual(['discovery', 'domain-model', 'use-cases', 'interaction-design', 'technical-specification', 'test-plan']);
    expect(meta.stages[0]).toMatchObject({ label: 'Discovery' });
    expect(meta.relations).toContainEqual(expect.objectContaining({ relation: 'fulfills', source_kind: 'flow_step', target_kind: 'uc_requirement', role: 'design', forward_label: 'Fulfills' }));
    expect(meta.columns.uc_requirement.map((c) => c.name)).toContain('statement');
  });

  it('gives a product\'s own kind a place after Lathe\'s, with its declared parent and its product', () => {
    const index = recordIndexOf(productKindWorkspace(), 'DM');
    expect(index.meta.kindList.at(-1)).toMatchObject({ kind: 'security_control', label: 'Security control', stage: 'interaction-design', parent_kinds: ['endpoint'], obligation: true, declared_by: 'DM' });
    expect(index.byId.get('DM-SHOP-EP01-SC01')).toMatchObject({ kind: 'security_control', parent: 'DM-SHOP-EP01', domain: 'DM-SHOP' });
  });
});
