// Entities and the ERD (FORMAT.md section 17): the entity kind and its three relations, the Fields table read
// into entityFields, and the checks entity-role, aggregate-root, entity-fields, has-crosses-aggregate and
// entity-unreferenced.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadWorkspace, type Workspace } from '../src/index.ts';
import { readFieldsTable } from '../src/parse.ts';

const fixture = (name: string) => path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', name);
const ofCheck = (ws: Workspace, check: string) => ws.problems.filter((p) => p.check === check);
const recordsOf = (ws: Workspace, check: string) => ofCheck(ws, check).map((p) => p.record);
const ENTITY_CHECKS = ['entity-role', 'aggregate-root', 'entity-fields', 'has-crosses-aggregate', 'entity-unreferenced'];

let good: Workspace;
let broken: Workspace;
beforeAll(async () => {
  // entities-good: EN-D-A1 holds root EN-D-EN01, which has_many EN-D-EN02, which has_one EN-D-EN03;
  // EN-D-EN01 refers_to EN-E-EN01 in another domain. entities-broken: each entity check fails.
  good = await loadWorkspace(fixture('entities-good'));
  broken = await loadWorkspace(fixture('entities-broken'));
});

describe('the meta-model', () => {
  it('LA-CHK-T290 An entity sits under an aggregate in the domain model, needs a role, and links to entities by has_one, has_many and refers_to', () => {
    expect(good.kinds.find((k) => k.kind === 'entity')).toMatchObject({
      stage: 'define', section: 'domain-model', parent_kinds: ['aggregate'], required_fields: ['role'], obligation: false,
    });
    const entityLinks = good.relations.filter((r) => r.source_kind === 'entity').map((r) => [r.relation, r.target_kind]);
    expect(entityLinks).toEqual([['has_one', 'entity'], ['has_many', 'entity'], ['refers_to', 'entity']]);
    expect(good.links.filter((l) => l.source === 'EN-D-EN01')).toEqual([
      { source: 'EN-D-EN01', relation: 'has_many', target: 'EN-D-EN02' },
      { source: 'EN-D-EN01', relation: 'refers_to', target: 'EN-E-EN01' },
    ]);
  });
});

describe('the Fields table', () => {
  it('LA-CHK-T291 An entity\'s Fields table is read into entityFields in table order; other kinds have none', () => {
    const fields = (id: string) => good.records.find((r) => r.id === id)?.entityFields;
    // The heading and table inside a fenced code block, and the table under the later Notes heading, are not read.
    expect(fields('EN-D-EN01')).toEqual([
      { field: 'Loan ID', meaning: "The loan's identity.", kind: 'Text', example: '`L-1`' },
      { field: 'Due at', meaning: 'When the loan should end.', kind: 'Date and time', example: '2026-03-16' },
      // An escaped pipe stays in its cell.
      { field: 'Status', meaning: 'Where the loan is.', kind: 'One of `open | closed`', example: 'open' },
      { field: 'Note', meaning: 'A pipe kept by escaping.', kind: 'Text: a | b', example: 'a | b' },
    ]);
    // A row with fewer cells than the columns is read with the missing cells empty.
    expect(fields('EN-D-EN03')?.[1]).toEqual({ field: 'Short', meaning: 'A row with fewer cells.', kind: 'Text', example: '' });
    expect(good.records.filter((r) => r.kind !== 'entity').every((r) => r.entityFields === undefined)).toBe(true);
  });

  it('LA-CHK-T292 A Fields table with the wrong columns gives no fields; prose may sit between the heading and the table', () => {
    expect(broken.records.find((r) => r.id === 'EB-D-EN05')?.entityFields).toEqual([]);
    expect(readFieldsTable('## Fields\n\nSome prose.\n\n| field | MEANING | Kind of value | Example |\n|---|---|---|---|\n| a | b | c | d |')).toEqual({
      heading: true, columns: ['field', 'MEANING', 'Kind of value', 'Example'], rows: [['a', 'b', 'c', 'd']],
    });
    expect(readFieldsTable('## Fields\n\n## Other\n\n| a | b |\n|---|---|')).toEqual({ heading: true, columns: null, rows: [] });
    expect(readFieldsTable('No heading.')).toEqual({ heading: false, columns: null, rows: [] });
  });
});

describe('entity checks', () => {
  it('LA-CHK-T293 A role other than root or child is an entity-role error; letter case does not matter, and a missing role is only missing-required-field', () => {
    expect(ofCheck(broken, 'entity-role')).toEqual([{
      severity: 'error',
      check: 'entity-role',
      record: 'EB-D-EN02',
      message: 'Entity EB-D-EN02 has role "leaf"; set role to root, for the aggregate\'s root record, or child, for one of its parts.',
    }]);
    // EN-E-EN01 is ROOT and EN-D-EN03 is Child.
    expect(ofCheck(good, 'entity-role')).toEqual([]);
    expect(recordsOf(broken, 'missing-required-field')).toEqual(['EB-D-EN22']);
  });

  it('LA-CHK-T294 An aggregate with entities and no root, or more than one, is an aggregate-root error naming the fix', () => {
    expect(ofCheck(broken, 'aggregate-root')).toEqual([
      {
        severity: 'error', check: 'aggregate-root', record: 'EB-D-A2',
        message: 'Aggregate EB-D-A2 has 2 root entities, EB-D-EN11, EB-D-EN12; keep one as root and set role: child on the others.',
      },
      {
        severity: 'error', check: 'aggregate-root', record: 'EB-D-A3',
        message: 'Aggregate EB-D-A3 has entities but no root; set role: root on the entity the aggregate is named for.',
      },
    ]);
    // EN-E-A2 has no entities, so it needs no root.
    expect(recordsOf(good, 'aggregate-root')).toEqual([]);
  });

  it('LA-CHK-T295 A missing Fields table, wrong columns, a repeated field or a row with no field name is an entity-fields error', () => {
    const found = ofCheck(broken, 'entity-fields');
    expect(found.every((p) => p.severity === 'error')).toBe(true);
    expect(found.map((p) => [p.record, p.message])).toEqual([
      // A "## Fieldz" heading is not a Fields heading.
      ['EB-D-EN04', expect.stringContaining('has no ## Fields table; add a "## Fields" heading with a table of the columns Field, Meaning, Kind of value and Example')],
      // Wrong columns are reported alone: the table's repeated field is not.
      ['EB-D-EN05', "Entity EB-D-EN05's Fields table has the columns Field, Business meaning, Kind of value, Example; use the columns Field, Meaning, Kind of value and Example, in that order."],
      ['EB-D-EN11', "Entity EB-D-EN11's Fields table has no field name in row 4; name the field, or remove the row."],
      // Name, `name` and NAME are one field name.
      ['EB-D-EN11', 'Entity EB-D-EN11\'s Fields table lists the field "Name" 3 times, in rows 1, 2, 3; name each field once.'],
      // A table under a later heading does not count.
      ['EB-D-EN13', expect.stringContaining('has a ## Fields heading but no table under it')],
    ]);
  });

  it('LA-CHK-T296 has_one or has_many to an entity in another aggregate is a has-crosses-aggregate error; refers_to may cross aggregates and domains', () => {
    expect(ofCheck(broken, 'has-crosses-aggregate')).toEqual([{
      severity: 'error',
      check: 'has-crosses-aggregate',
      record: 'EB-D-EN01',
      message: 'Entity EB-D-EN01 has_many EB-D-EN11, which sits in EB-D-A2, not in EB-D-A1; a part belongs to its aggregate, so use refers_to, or move EB-D-EN11 into EB-D-A1.',
    }]);
    // EB-D-EN01 also refers_to EB-D-EN12 in EB-D-A2, and EN-D-EN01 refers_to EN-E-EN01 in another domain.
    expect(ofCheck(good, 'has-crosses-aggregate')).toEqual([]);
  });

  it('LA-CHK-T297 A child entity its root does not reach by has_one or has_many is an entity-unreferenced warning', () => {
    const found = ofCheck(broken, 'entity-unreferenced');
    // EN03 nothing reaches; EN06 is reached only from EN03; EN04 only refers to the root. EN05 is reached.
    // EB-D-A2 has two roots and EB-D-A3 none, so their children are not judged.
    expect(found.map((p) => p.record)).toEqual(['EB-D-EN03', 'EB-D-EN04', 'EB-D-EN06']);
    expect(found.every((p) => p.severity === 'warning')).toBe(true);
    expect(found[0].message).toBe(
      "Child entity EB-D-EN03 is not reached from EB-D-A1's root EB-D-EN01 by has_one or has_many; link it from EB-D-EN01 or from the child it is a part of.",
    );
    // EN-D-EN03 is reached through EN-D-EN02.
    expect(ofCheck(good, 'entity-unreferenced')).toEqual([]);
  });

  it('LA-CHK-T298 A well-formed domain model with entities gives no problems, and each entity check fails on its own fixture', () => {
    expect(good.problems).toEqual([]);
    expect(new Set(broken.problems.filter((p) => ENTITY_CHECKS.includes(p.check)).map((p) => p.check))).toEqual(new Set(ENTITY_CHECKS));
  });
});
