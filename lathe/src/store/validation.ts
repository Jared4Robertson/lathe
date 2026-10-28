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
 * transaction: every record with the product, domain and aggregate it sits in, through its parents. A record of a
 * kind with no owner takes its product, or for a specification its domain, from the longest product or domain ID its
 * own ID starts with (followed by a hyphen). The other kinds with no owner take the domain that uses them, worked out
 * from the links and fields and never stored (USED_BY): a view the domains of the flow steps that happen in it, an
 * integration those of the flow steps that exchange with it, a value object those of the entities, events and read
 * models whose fields it types, and a UI component the domains that use the views it renders. Exactly one using
 * domain is its domain; two or more, or none, leave it in no domain (shared). What sits under such a record follows
 * it. A data database never changes after its load (a write builds a new one), so this is worked out once and shared
 * by the validation queries, the checks, coverage and the app.
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
  const uses = USED_BY.map(
    (u) => `SELECT u.${sqlName(u.used)}, s.domain_id FROM ${sqlName(u.table)} u JOIN placed s ON s.id = u.${sqlName(u.user)} WHERE u.${sqlName(u.used)} IS NOT NULL`,
  );
  return `
CREATE TABLE record_scope AS
WITH RECURSIVE up (id, ancestor) AS (
  SELECT id, id FROM record_parent
  UNION ALL
  SELECT up.id, p.parent_id FROM up JOIN record_parent p ON p.id = up.ancestor WHERE p.parent_id IS NOT NULL
),
anchor (id, product_id, domain_id, aggregate_id) AS (
  ${anchors.join('\n  UNION ALL ')}
),
placed (id, product_id, domain_id, aggregate_id) AS (
  SELECT up.id, max(a.product_id), max(a.domain_id), max(a.aggregate_id)
  FROM up LEFT JOIN anchor a ON a.id = up.ancestor
  GROUP BY up.id
),
used (id, domain_id) AS (
  ${uses.join('\n  UNION ALL ')}
  UNION ALL
  SELECT r.source_id, s.domain_id FROM renders r JOIN happens_in h ON h.target_id = r.target_id JOIN placed s ON s.id = h.source_id
),
derived (id, domain_id) AS (
  SELECT id, min(domain_id) FROM used WHERE domain_id IS NOT NULL GROUP BY id HAVING count(DISTINCT domain_id) = 1
),
inherited (id, domain_id) AS (
  SELECT up.id, max(d.domain_id) FROM up JOIN derived d ON d.id = up.ancestor GROUP BY up.id
)
SELECT p.id, p.product_id, coalesce(p.domain_id, i.domain_id) AS domain_id, p.aggregate_id
FROM placed p LEFT JOIN inherited i ON i.id = p.id;
`;
}

/**
 * How a domain uses a record with no owner (record_scope): each row of the table names a user, placed in its domain
 * through its parents, and the record it uses. A UI component is used through the views it renders, by the flow
 * steps that happen in them.
 */
const USED_BY: { table: string; user: string; used: string }[] = [
  { table: 'happens_in', user: 'source_id', used: 'target_id' },
  { table: 'exchanges_with', user: 'source_id', used: 'target_id' },
  { table: 'entity_field', user: 'entity_id', used: 'type_value_object_id' },
  { table: 'event_field', user: 'domain_event_id', used: 'type_value_object_id' },
  { table: 'read_model_field', user: 'read_model_id', used: 'type_value_object_id' },
];

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
      name: 'flow-id-interface',
      description: "A flow's ID is its use case's ID, FL and its interface's number: TL-LEND-UC01-FL01 is the flow of TL-LEND-UC01 through TL-IF01.",
      sql: `
SELECT 'flow' AS table_name, f.id AS row_key,
       f.id || ' goes through ' || f.interface_id || ', so its ID is ' || f.use_case_id || '-FL' || n.number AS message
FROM flow f
CROSS JOIN LATERAL (SELECT regexp_extract(f.interface_id, '-IF([0-9]+)$', 1) AS number) n
WHERE f.id <> f.use_case_id || '-FL' || n.number`,
    },
    {
      name: 'step-fits-interface',
      description: "A step of a flow through an API, a CLI or agent tools happens in no view: only a web app's, a desktop app's or another interface's steps happen in views.",
      sql: `
SELECT 'happens_in' AS table_name, l.source_id || chr(0) || l.target_id AS row_key,
       l.source_id || ' is a step of ' || f.id || ', which goes through ' || i.id || ', an interface of kind ' || i.kind || ', so it cannot happen in view ' || l.target_id AS message
FROM happens_in l
JOIN flow_step s ON s.id = l.source_id
JOIN flow f ON f.id = s.flow_id
JOIN interface i ON i.id = f.interface_id
WHERE i.kind IN ('API', 'CLI', 'agent tools')`,
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
      name: 'key-outside-database',
      description: 'Keys are asked only of a table in a database: a table kept in browser storage, a file or in memory has none, and no foreign key points at one.',
      sql: `
SELECT 'table_key' AS table_name, ${keyOf(schema, 'table_key', 'k')} AS row_key,
       CASE WHEN t.storage IN ('browser storage', 'file', 'in memory')
         THEN 'table ' || t.id || ' is kept in ' || t.storage || ', not in a database, so it has no keys'
         ELSE 'table ' || k.target_table_id || ' is kept in ' || g.storage || ', not in a database, so no foreign key can point at it' END AS message
FROM table_key k JOIN "table" t ON t.id = k.table_id LEFT JOIN "table" g ON g.id = k.target_table_id
WHERE t.storage IN ('browser storage', 'file', 'in memory') OR g.storage IN ('browser storage', 'file', 'in memory')`,
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
    {
      name: 'package-use-technical',
      description: 'Only a technical record, of a kind in the technical specification, names a package it uses (package_use).',
      sql: `
SELECT 'package_use' AS table_name, ${keyOf(schema, 'package_use', 'u')} AS row_key,
       u.record_id || ' is a ' || lower(k.label) || ', not a technical record, so it cannot name package ' || u.package || '; name it on the adapter, tooling or other technical record that uses it' AS message
FROM package_use u JOIN record_id r ON r.id = u.record_id JOIN meta_kind k ON k.name = r.kind
WHERE k.stage IS DISTINCT FROM 'technical-specification'`,
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
  queries.push(...titleQueries(schema));
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

/** What a code-bound kind's title must match, by its form (meta_kind_title), and how the refusal says so. */
const TITLE_FORMS = {
  identifier: { pattern: '\\S+', says: 'one identifier exactly as in code, with no whitespace, such as LoanRow' },
  invocation: { pattern: '[a-z0-9][^ ]*( [^ ]+)*', says: 'the invocation as typed, lower case first and words one space apart, such as lathe add' },
  'kebab-case': { pattern: '[a-z0-9]+(-[a-z0-9]+)*', says: 'a kebab-case name, lower-case words joined by hyphens, such as event-tense' },
} as const;

/**
 * The title refusals, over every kind, Lathe's and a product's own: a title unique within its kind and product
 * (compared trimmed, and in any letter case unless the kind is code-bound), with no trailing period, and, for a code-bound kind, in its form.
 */
function titleQueries(schema: SchemaDescription): ValidationQuery[] {
  const kinds = Object.values(schema.kinds).sort((a, b) => a.name.localeCompare(b.name));
  if (!kinds.length) return [];
  const titled = kinds
    .map(
      (k) =>
        `SELECT ${sqlString(k.name)} AS kind, ${sqlString(k.label)} AS label, id, title, ${k.titleForm ? 'trim(title)' : 'lower(trim(title))'} AS same FROM ${sqlName(k.name)}`,
    )
    .join('\nUNION ALL ');
  const queries: ValidationQuery[] = [
    {
      name: 'title-unique',
      description:
        "A title is unique within its kind and product, compared trimmed: two records of one kind are told apart by their titles. Titles in words compare in any letter case; a code-bound kind's identifiers compare exactly, as code does.",
      sql: `
WITH titled AS (${titled}),
keyed AS (
  SELECT t.kind, t.label, t.id, t.title, s.product_id, t.same
  FROM titled t JOIN record_scope s ON s.id = t.id
)
SELECT a.kind AS table_name, a.id AS row_key,
       a.label || ' ' || a.id || ' is titled "' || trim(a.title) || '", as is ' || string_agg(b.id, ', ' ORDER BY b.id)
       || ' in product ' || coalesce(a.product_id, 'none') || '; give each ' || lower(a.label) || ' a title of its own' AS message
FROM keyed a JOIN keyed b ON b.kind = a.kind AND b.same = a.same AND b.product_id IS NOT DISTINCT FROM a.product_id AND b.id <> a.id
GROUP BY a.kind, a.label, a.id, a.title, a.product_id`,
    },
    {
      name: 'title-period',
      description: 'A title ends without a period: it is a name, a goal or one short statement, never prose.',
      sql: `
WITH titled AS (${titled})
SELECT kind AS table_name, id AS row_key,
       label || ' ' || id || ' is titled "' || title || '", which ends with a period; a title ends without one' AS message
FROM titled WHERE regexp_matches(title, '\\.\\s*$')`,
    },
  ];
  const formed = kinds.filter((k) => k.titleForm);
  if (formed.length) {
    queries.push({
      name: 'title-form',
      description:
        "A code-bound kind's title is in its form (meta_kind_title): one identifier as in code with no whitespace, an invocation as typed, or a kebab-case name.",
      sql: formed
        .map((k) => {
          const form = TITLE_FORMS[k.titleForm!];
          return `
SELECT ${sqlString(k.name)} AS table_name, id AS row_key,
       ${sqlString(`${k.label} `)} || id || ' is titled "' || title || '"' || ${sqlString(`, but a ${k.label.toLowerCase()} is titled by ${form.says}; put the explanation in its description`)} AS message
FROM ${sqlName(k.name)} WHERE NOT regexp_full_match(title, ${sqlString(form.pattern)})`;
        })
        .join('\nUNION ALL'),
    });
  }
  return queries;
}
