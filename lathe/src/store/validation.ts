// What DuckDB cannot hold as a constraint, because it spans tables: the views the store adds over the tables, and
// the validation queries every write runs in its transaction. A query returns one row per broken rule:
// (table_name, row_key, message), where row_key is the row's key as the store keys it.
import { sqlName, sqlString, type SchemaDescription } from './schema.ts';

export interface ValidationQuery {
  /** The rule's name, reported with each problem. */
  name: string;
  /** What the rule says. */
  description: string;
  sql: string;
}

/**
 * The views every database of the store has:
 * - record_parent (id, kind, parent_id): every record with its parent, the first of its parent columns with a value;
 * - record_scope (id, product_id, domain_id): every record with the product and domain it sits in;
 * - link (relation, source_id, target_id): every link of every relation.
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
  return `
CREATE OR REPLACE VIEW record_parent AS
${parents.join('\nUNION ALL ')};
CREATE OR REPLACE VIEW record_scope AS
WITH RECURSIVE up (id, ancestor) AS (
  SELECT id, id FROM record_parent
  UNION ALL
  SELECT up.id, p.parent_id FROM up JOIN record_parent p ON p.id = up.ancestor WHERE p.parent_id IS NOT NULL
)
SELECT up.id,
       max(CASE WHEN a.kind = 'product' THEN a.id END) AS product_id,
       max(CASE WHEN a.kind = 'domain' THEN a.id END) AS domain_id
FROM up JOIN record_parent a ON a.id = up.ancestor
GROUP BY up.id;
CREATE OR REPLACE VIEW link AS
${links.join('\nUNION ALL ')};
`;
}

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
      description: "A link stays inside its product: its source and target sit in the same product, because products are separate spaces.",
      sql: `
SELECT l.relation AS table_name, l.source_id || chr(0) || l.target_id AS row_key,
       l.source_id || ' is in product ' || a.product_id || ', so it cannot ' || l.relation || ' ' || l.target_id
       || ', which is in product ' || b.product_id AS message
FROM link l
JOIN record_scope a ON a.id = l.source_id
JOIN record_scope b ON b.id = l.target_id
WHERE a.product_id IS DISTINCT FROM b.product_id`,
    },
    {
      name: 'aggregate-root',
      description: 'An aggregate that holds entities has exactly one root entity.',
      sql: `
SELECT 'aggregate' AS table_name, e.aggregate_id AS row_key,
       'aggregate ' || e.aggregate_id || ' has ' || e.roots || ' root entities; an aggregate with entities has exactly one root' AS message
FROM (SELECT aggregate_id, count(*) FILTER (WHERE role = 'root') AS roots FROM entity GROUP BY aggregate_id) e
WHERE e.roots <> 1`,
    },
  ];
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
