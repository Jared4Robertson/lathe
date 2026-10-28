// What DuckDB cannot hold as a constraint, because it spans tables: the views the store adds over the tables, and
// the validation queries every write runs in its transaction. A query returns one row per broken rule:
// (table_name, row_key, message), where row_key is the row's key as the store keys it (columns joined by chr(0)).
//
// These are refusals only: broken data. What is merely missing ("at least one", "nothing uses it") is the checks'
// to report, because records are written stage by stage.
import { sqlName, sqlString, type SchemaDescription } from './schema.ts';

export interface ValidationQuery {
  /** The rule's name, reported with each problem. */
  name: string;
  /** What the rule refuses. */
  description: string;
  sql: string;
}

/**
 * The views every database of the store has:
 * - record_parent (id, kind, parent_id): every record with its one parent, or none for a product and a kind with no
 *   owner;
 * - link (relation, source_id, target_id): every link of every relation;
 * - record_group (id, label): every record that names a group among its siblings, with the group as written: a flow
 *   step's path, and the group_name of every kind that has one, Lathe's and a product's own alike.
 */
export function storeViewsSql(schema: SchemaDescription): string {
  const kinds = Object.values(schema.kinds).sort((a, b) => a.name.localeCompare(b.name));
  const parents = kinds.map((k) => {
    const parent = k.parents.length ? `coalesce(${k.parents.map((p) => sqlName(p.column)).join(', ')})` : 'NULL';
    return `SELECT id, ${sqlString(k.name)} AS kind, ${parent}::VARCHAR AS parent_id FROM ${sqlName(k.name)}`;
  });
  const links = Object.keys(schema.relations)
    .sort()
    .map((r) => `SELECT ${sqlString(r)} AS relation, source_id, target_id FROM ${sqlName(r)}`);
  const groups = [
    'SELECT id, path AS label FROM flow_step',
    ...kinds
      .filter((k) => schema.tables[k.name].columns.some((c) => c.name === 'group_name'))
      .map((k) => `SELECT id, group_name::VARCHAR FROM ${sqlName(k.name)} WHERE group_name IS NOT NULL`),
  ];
  return `
CREATE OR REPLACE VIEW record_parent AS
${parents.join('\nUNION ALL ')};
CREATE OR REPLACE VIEW link AS
${links.join('\nUNION ALL ')};
CREATE OR REPLACE VIEW record_group AS
${groups.join('\nUNION ALL ')};
`;
}

/**
 * The record_scope table (id, product_id, domain_id, aggregate_id), made once the data is in, in the same
 * transaction: every record with the product, domain and aggregate it sits in, through its parents; a record of a
 * kind with no owner takes its product, or for a specification its domain, from the longest product or domain ID its
 * own ID starts with (followed by a hyphen). A data database never changes after its load (a write builds a new
 * one), so the walk up the parents is worked out once and shared by the validation queries, the checks and coverage.
 */
export function recordScopeSql(schema: SchemaDescription): string {
  const kinds = Object.values(schema.kinds).sort((a, b) => a.name.localeCompare(b.name));
  // The records that place what sits under them: products, domains and aggregates, and the kinds with no owner.
  const anchors = [
    'SELECT id, id AS product_id, NULL::VARCHAR AS domain_id, NULL::VARCHAR AS aggregate_id FROM product',
    'SELECT id, product_id, id, NULL FROM domain',
    'SELECT id, NULL, NULL, id FROM aggregate',
    ...kinds
      .filter((k) => !k.parents.length && k.name !== 'product')
      .map((k) =>
        k.idScope === 'domain'
          ? `SELECT r.id, max_by(d.product_id, length(d.id)), max_by(d.id, length(d.id)), NULL FROM ${sqlName(k.name)} r LEFT JOIN domain d ON starts_with(r.id, d.id || '-') GROUP BY r.id`
          : `SELECT r.id, max_by(p.id, length(p.id)), NULL, NULL FROM ${sqlName(k.name)} r LEFT JOIN product p ON starts_with(r.id, p.id || '-') GROUP BY r.id`,
      ),
  ];
  return `
CREATE TABLE record_scope AS
WITH RECURSIVE up (id, ancestor) AS (
  SELECT id, id FROM record_parent
  UNION ALL
  SELECT up.id, p.parent_id FROM up JOIN record_parent p ON p.id = up.ancestor WHERE p.parent_id IS NOT NULL
),
anchor (id, product_id, domain_id, aggregate_id) AS (
  ${anchors.join('\n  UNION ALL ')}
)
SELECT up.id, max(a.product_id) AS product_id, max(a.domain_id) AS domain_id, max(a.aggregate_id) AS aggregate_id
FROM up LEFT JOIN anchor a ON a.id = up.ancestor
GROUP BY up.id;
`;
}

// The columns of a stored kind or part table that name another record without placing the row: a field's value
// object or aggregate, a key's invariant or target table. Each pairs the column with the column naming the row's own
// record (a kind's id, a part's owner).
function references(schema: SchemaDescription): { table: string; own: string; column: string }[] {
  const found: { table: string; own: string; column: string }[] = [];
  for (const table of Object.values(schema.tables)) {
    if (table.role !== 'kind' && table.role !== 'part') continue;
    const own = table.role === 'kind' ? 'id' : table.ownerColumn!;
    const placing = new Set([own, ...(schema.kinds[table.name]?.parents.map((p) => p.column) ?? [])]);
    for (const fk of table.foreignKeys) {
      if (fk.columns.length !== 1 || placing.has(fk.columns[0]) || !schema.kinds[fk.table]) continue;
      found.push({ table: table.name, own, column: fk.columns[0] });
    }
  }
  return found.sort((a, b) => `${a.table}.${a.column}`.localeCompare(`${b.table}.${b.column}`));
}

const keyOf = (schema: SchemaDescription, table: string, alias: string) =>
  schema.tables[table].primaryKey.map((c) => `${alias}.${sqlName(c)}::VARCHAR`).join(` || chr(0) || `);

/** The validation queries, for the schema's kinds and relations. */
export function validationQueries(schema: SchemaDescription): ValidationQuery[] {
  const queries: ValidationQuery[] = [
    {
      name: 'relation-pair',
      description: 'A link joins two kinds its relation allows (meta_relation_pair), where its link table accepts several kinds at an end.',
      sql: `
SELECT l.relation AS table_name, l.source_id || chr(0) || l.target_id AS row_key,
       l.source_id || ' (a ' || s.kind || ') cannot ' || l.relation || ' ' || l.target_id || ' (a ' || t.kind || '): '
       || l.relation || ' links ' || (SELECT string_agg(p.source_kind || ' to ' || p.target_kind, ', ' ORDER BY p.source_kind, p.target_kind)
                                       FROM meta_relation_pair p WHERE p.relation = l.relation) AS message
FROM link l
JOIN record_id s ON s.id = l.source_id
JOIN record_id t ON t.id = l.target_id
WHERE NOT EXISTS (SELECT 1 FROM meta_relation_pair p
                  WHERE p.relation = l.relation AND p.source_kind = s.kind AND (p.target_kind = t.kind OR p.target_kind = '*'))`,
    },
    {
      name: 'link-crosses-product',
      description: 'A link stays inside its product: its source and target sit in the same product, because products are separate spaces.',
      sql: `
SELECT l.relation AS table_name, l.source_id || chr(0) || l.target_id AS row_key,
       l.source_id || ' is in product ' || coalesce(a.product_id, 'none') || ', so it cannot ' || l.relation || ' ' || l.target_id
       || ', which is in product ' || coalesce(b.product_id, 'none') AS message
FROM link l
JOIN record_scope a ON a.id = l.source_id
JOIN record_scope b ON b.id = l.target_id
WHERE a.product_id IS DISTINCT FROM b.product_id`,
    },
    {
      name: 'step-fulfills-own-use-case',
      description: "A flow step fulfills only UC requirements of its own flow's use case.",
      sql: `
SELECT 'fulfills' AS table_name, l.source_id || chr(0) || l.target_id AS row_key,
       l.source_id || ' is a step of the flow of ' || f.use_case_id || ', so it cannot fulfill ' || l.target_id
       || ', a requirement of ' || q.use_case_id AS message
FROM fulfills l
JOIN flow_step s ON s.id = l.source_id
JOIN flow f ON f.id = s.flow_id
JOIN uc_requirement q ON q.id = l.target_id
WHERE q.use_case_id <> f.use_case_id`,
    },
    {
      name: 'command-change-in-domain',
      description: "A command's recorded extra aggregate is another aggregate of its own domain.",
      sql: `
SELECT 'command_change' AS table_name, c.command_id || chr(0) || c.aggregate_id AS row_key,
       c.command_id || ' changes ' || cmd.aggregate_id || ', so it cannot also record '
       || CASE WHEN c.aggregate_id = cmd.aggregate_id THEN 'that same aggregate' ELSE c.aggregate_id || ', an aggregate of another domain' END
       AS message
FROM command_change c
JOIN command cmd ON cmd.id = c.command_id
JOIN aggregate own ON own.id = cmd.aggregate_id
JOIN aggregate other ON other.id = c.aggregate_id
WHERE c.aggregate_id = cmd.aggregate_id OR other.domain_id <> own.domain_id`,
    },
    {
      name: 'policy-hears-published',
      description: "A policy hears its own domain's events, or another domain's published ones: domains meet only through published events.",
      sql: `
SELECT 'hears' AS table_name, l.source_id || chr(0) || l.target_id AS row_key,
       l.source_id || ' is a policy of domain ' || coalesce(a.domain_id, 'none') || ', so it cannot hear ' || l.target_id
       || ', an event of domain ' || coalesce(b.domain_id, 'none') || ' that is not published' AS message
FROM hears l
JOIN domain_event e ON e.id = l.target_id
JOIN record_scope a ON a.id = l.source_id
JOIN record_scope b ON b.id = l.target_id
WHERE a.domain_id IS DISTINCT FROM b.domain_id AND NOT e.published`,
    },
    {
      name: 'read-model-fed-by-published',
      description: "A read model is fed by its own domain's events, or another domain's published ones: domains meet only through published events.",
      sql: `
SELECT 'fed_by' AS table_name, l.source_id || chr(0) || l.target_id AS row_key,
       l.source_id || ' is a read model of domain ' || coalesce(a.domain_id, 'none') || ', so it cannot be fed by ' || l.target_id
       || ', an event of domain ' || coalesce(b.domain_id, 'none') || ' that is not published' AS message
FROM fed_by l
JOIN domain_event e ON e.id = l.target_id
JOIN record_scope a ON a.id = l.source_id
JOIN record_scope b ON b.id = l.target_id
WHERE a.domain_id IS DISTINCT FROM b.domain_id AND NOT e.published`,
    },
    {
      name: 'id-prefix',
      description:
        "A record's ID starts with the ID of its scope and a hyphen (meta_kind.id_scope): its parent's, its domain's or its product's. A record with no owner takes its product, or its domain, from that prefix, which must name one; a domain-scoped record's ID names the domain its parent sits in, so a query and its read model, or an endpoint and its command, are of one domain.",
      sql: `
SELECT r.kind AS table_name, r.id AS row_key,
       CASE
         WHEN x.expected IS NULL AND NOT EXISTS (SELECT 1 FROM meta_kind_parent p WHERE p.kind = r.kind)
           THEN r.id || ' is a ' || k.label || ', which has no owner: its ID starts with the ID of its ' || k.id_scope
                || ' and a hyphen, but no ' || k.id_scope || '''s ID starts it'
         WHEN x.expected IS NULL
           THEN r.id || ' is a ' || k.label || ' in no ' || k.id_scope
         ELSE r.id || ' is a ' || k.label || CASE k.id_scope WHEN 'parent' THEN ' under ' ELSE ' in ' || k.id_scope || ' ' END
              || x.expected || ', so its ID starts with ' || x.expected || '-'
       END AS message
FROM record_parent r
JOIN meta_kind k ON k.name = r.kind AND k.id_scope IS NOT NULL
JOIN record_scope s ON s.id = r.id
CROSS JOIN LATERAL (SELECT CASE k.id_scope WHEN 'parent' THEN r.parent_id WHEN 'domain' THEN s.domain_id ELSE s.product_id END AS expected) x
WHERE x.expected IS NULL OR NOT starts_with(r.id, x.expected || '-')`,
    },
    {
      name: 'aggregate-root',
      description: 'An aggregate has at most one root entity.',
      sql: `
SELECT 'aggregate' AS table_name, e.aggregate_id AS row_key,
       'aggregate ' || e.aggregate_id || ' has ' || e.roots || ' root entities; an aggregate has one root' AS message
FROM (SELECT aggregate_id, count(*) AS roots FROM entity WHERE role = 'root' GROUP BY aggregate_id) e
WHERE e.roots > 1`,
    },
    {
      name: 'entity-table',
      description: "An entity stored in its root's table (in_root_table) has no table of its own.",
      sql: `
SELECT 'table' AS table_name, t.id AS row_key,
       'entity ' || e.id || ' is stored in its root''s table (in_root_table), so it cannot have table ' || t.id || ' of its own' AS message
FROM "table" t JOIN entity e ON e.id = t.entity_id WHERE e.in_root_table`,
    },
    {
      name: 'one-primary-key',
      description: 'A table has at most one primary key.',
      sql: `
SELECT 'table' AS table_name, k.table_id AS row_key,
       'table ' || k.table_id || ' has ' || count(*) || ' primary keys; a table has one' AS message
FROM table_key k WHERE k.type = 'primary' GROUP BY k.table_id HAVING count(*) > 1`,
    },
    {
      name: 'foreign-key-crosses-domain',
      description:
        "A table's foreign key points at a table of the same domain: domains don't share tables, so a field's reference to another domain's aggregate stays a plain ID.",
      sql: `
SELECT 'table_key' AS table_name, ${keyOf(schema, 'table_key', 'k')} AS row_key,
       'table ' || k.table_id || ' is in domain ' || coalesce(a.domain_id, 'none') || ', so its foreign key cannot point at table '
       || k.target_table_id || ', which is in domain ' || coalesce(b.domain_id, 'none') AS message
FROM table_key k
JOIN record_scope a ON a.id = k.table_id
JOIN record_scope b ON b.id = k.target_table_id
WHERE k.type = 'foreign' AND a.domain_id IS DISTINCT FROM b.domain_id`,
    },
  ];
  // The relations of domain or aggregate scope, each read from its own link table: the scope is known per relation,
  // so the other relations' links are never joined to record_scope.
  const scoped = Object.values(schema.relations)
    .filter((r) => r.scope !== 'product')
    .sort((a, b) => a.name.localeCompare(b.name));
  if (scoped.length) {
    queries.splice(2, 0, {
      name: 'link-scope',
      description:
        "A link of a relation whose scope is domain or aggregate joins two records of one domain, or one aggregate: a command and the specifications it checks, a query and the specifications it selects by, a specification or read model and the aggregates it reads, a command or query and the domain services it calls, and a command and the events it raises.",
      sql: scoped
        .map((r) => {
          const column = r.scope === 'domain' ? 'domain_id' : 'aggregate_id';
          return `
SELECT ${sqlString(r.name)} AS table_name, l.source_id || chr(0) || l.target_id AS row_key,
       l.source_id || ${sqlString(` is in ${r.scope} `)} || coalesce(a.${column}, 'none')
       || ${sqlString(`, so it cannot ${r.name} `)} || l.target_id || ${sqlString(`, which is in ${r.scope} `)} || coalesce(b.${column}, 'none')
       || ${sqlString(`: ${r.name} links records of one ${r.scope}`)} AS message
FROM ${sqlName(r.name)} l
JOIN record_scope a ON a.id = l.source_id
JOIN record_scope b ON b.id = l.target_id
WHERE a.product_id IS NOT DISTINCT FROM b.product_id AND a.${column} IS DISTINCT FROM b.${column}`;
        })
        .join('\nUNION ALL'),
    });
  }
  const refs = references(schema);
  if (refs.length) {
    queries.push({
      name: 'reference-crosses-product',
      description:
        "A column that names another record (a field's value object or aggregate, a key's invariant or target table) names one of the same product.",
      sql: refs
        .map(
          (r) => `
SELECT ${sqlString(r.table)} AS table_name, ${keyOf(schema, r.table, 't')} AS row_key,
       ${sqlString(`${r.table} `)} || ${keyOf(schema, r.table, 't').replaceAll('chr(0)', "', '")} || ' is in product ' || coalesce(a.product_id, 'none')
       || ', so its ${r.column} cannot name ' || t.${sqlName(r.column)} || ', which is in product ' || coalesce(b.product_id, 'none') AS message
FROM ${sqlName(r.table)} t
JOIN record_scope a ON a.id = t.${sqlName(r.own)}
JOIN record_scope b ON b.id = t.${sqlName(r.column)}
WHERE a.product_id IS DISTINCT FROM b.product_id`,
        )
        .join('\nUNION ALL'),
    });
  }
  const productKinds = Object.values(schema.kinds).filter((k) => k.productId !== null);
  if (productKinds.length) {
    queries.push({
      name: 'product-kind-product',
      description: "A record of a product's own kind sits in the product that declares the kind.",
      sql: productKinds
        .map(
          (k) => `
SELECT ${sqlString(k.name)} AS table_name, r.id AS row_key,
       r.id || ' is a ' || ${sqlString(k.name)} || ', a kind of product ' || ${sqlString(k.productId!)} || ', but it sits in product ' || coalesce(s.product_id, 'none') AS message
FROM ${sqlName(k.name)} r LEFT JOIN record_scope s ON s.id = r.id
WHERE s.product_id IS DISTINCT FROM ${sqlString(k.productId!)}`,
        )
        .join('\nUNION ALL'),
    });
  }
  return queries;
}
