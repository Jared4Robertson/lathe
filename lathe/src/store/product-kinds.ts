// A product's own kinds and relations: from its product_kind, product_kind_field and product_relation rows, the SQL
// that makes their tables, with the same registry, keys and checks as Lathe's own kinds, and their meta-model rows.
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
  const taken = new Set(Object.keys(schema.tables));
  const declared = new Map(declarations.kinds.map((k) => [String(k.name), k]));
  const kindNames = new Set([...Object.keys(schema.kinds), ...declared.keys()]);

  // Kinds, each after the product kind it sits under.
  const done = new Set<string>();
  const add = (kind: Row, trail: string[]) => {
    const name = String(kind.name);
    if (done.has(name)) return;
    const parent = String(kind.parent_kind);
    if (trail.includes(name)) {
      problems.push({ table: 'product_kind', row: kind, message: `Product kinds sit under each other in a cycle: ${[...trail, name].join(' -> ')}.` });
      done.add(name);
      return;
    }
    if (declared.has(parent) && parent !== name) add(declared.get(parent)!, [...trail, name]);
    done.add(name);
    if (taken.has(name)) {
      problems.push({ table: 'product_kind', row: kind, message: `The product kind ${name} has the name of a table Lathe already has; give it another name.` });
      return;
    }
    if (!kindNames.has(parent) || parent === name) {
      problems.push({ table: 'product_kind', row: kind, message: `The product kind ${name} sits under ${parent}, which is not a kind.` });
      return;
    }
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
    for (const field of fields) {
      const column = String(field.name);
      if (column === 'id' || column === 'title' || column === parentColumn) {
        problems.push({ table: 'product_kind_field', row: field, message: `The field ${column} of ${name} has the name of a column every ${name} already has.` });
        continue;
      }
      const type = FIELD_SQL_TYPES[field.type as keyof typeof FIELD_SQL_TYPES];
      columns.push(`${sqlName(column)} ${type}${field.required ? ' NOT NULL' : ''}${type === 'VARCHAR' && field.required ? ` CHECK (trim(${sqlName(column)}) <> '')` : ''}`);
      comments.push(`COMMENT ON COLUMN ${sqlName(name)}.${sqlName(column)} IS ${literal(field.description)};`);
    }
    statements.push(`CREATE TABLE ${sqlName(name)} (\n  ${columns.join(',\n  ')}\n);`, ...comments);
    statements.push(
      `INSERT INTO meta_kind (name, label, stage, obligation, id_pattern, id_example, product_id) VALUES (${[name, kind.label, kind.stage].map(literal).join(', ')}, ${kind.obligation === true}, ${[kind.id_pattern, kind.id_example, kind.product_id].map(literal).join(', ')});`,
      `INSERT INTO meta_kind_parent VALUES (${literal(name)}, ${literal(parent)}, 1, ${literal(parentColumn)});`,
      `INSERT INTO meta_table VALUES (${literal(name)}, 'kind', NULL);`,
    );
    if (kind.obligation === true) statements.push(`INSERT INTO meta_supertype_member VALUES ('obligation', ${literal(name)});`);
    if (kind.title_form) statements.push(`INSERT INTO meta_kind_title VALUES (${literal(name)}, ${literal(kind.title_form)});`);
    taken.add(name);
  };
  for (const kind of [...declarations.kinds].sort((a, b) => String(a.name).localeCompare(String(b.name)))) add(kind, []);
  for (const field of declarations.fields) {
    if (!declared.has(String(field.kind))) problems.push({ table: 'product_kind_field', row: field, message: `The field ${field.name} is of ${field.kind}, which is not a product kind.` });
  }

  // Relations: a name Lathe has gains pairs; a new name gets a link table.
  const supertypeOf = (table: string, kind: string) =>
    table === 'record_id' || table === kind || (schema.supertypes[table]?.includes(kind) ?? false) || (table === 'obligation' && declared.get(kind)?.obligation === true);
  const byName = new Map<string, Row[]>();
  for (const r of declarations.relations) byName.set(String(r.name), [...(byName.get(String(r.name)) ?? []), r]);
  for (const [name, pairs] of [...byName].sort(([a], [b]) => a.localeCompare(b))) {
    const bad = pairs.filter((p) => !kindNames.has(String(p.source_kind)) || (p.target_kind !== '*' && !kindNames.has(String(p.target_kind))));
    for (const p of bad) problems.push({ table: 'product_relation', row: p, message: `The relation ${name} links ${p.source_kind} to ${p.target_kind}, and one of them is not a kind.` });
    if (bad.length) continue;
    const pairSql = pairs.map(
      (p) => `INSERT INTO meta_relation_pair VALUES (${literal(name)}, ${literal(p.source_kind)}, ${literal(p.target_kind)}, ${literal(p.description)});`,
    );
    const existing = schema.relations[name];
    if (existing) {
      const misfit = pairs.filter((p) => !supertypeOf(existing.sourceTable, String(p.source_kind)) || !supertypeOf(existing.targetTable, String(p.target_kind)));
      for (const p of misfit) {
        problems.push({
          table: 'product_relation',
          row: p,
          message: `Lathe's relation ${name} links ${existing.sourceTable} to ${existing.targetTable}, so it cannot link ${p.source_kind} to ${p.target_kind}; give the relation a name of its own.`,
        });
      }
      if (!misfit.length) statements.push(...pairSql);
      continue;
    }
    if (taken.has(name)) {
      problems.push({ table: 'product_relation', row: pairs[0], message: `The relation ${name} has the name of a table Lathe already has; give it another name.` });
      continue;
    }
    const first = pairs[0];
    const differ = pairs.find((p) => p.role !== first.role || p.forward_label !== first.forward_label || p.reverse_label !== first.reverse_label);
    if (differ) {
      problems.push({ table: 'product_relation', row: differ, message: `The pairs of the relation ${name} give it different roles or labels; give every pair the same.` });
      continue;
    }
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
    taken.add(name);
  }
  return { sql: statements.join('\n'), problems };
}
