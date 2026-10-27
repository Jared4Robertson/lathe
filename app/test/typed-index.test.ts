import { describe, expect, it } from 'vitest';
import { buildWorkspace, indexWorkspace, partsOf, textOf } from '../src/specs/data';
import { indexOf } from './fixtures/load';
import { workspace } from './fixtures/workspace';
import { patternWorkspace } from './fixtures/patterns';
import { modelWorkspace } from './fixtures/model';
import { productKindWorkspace } from './fixtures/product-kinds';

// The app's spec index, built from the typed rows GET /api/spec serves.

describe('the index from typed rows', () => {
  it('reads a record per row of each kind table, with its one parent, and its product and domain up the chain', () => {
    const index = indexOf(workspace());
    expect(index.byId.get('DM-SHOP-UC01')).toMatchObject({ kind: 'use_case', parent: 'DM-SHOP-CAP01', product: 'DM', domain: 'DM-SHOP', file: 'data/use_case.jsonl' });
    expect(index.byId.get('DM-SHOP-EP01')).toMatchObject({ parent: 'DM-SHOP-CMD01', product: 'DM', domain: 'DM-SHOP' });
    expect(index.byId.get('DM-SHOP-Q01')).toMatchObject({ parent: 'DM-SHOP', product: 'DM', domain: 'DM-SHOP' });
    expect(index.byId.get('DM-Q01')).toMatchObject({ parent: 'DM', product: 'DM', domain: null });
    expect(index.byId.get('DM')).toMatchObject({ parent: null, product: 'DM', domain: null });
    expect(index.children.get('DM-SHOP-CAP01')!.map((r) => r.id)).toEqual(['DM-SHOP-UC01']);
  });

  it('gives a kind with no owner its product from its ID, and a specification its domain too', () => {
    const index = indexOf(workspace());
    expect(index.byId.get('DM-VO01')).toMatchObject({ kind: 'value_object', parent: null, product: 'DM', domain: null });
    expect(index.byId.get('DM-V01')).toMatchObject({ kind: 'view', parent: null, product: 'DM', domain: null });
    expect(index.byId.get('DM-SHOP-SP01')).toMatchObject({ kind: 'specification', parent: null, product: 'DM', domain: 'DM-SHOP' });
    // What sits under a record with no owner takes its product (and domain) from that record.
    expect(index.byId.get('DM-VO01-C01')).toMatchObject({ parent: 'DM-VO01', product: 'DM', domain: null });
  });

  it('keeps each row typed, and gives each record its file and line', () => {
    const data = workspace();
    const index = indexOf(data);
    const req = index.byId.get('DM-SHOP-UC01-R01')!;
    expect(typeof req.row.statement).toBe('string');
    expect(textOf(req.row, 'statement')).toBe(String(req.row.statement));
    expect(textOf(req.row, 'group_name')).toBe('');
    const rows = data.tables.uc_requirement!;
    expect(req.line).toBe(rows.findIndex((r) => r.id === req.id) + 1);
  });

  it('reads each relation table as links, both ways', () => {
    const index = indexOf(workspace());
    expect(index.outgoing.get('DM-SHOP-UC01-FL-S01')!.map((l) => `${l.relation} ${l.target}`)).toContain('fulfills DM-SHOP-UC01-R01');
    expect(index.incoming.get('DM-SHOP-EV01')!.map((l) => `${l.relation} ${l.source}`)).toEqual(['raises DM-SHOP-CMD01']);
  });

  it('puts part rows under the record that owns them, in key order', () => {
    const index = indexOf(modelWorkspace());
    const fields = partsOf(index, 'P-D-EN03', 'entity_field');
    expect(fields.map((f) => f.position)).toEqual([1, 2, 3, 4]);
    expect(fields.map((f) => f.name)).toEqual(['Loan ID', 'Thing', 'Member', 'Due date']);
    expect(partsOf(index, 'P-D-EN03-TB', 'table_key').map((k) => k.type)).toEqual(['primary', 'unique', 'foreign']);
    const patterns = indexOf(patternWorkspace());
    expect(partsOf(patterns, 'DM-PAT-AUDIT', 'pattern_setting').map((s) => s.name)).toEqual(['retention', 'who']);
  });

  it('reads kinds, stages and relations from the schema, kinds in the schema\'s order', () => {
    const ws = buildWorkspace(workspace());
    const positions = ws.kinds.map((k) => ws.schema.kinds[k.kind].position);
    expect(positions).toEqual([...positions].sort((a, b) => a! - b!));
    expect(ws.kinds.slice(0, 3).map((k) => k.kind)).toEqual(['product', 'domain', 'aggregate']);
    expect(ws.kinds.at(-1)!.kind).toBe('question');
    const requirement = ws.kinds.find((k) => k.kind === 'uc_requirement')!;
    expect(requirement).toMatchObject({ label: 'UC requirement', stage: 'use-cases', parent_kinds: ['use_case'], obligation: true, id_scope: 'parent' });
    expect(requirement.required_fields).toEqual(['statement']);
    expect(ws.kinds.find((k) => k.kind === 'endpoint')!.parent_kinds).toEqual(['command', 'query']);
    expect(ws.kinds.find((k) => k.kind === 'view')).toMatchObject({ parent_kinds: [], id_scope: 'product' });
    expect(ws.stages.map((s) => s.stage)).toEqual(['domain-model', 'use-cases', 'interaction-design', 'technical-specification', 'test-plan']);
    expect(ws.stages[0]).toMatchObject({ label: 'Domain model' });
    expect(ws.relations).toContainEqual(expect.objectContaining({ relation: 'fulfills', source_kind: 'flow_step', target_kind: 'uc_requirement', role: 'design', forward_label: 'Fulfills' }));
  });

  it('gives a product\'s own kind a place after Lathe\'s, with its declared parent', () => {
    const ws = buildWorkspace(productKindWorkspace());
    expect(ws.kinds.at(-1)).toMatchObject({ kind: 'security_control', label: 'Security control', stage: 'interaction-design', parent_kinds: ['endpoint'], obligation: true });
    const index = indexWorkspace(ws);
    expect(index.byId.get('DM-SHOP-EP01-SC01')).toMatchObject({ kind: 'security_control', parent: 'DM-SHOP-EP01', domain: 'DM-SHOP' });
  });
});
