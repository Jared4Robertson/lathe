// Authoring's rules the store keeps: invariants and a specification the schema's keys, foreign keys and checks, and
// the store's own declaration and validation rules, refuse when the data loads; and the Next ID domain service.
import { afterAll, describe, expect, it } from 'vitest';
import { nextId } from '../../src/cli/operations.ts';
import { openStore, type Row, type StoreProblem } from '../../src/index.ts';
import { refusals } from '../helpers.ts';
import { everyKind, removeData, writeData, type Data } from './fixture.ts';

afterAll(removeData);

/** The fixture with rows added to some tables. */
function adding(rows: Data, data: Data = everyKind()): Data {
  for (const [table, added] of Object.entries(rows)) data[table] = [...(data[table] ?? []), ...added];
  return data;
}

/** The fixture with one row of a table changed; a change to undefined leaves the column out. */
function changingRow(table: string, at: number, changes: Record<string, Row[string] | undefined>, data: Data = everyKind()): Data {
  const row = Object.fromEntries(Object.entries({ ...data[table][at], ...changes }).filter(([, v]) => v !== undefined)) as Row;
  return { ...data, [table]: data[table].map((r, i) => (i === at ? row : r)) };
}

const one = (rule: string, extra: Partial<StoreProblem> = {}) => [expect.objectContaining({ rule, ...extra })];

/** A second domain of the fixture's product. */
const catalog: Data = { domain: [{ id: 'TL-CAT', title: 'Catalog', product_id: 'TL', subdomain_type: 'supporting' }] };

describe("Authoring's invariants", () => {
  it('LA-AUT-INV17-T Two capabilities in one domain with the same position are refused; other domains may reuse it', async () => {
    const problems = await refusals(adding({ capability: [{ id: 'TL-LEND-CAP02', title: 'Returns', domain_id: 'TL-LEND', position: 1 }] }));
    expect(problems).toEqual(one('unique', { table: 'capability', key: 'TL-LEND-CAP02', file: 'data/capability.jsonl', line: 2 }));
    expect(problems[0].message).toBe('capability TL-LEND-CAP02 has the same domain_id, position as capability TL-LEND-CAP01: TL-LEND, 1');
    // Another domain's capability at position 1, and this domain's next one at 2, load.
    expect(
      await refusals(
        adding({
          ...catalog,
          capability: [
            { id: 'TL-CAT-CAP01', title: 'Listing', domain_id: 'TL-CAT', position: 1 },
            { id: 'TL-LEND-CAP02', title: 'Returns', domain_id: 'TL-LEND', position: 2 },
          ],
        }),
      ),
    ).toEqual([]);
  });

  it("LA-AUT-INV19-T A pattern rule's setting or applies-when setting its pattern lacks, or an applies-when given in part, is refused by the store", async () => {
    const lacking = await refusals(changingRow('pattern_rule', 0, { applies_when_setting: 'tone' }));
    expect(lacking).toEqual(one('foreign-key', { table: 'pattern_rule', file: 'data/pattern_rule.jsonl', line: 1 }));
    expect(lacking[0].message).toContain('applies_when_setting "tone"');
    expect(await refusals(changingRow('pattern_rule', 0, { setting: 'tone' }))).toEqual(one('foreign-key', { table: 'pattern_rule', message: expect.stringContaining('setting "tone"') }));
    // A condition is its setting, whether it is negated and its value: all three or none.
    for (const left of ['applies_when_setting', 'applies_when_negated', 'applies_when_value']) {
      const part = await refusals(changingRow('pattern_rule', 0, { [left]: undefined }));
      expect(part, left).toEqual(one('check', { table: 'pattern_rule', file: 'data/pattern_rule.jsonl', line: 1, message: expect.stringContaining('applies_when_setting IS NULL') }));
    }
    // The fixture's rule (setting and whole condition on its pattern's setting) loads, as does one with neither.
    expect(await refusals(everyKind())).toEqual([]);
    expect(await refusals(changingRow('pattern_rule', 0, { setting: undefined, applies_when_setting: undefined, applies_when_negated: undefined, applies_when_value: undefined }))).toEqual([]);
  });

  it("LA-AUT-INV22-T A product's kind is declared once, under a kind that exists, by a name no Lathe table has, holds only its product's records, and never widens Lathe's kinds", async () => {
    const declared = everyKind().product_kind[0];
    // A kind of its own under a domain loads, its records placed in their domain.
    const rule = { name: 'domain_note', product_id: 'TL', label: 'Domain note', description: 'A note on a domain.', parent_kind: 'domain', obligation: false };
    const own = await openStore(writeData(adding({ product_kind: [rule], domain_note: [{ id: 'TL-LEND-NOTE01', title: 'Lending hours', domain_id: 'TL-LEND' }] })), { latheDataDir: null });
    const [scope] = await own.query<{ domain_id: string }>("SELECT domain_id FROM record_scope WHERE id = 'TL-LEND-NOTE01'");
    expect(scope.domain_id).toBe('TL-LEND');
    expect(own.schema.kinds.domain_note.parents).toEqual([{ kind: 'domain', column: 'domain_id' }]);
    // Lathe's kinds are as they are without any product kind: the same parents and the same required columns.
    const bare = await openStore(writeData({ product: [{ id: 'TL', title: 'Tool Library' }] }), { latheDataDir: null });
    for (const kind of ['domain', 'aggregate', 'command']) {
      expect(own.schema.kinds[kind].parents, kind).toEqual(bare.schema.kinds[kind].parents);
      const required = (s: typeof bare.schema) => s.tables[kind].columns.filter((c) => c.required).map((c) => c.name);
      expect(required(own.schema), kind).toEqual(required(bare.schema));
    }
    await own.close();
    await bare.close();

    // Declared twice.
    expect(await refusals(adding({ product_kind: [declared] }))).toEqual(one('primary-key', { table: 'product_kind', file: 'data/product_kind.jsonl', line: 2 }));
    // By a name a Lathe table has: a kind, or any other table.
    for (const name of ['aggregate', 'record_id']) {
      expect(await refusals(adding({ product_kind: [{ ...rule, name }] })), name).toEqual(
        one('product-kind', { table: 'product_kind', line: 2, message: `The product kind ${name} has the name of a table Lathe already has; give it another name.` }),
      );
    }
    // Under a kind that does not exist.
    expect(await refusals(adding({ product_kind: [{ ...rule, parent_kind: 'gadget' }] }))).toEqual(
      one('product-kind', { table: 'product_kind', message: 'The product kind domain_note sits under gadget, which is not a kind.' }),
    );
    // A field added to one of Lathe's kinds: a product cannot give Lathe's kinds more columns.
    expect(await refusals(adding({ product_kind_field: [{ kind: 'aggregate', position: 1, name: 'owner', type: 'text', required: true, description: 'Who owns it.' }] }))).toEqual(
      one('product-kind', { table: 'product_kind_field', file: 'data/product_kind_field.jsonl', line: 2, message: 'The field owner is of aggregate, which is not a product kind.' }),
    );
    // A record of the kind in another product.
    const other: Data = {
      product: [{ id: 'OT', title: 'Other' }],
      domain: [{ id: 'OT-D', title: 'Other', product_id: 'OT', subdomain_type: 'generic' }],
      aggregate: [{ id: 'OT-D-A1', title: 'Thing', domain_id: 'OT-D' }],
      command: [{ id: 'OT-D-CMD01', title: 'Make a thing', aggregate_id: 'OT-D-A1' }],
      cli_command: [{ id: 'OT-D-CMD01-CLI', title: 'ot make', command_id: 'OT-D-CMD01', usage: 'ot make' }],
    };
    expect(await refusals(adding(other))).toEqual(
      one('product-kind-product', { table: 'cli_command', key: 'OT-D-CMD01-CLI', message: 'OT-D-CMD01-CLI is a cli_command, a kind of product TL, but it sits in product OT' }),
    );
  });
});

describe("Authoring's specifications", () => {
  it('LA-AUT-SP05-T A missing, unknown or disallowed parent is refused, as is a second parent or a parent column on a kind with no owner', async () => {
    // Missing: the parent column is required.
    expect(await refusals(changingRow('aggregate', 1, { domain_id: undefined }))).toEqual(one('required', { table: 'aggregate', file: 'data/aggregate.jsonl', line: 2, message: 'aggregate.domain_id is required' }));
    // Unknown, or a record of a kind the aggregate may not sit under: the foreign key names no domain.
    for (const parent of ['TL-NOPE', 'TL-LEND-A1', 'TL']) {
      expect(await refusals(changingRow('aggregate', 1, { domain_id: parent })), parent).toEqual(
        one('foreign-key', { table: 'aggregate', file: 'data/aggregate.jsonl', line: 2, message: `aggregate TL-LEND-A2: domain_id "${parent}" names no domain` }),
      );
    }
    // A kind with two or three possible parents gives exactly one.
    expect(await refusals(changingRow('endpoint', 0, { query_id: 'TL-LEND-QRY01' }))).toEqual(one('check', { table: 'endpoint', file: 'data/endpoint.jsonl', line: 1 }));
    expect(await refusals(changingRow('endpoint', 0, { command_id: undefined }))).toEqual(one('check', { table: 'endpoint', file: 'data/endpoint.jsonl', line: 1 }));
    expect(await refusals(changingRow('table', 2, { entity_id: 'TL-LEND-EN02' }))).toEqual(one('check', { table: 'table', file: 'data/table.jsonl', line: 3 }));
    expect(await refusals(changingRow('question', 0, { product_id: 'TL' }))).toEqual(one('check', { table: 'question', file: 'data/question.jsonl', line: 1 }));
    expect(await refusals(changingRow('question', 0, { domain_id: undefined }))).toEqual(one('check', { table: 'question', file: 'data/question.jsonl', line: 1 }));
    // Each allowed parent loads: an endpoint under its query, a table under its domain, a question under its product.
    let allowed = changingRow('endpoint', 0, { command_id: undefined, query_id: 'TL-LEND-QRY01' });
    allowed = changingRow('question', 0, { domain_id: undefined, product_id: 'TL', id: 'TL-Q01' }, allowed);
    allowed = changingRow('about', 0, { source_id: 'TL-Q01' }, allowed);
    expect(await refusals(allowed)).toEqual([]);
    // A product and the kinds with no owner have no parent column.
    for (const [table, column] of [
      ['product', 'product_id'],
      ['value_object', 'domain_id'],
      ['specification', 'domain_id'],
      ['view', 'product_id'],
      ['integration', 'product_id'],
      ['ui_component', 'view_id'],
    ] as const) {
      const problems = await refusals(changingRow(table, 0, { [column]: 'TL-LEND' }));
      expect(problems, table).toEqual(one('column', { table, file: `data/${table}.jsonl`, line: 1, message: expect.stringContaining(`${table} has no column "${column}"`) }));
    }
  });
});

describe("Authoring's domain services", () => {
  it("LA-AUT-DS01-T01 The next ID puts the parent's, domain's or product's ID into the kind's pattern, numbered one past the highest number any record has", async () => {
    const root = writeData(
      adding({
        // A gap at A3 (never filled: IDs are not reused), a view numbered 7 and a value object with no constraint.
        aggregate: [{ id: 'TL-LEND-A4', title: 'Member', domain_id: 'TL-LEND' }],
        view: [{ id: 'TL-V07', title: 'Desk' }],
        value_object: [{ id: 'TL-VO02', title: 'Phone number' }],
      }),
    );
    const next = async (kind: string, under: string) => {
      const outcome = await nextId(root, kind, under);
      if (!outcome.ok) throw new Error(outcome.problems.map((p) => p.message).join('; '));
      return outcome.value;
    };
    // The parent's ID.
    expect(await next('uc_requirement', 'TL-LEND-UC01')).toBe('TL-LEND-UC01-R02');
    expect(await next('flow_step', 'TL-LEND-UC01-FL')).toBe('TL-LEND-UC01-FL-S02');
    expect(await next('constraint', 'TL-VO01')).toBe('TL-VO01-C02');
    // The domain's ID, from the domain or from the parent inside it.
    expect(await next('aggregate', 'TL-LEND')).toBe('TL-LEND-A5');
    expect(await next('command', 'TL-LEND-A1')).toBe('TL-LEND-CMD02');
    expect(await next('policy', 'TL-LEND-CMD01')).toBe('TL-LEND-PO02');
    // The product's ID, for a kind with no owner.
    expect(await next('view', 'TL')).toBe('TL-V08');
    expect(await next('integration', 'TL')).toBe('TL-INT02');
    // A domain-scoped kind counts the whole domain, not the parent; a parent-scoped kind's first record is number 1.
    expect(await next('entity', 'TL-LEND-A2')).toBe('TL-LEND-EN03');
    expect(await next('constraint', 'TL-VO02')).toBe('TL-VO02-C01');
    // A parent of a kind the record cannot sit under has no next ID.
    const wrong = await nextId(root, 'uc_requirement', 'TL-LEND');
    expect(wrong).toEqual({ ok: false, problems: [expect.objectContaining({ rule: 'parent', message: 'a uc_requirement sits under use_case, not under domain TL-LEND' })] });
  });
});
