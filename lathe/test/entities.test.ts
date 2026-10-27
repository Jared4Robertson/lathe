// Entities and the ERD: the entity kind and its three relations, its entity_field rows, what the store refuses (a role
// other than root or child, an aggregate without exactly one root, a field without a name, a field named twice), and
// the checks entity-fields, has-crosses-aggregate and entity-unreferenced.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Workspace } from '../src/index.ts';
import { everyKind, load, ofCheck, refusals, removeData, withTable } from './helpers.ts';

const recordsOf = (ws: Workspace, check: string) => ofCheck(ws, check).map((p) => p.record);
const ENTITY_CHECKS = ['entity-fields', 'has-crosses-aggregate', 'entity-unreferenced'];
const data = everyKind();

let good: Workspace;
let broken: Workspace;
beforeAll(async () => {
  // entities-good: EN-D-A1 holds root EN-D-EN01, which has_many EN-D-EN02, which has_one EN-D-EN03;
  // EN-D-EN01 refers_to EN-E-EN01 in another domain. entities-broken: each entity check fails.
  good = await load('entities-good');
  broken = await load('entities-broken');
});
afterAll(removeData);

describe('the schema', () => {
  it('LA-AUT-T69 An entity sits under an aggregate in the domain model, needs a role, and links to entities by has_one, has_many and refers_to', () => {
    expect(good.kinds.find((k) => k.kind === 'entity')).toMatchObject({
      stage: 'define', section: 'domain-model', parent_kinds: ['aggregate'], required_fields: ['role'], obligation: false,
    });
    const entityLinks = good.relations.filter((r) => r.source_kind === 'entity').map((r) => [r.relation, r.target_kind]);
    expect(entityLinks).toEqual([['has_many', 'entity'], ['has_one', 'entity'], ['refers_to', 'entity']]);
    expect(good.links.filter((l) => l.source === 'EN-D-EN01')).toEqual([
      { source: 'EN-D-EN01', relation: 'has_many', target: 'EN-D-EN02' },
      { source: 'EN-D-EN01', relation: 'refers_to', target: 'EN-E-EN01' },
    ]);
  });
});

describe('entity fields', () => {
  it("LA-AUT-T70 An entity's fields are its entity_field rows, in position order; other kinds have none", () => {
    const fields = (id: string) => good.records.find((r) => r.id === id)?.parts.entity_field;
    expect(fields('EN-D-EN01')?.map(({ name, meaning, type, example }) => ({ name, meaning, type, example }))).toEqual([
      { name: 'Loan ID', meaning: "The loan's identity.", type: 'Text', example: '`L-1`' },
      { name: 'Due at', meaning: 'When the loan should end.', type: 'Date and time', example: '2026-03-16' },
      { name: 'Status', meaning: 'Where the loan is.', type: 'One of `open | closed`', example: 'open' },
      { name: 'Note', meaning: 'A pipe kept by escaping.', type: 'Text: a | b', example: 'a | b' },
    ]);
    // An example is optional.
    expect(fields('EN-D-EN03')?.[1]).toEqual({ entity_id: 'EN-D-EN03', position: 2, name: 'Short', meaning: 'A row with fewer cells.', type: 'Text' });
    expect(good.records.filter((r) => r.kind !== 'entity').every((r) => r.parts.entity_field === undefined)).toBe(true);
  });

  it('LA-AUT-T71 A field needs a name, a meaning and a type, and a name once per entity: the store refuses the rest', async () => {
    const [field] = data.entity_field;
    for (const column of ['name', 'meaning', 'type']) {
      const { [column]: _gone, ...without } = field;
      expect(await refusals(withTable(data, 'entity_field', [without])), column).toEqual([expect.objectContaining({ rule: 'required', file: 'data/entity_field.jsonl' })]);
    }
    expect(await refusals(withTable(data, 'entity_field', [{ ...field, name: '' }]))).toEqual([expect.objectContaining({ rule: 'column', file: 'data/entity_field.jsonl' })]);
    const twice = await refusals(withTable(data, 'entity_field', [field, { ...field, position: 2 }]));
    expect(twice).toEqual([expect.objectContaining({ rule: 'unique', table: 'entity_field' })]);
    expect(twice[0].message).toContain('the same entity_id, name');
  });
});

describe('entity rules', () => {
  it('LA-AUT-T72 A role other than root or child, or none, is refused by the store', async () => {
    const [root] = data.entity;
    for (const role of ['leaf', 'ROOT']) {
      const problems = await refusals(withTable(data, 'entity', [{ ...root, role }, ...data.entity.slice(1)]));
      expect(problems).toEqual([expect.objectContaining({ rule: 'column', file: 'data/entity.jsonl', line: 1 })]);
      expect(problems[0].message).toContain('is not one of root, child');
    }
    const { role: _role, ...without } = root;
    expect(await refusals(withTable(data, 'entity', [without, ...data.entity.slice(1)]))).toEqual([expect.objectContaining({ rule: 'required', file: 'data/entity.jsonl' })]);
  });

  it('LA-AUT-T73 An aggregate with entities and no root, or more than one, is refused by the store', async () => {
    const [root, child] = data.entity;
    const two = await refusals(withTable(data, 'entity', [root, { ...child, role: 'root' }]));
    expect(two).toEqual([expect.objectContaining({ rule: 'aggregate-root', table: 'aggregate', key: 'TL-LEND-A1' })]);
    expect(two[0].message).toContain('has 2 root entities');
    const none = await refusals(withTable(data, 'entity', [{ ...root, role: 'child' }, child]));
    expect(none).toEqual([expect.objectContaining({ rule: 'aggregate-root', key: 'TL-LEND-A1' })]);
    expect(none[0].message).toContain('has 0 root entities');
    // EN-E-A2 has no entities, so it needs no root.
    expect(good.records.find((r) => r.id === 'EN-E-A2')).toBeDefined();
  });

  it('LA-AUT-T74 An entity that lists no fields is an entity-fields error', () => {
    const found = ofCheck(broken, 'entity-fields');
    expect(found).toEqual([{
      severity: 'error', check: 'entity-fields', record: 'EB-D-EN04',
      message: 'Entity EB-D-EN04 lists no fields; add the fields it keeps, each with its meaning and type.',
    }]);
  });

  it('LA-AUT-T75 has_one or has_many to an entity in another aggregate is a has-crosses-aggregate error; refers_to may cross aggregates and domains', () => {
    expect(ofCheck(broken, 'has-crosses-aggregate')).toEqual([{
      severity: 'error',
      check: 'has-crosses-aggregate',
      record: 'EB-D-EN01',
      message: 'Entity EB-D-EN01 has_many EB-D-EN11, which sits in EB-D-A2, not in EB-D-A1; a part belongs to its aggregate, so use refers_to, or move EB-D-EN11 into EB-D-A1.',
    }]);
    // EB-D-EN01 also refers_to EB-D-EN12 in EB-D-A2, and EN-D-EN01 refers_to EN-E-EN01 in another domain.
    expect(ofCheck(good, 'has-crosses-aggregate')).toEqual([]);
  });

  it('LA-AUT-T76 A child entity its root does not reach by has_one or has_many is an entity-unreferenced warning', () => {
    const found = ofCheck(broken, 'entity-unreferenced');
    // EN03 nothing reaches; EN06 is reached only from EN03; EN04 only refers to the root. EN05 is reached, and so is
    // EB-D-EN12 from its own root, though EB-D-EN01 reaches into its aggregate.
    expect(found.map((p) => p.record)).toEqual(['EB-D-EN03', 'EB-D-EN04', 'EB-D-EN06']);
    expect(found.every((p) => p.severity === 'warning')).toBe(true);
    expect(found[0].message).toBe(
      "Child entity EB-D-EN03 is not reached from EB-D-A1's root EB-D-EN01 by has_one or has_many; link it from EB-D-EN01 or from the child it is a part of.",
    );
    // EN-D-EN03 is reached through EN-D-EN02.
    expect(ofCheck(good, 'entity-unreferenced')).toEqual([]);
  });

  it('LA-AUT-T77 A well-formed domain model with entities gives no problems, and each entity check fails on its own fixture', () => {
    expect(good.problems).toEqual([]);
    expect(new Set(broken.problems.filter((p) => ENTITY_CHECKS.includes(p.check)).map((p) => p.check))).toEqual(new Set(ENTITY_CHECKS));
    expect(recordsOf(broken, 'entity-fields')).toEqual(['EB-D-EN04']);
  });
});
