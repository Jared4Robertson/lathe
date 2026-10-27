import { describe, expect, it } from 'vitest';
import { buildWorkspace, indexWorkspace, partsOf, textOf } from '../src/specs/data';
import { addRows, indexOf } from './fixtures/load';
import { workspace } from './fixtures/workspace';
import { patternWorkspace } from './fixtures/patterns';
import { entityWorkspace } from './fixtures/entities';
import { obligationWorkspace } from './fixtures/obligations';

// The app's spec index, built from the typed rows GET /api/spec serves.

describe('the index from typed rows', () => {
  it('reads a record per row of each kind table, with its parent from the first parent column that holds a value', () => {
    const data = workspace();
    addRows(data, 'capability', { id: 'DM-SHOP-CAP01', title: 'Filling', domain_id: 'DM-SHOP', position: 1 });
    addRows(data, 'use_case', { id: 'DM-SHOP-UC09', title: 'Under a capability', domain_id: 'DM-SHOP', capability_id: 'DM-SHOP-CAP01' });
    const index = indexOf(data);
    const uc = index.byId.get('DM-SHOP-UC09')!;
    // The capability is nearer than the domain, so it is the parent; the domain is still the record's domain.
    expect(uc).toMatchObject({ kind: 'use_case', parent: 'DM-SHOP-CAP01', product: 'DM', domain: 'DM-SHOP', file: 'data/use_case.jsonl' });
    expect(index.byId.get('DM-SHOP-UC01')).toMatchObject({ parent: 'DM-SHOP', product: 'DM', domain: 'DM-SHOP' });
    expect(index.byId.get('DM')).toMatchObject({ parent: null, product: 'DM', domain: null });
    expect(index.children.get('DM-SHOP-CAP01')!.map((r) => r.id)).toEqual(['DM-SHOP-UC09']);
  });

  it('keeps each row typed, and gives each record its file and line', () => {
    const data = workspace();
    const index = indexOf(data);
    const req = index.byId.get('DM-SHOP-UC01-R01')!;
    expect(typeof req.row.statement).toBe('string');
    expect(textOf(req.row, 'statement')).toBe(String(req.row.statement));
    expect(textOf(req.row, 'group_name')).toBe('');
    const rows = data.tables.requirement!;
    expect(req.line).toBe(rows.findIndex((r) => r.id === req.id) + 1);
  });

  it('reads each relation table as links, both ways', () => {
    const index = indexOf(workspace());
    expect(index.outgoing.get('DM-SHOP-C01')!.map((l) => `${l.relation} ${l.target}`)).toContain('satisfies DM-SHOP-UC01-R01');
    expect(index.incoming.get('DM-SHOP-UC01-R01')!.map((l) => l.source)).toContain('DM-SHOP-T01');
  });

  it('puts part rows under the record that owns them, in key order', () => {
    const index = indexOf(entityWorkspace());
    const fields = partsOf(index, 'P-D-EN03', 'entity_field');
    expect(fields.map((f) => f.position)).toEqual([1, 2, 3]);
    expect(fields.map((f) => f.name)).toEqual(['Loan ID', 'Borrowed at', 'Due date']);
    const patterns = indexOf(patternWorkspace());
    expect(partsOf(patterns, 'DM-PAT-CHECKOUT', 'pattern_setting').map((s) => s.name)).toEqual(['record', 'audit']);
  });

  it('reads kinds, folders and relations from the schema, kinds in the schema\'s order', () => {
    const ws = buildWorkspace(workspace());
    const positions = ws.kinds.map((k) => ws.schema.kinds[k.kind].position);
    expect(positions).toEqual([...positions].sort((a, b) => a! - b!));
    expect(ws.kinds.slice(0, 3).map((k) => k.kind)).toEqual(['product', 'domain', 'capability']);
    expect(ws.kinds.at(-1)!.kind).toBe('question');
    const requirement = ws.kinds.find((k) => k.kind === 'requirement')!;
    expect(requirement).toMatchObject({ label: 'UC requirement', stage: 'define', section: 'use-cases', parent_kinds: ['use_case'], obligation: true, proof_only: false });
    expect(requirement.required_fields).toEqual(['statement']);
    expect(ws.sections[0]).toMatchObject({ stage: 'define', order: 1 });
    expect(ws.relations).toContainEqual(expect.objectContaining({ relation: 'proves', source_kind: 'test', target_kind: 'requirement', role: 'proof', forward_label: 'Proves' }));
  });

  it('gives a product\'s own kind a place after Lathe\'s, with its declared parent', () => {
    const ws = buildWorkspace(obligationWorkspace());
    expect(ws.kinds.at(-1)).toMatchObject({ kind: 'security_control', label: 'Security control', parent_kinds: ['endpoint'], obligation: true });
    const index = indexWorkspace(ws);
    expect(index.byId.get('DM-SHOP-E01-S01')).toMatchObject({ kind: 'security_control', parent: 'DM-SHOP-E01', domain: 'DM-SHOP' });
  });
});
