// A product's own kinds and relations: from its product_kind, product_kind_field and product_relation rows, the SQL
// that makes their tables, with the same registry, keys and checks as Lathe's own kinds, and their meta-model rows.
import { isLeadColumn } from '../../lead.ts';
import type { Row } from './rows.ts';
import { sqlName, sqlString, type SchemaDescription } from './schema.ts';

/** A declaration that cannot be made into a table, keyed like the row that declares it. */
export interface DeclarationProblem {
  table: 'product_kind' | 'product_kind_field' | 'product_relation';
  row: Row;
  message: string;
}

const FIELD_SQL_TYPES = { text: 'VARCHAR', integer: 'INTEGER', boolean: 'BOOLEAN', date: 'DATE' } as const;

const literal = (value: unknown) => (value === null || value === undefined ? 'NULL' : sqlString(String(value)));

/**
 * The SQL that adds the declared kinds and relations to a database that has Lathe's schema, or the problems that stop
 * it. `schema` describes that database before the additions.
 */
export function productKindSql(
  schema: SchemaDescription,
  declarations: { kinds: Row[]; fields: Row[]; relations: Row[] },
): { sql: string; problems: DeclarationProblem[] } {
  const problems: DeclarationProblem[] = [];
  const statements: string[] = [];
  const declared = new Map(declarations.kinds.map((k) => [String(k.name), k]));

  // Kinds, each after the product kind it sits under.
  const done = new Set<string>();
  const add = (kind: Row) => {
    const name = String(kind.name);
    if (done.has(name)) return;
    const parent = String(kind.parent_kind);
    if (declared.has(parent) && parent !== name) add(declared.get(parent)!);
    done.add(name);
    const parentColumn = `${parent}_id`;
    const fields = declarations.fields
      .filter((f) => f.kind === name)
      .sort((a, b) => Number(a.position) - Number(b.position));
    const columns = [
      `id VARCHAR PRIMARY KEY REFERENCES record_id (id)`,
      `title VARCHAR NOT NULL CHECK (trim(title) <> '')`,
      `${sqlName(parentColumn)} VARCHAR NOT NULL REFERENCES ${sqlName(parent)} (id)`,
    ];
    const comments = [
      `COMMENT ON TABLE ${sqlName(name)} IS ${literal(kind.description)};`,
      `COMMENT ON COLUMN ${sqlName(name)}.id IS 'The record''s ID.';`,
      `COMMENT ON COLUMN ${sqlName(name)}.title IS 'The record''s title.';`,
      `COMMENT ON COLUMN ${sqlName(name)}.${sqlName(parentColumn)} IS ${literal(`The ${parent} it sits under.`)};`,
    ];
    const leads = fields.filter((f) => isLeadColumn(String(f.name)));
    const titling = fields.filter((f) => f.titles === true);
    for (const field of fields) {
      const column = String(field.name);
      if (column === 'id' || column === 'title' || column === parentColumn) {
        problems.push({ table: 'product_kind_field', row: field, message: `The field ${column} of ${name} has the name of a column every ${name} already has.` });
        continue;
      }
      if (isLeadColumn(column) && field !== leads[0]) {
        problems.push({ table: 'product_kind_field', row: field, message: `The field ${column} of ${name} is a second lead text, after ${String(leads[0].name)}: a kind has at most one of statement, goal, meaning and description.` });
        continue;
      }
      if (isLeadColumn(column) && field.required !== true) {
        problems.push({ table: 'product_kind_field', row: field, message: `The field ${column} of ${name} is its lead text, so it must be required: a kind's text is required or absent.` });
        continue;
      }
      if (field.titles === true && (field.type !== 'text' || field.required !== true)) {
        problems.push({ table: 'product_kind_field', row: field, message: `The field ${column} of ${name} titles its records, so it must be a required text field: every ${name} has a title.` });
        continue;
      }
      if (field.titles === true && field !== titling[0]) {
        problems.push({ table: 'product_kind_field', row: field, message: `The field ${column} of ${name} is a second field that titles its records, after ${String(titling[0].name)}: at most one field titles a kind.` });
        continue;
      }
      const type = FIELD_SQL_TYPES[field.type as keyof typeof FIELD_SQL_TYPES];
      columns.push(`${sqlName(column)} ${type}${field.required ? ' NOT NULL' : ''}${type === 'VARCHAR' && field.required ? ` CHECK (trim(${sqlName(column)}) <> '')` : ''}`);
      comments.push(`COMMENT ON COLUMN ${sqlName(name)}.${sqlName(column)} IS ${literal(field.description)};`);
    }
    statements.push(`CREATE TABLE ${sqlName(name)} (\n  ${columns.join(',\n  ')}\n);`, ...comments);
    statements.push(
      `INSERT INTO meta_kind (name, label, stage, obligation, id_pattern, id_example, product_id, complexity) VALUES (${[name, kind.label, kind.stage].map(literal).join(', ')}, ${kind.obligation === true}, ${[kind.id_pattern, kind.id_example, kind.product_id, kind.complexity].map(literal).join(', ')});`,
      `INSERT INTO meta_kind_parent VALUES (${literal(name)}, ${literal(parent)}, 1, ${literal(parentColumn)});`,
      `INSERT INTO meta_table VALUES (${literal(name)}, 'kind', NULL);`,
    );
    if (kind.obligation === true) statements.push(`INSERT INTO meta_supertype_member VALUES ('obligation', ${literal(name)});`);
    if (kind.stage === 'technical-specification') statements.push(`INSERT INTO meta_supertype_member VALUES ('technical_record', ${literal(name)});`);
    if (kind.obligation === true || kind.stage === 'technical-specification') statements.push(`INSERT INTO meta_supertype_member VALUES ('provided_by_source', ${literal(name)});`);
    if (kind.title_form) statements.push(`INSERT INTO meta_kind_title VALUES (${literal(name)}, ${literal(kind.title_form)});`);
  };
  for (const kind of [...declarations.kinds].sort((a, b) => String(a.name).localeCompare(String(b.name)))) add(kind);

  // Relations: a name Lathe has gains pairs; a new name gets a link table.
  const byName = new Map<string, Row[]>();
  for (const r of declarations.relations) byName.set(String(r.name), [...(byName.get(String(r.name)) ?? []), r]);
  for (const [name, pairs] of [...byName].sort(([a], [b]) => a.localeCompare(b))) {
    const pairSql = pairs.map(
      (p) => `INSERT INTO meta_relation_pair VALUES (${literal(name)}, ${literal(p.source_kind)}, ${literal(p.target_kind)}, ${literal(p.description)});`,
    );
    const existing = schema.relations[name];
    if (existing) {
      statements.push(...pairSql);
      continue;
    }
    const first = pairs[0];
    const sources = new Set(pairs.map((p) => String(p.source_kind)));
    const targets = new Set(pairs.map((p) => String(p.target_kind)));
    const end = (kinds: Set<string>) => (kinds.size === 1 && !kinds.has('*') ? [...kinds][0] : 'record_id');
    statements.push(
      `CREATE TABLE ${sqlName(name)} (source_id VARCHAR NOT NULL REFERENCES ${sqlName(end(sources))} (id), target_id VARCHAR NOT NULL REFERENCES ${sqlName(end(targets))} (id), PRIMARY KEY (source_id, target_id));`,
      `COMMENT ON TABLE ${sqlName(name)} IS ${literal(first.description)};`,
      `INSERT INTO meta_relation VALUES (${[name, first.role, 'product', first.forward_label, first.reverse_label, first.product_id].map(literal).join(', ')});`,
      `INSERT INTO meta_table VALUES (${literal(name)}, 'link', NULL);`,
      ...pairSql,
    );
  }
  return { sql: statements.join('\n'), problems };
}
