// Coverage queries, driven by the meta-model. Every kind marked as an obligation in kinds.csv is
// counted; a link counts as design or proof by its relation rule's role in relations.csv.
// For each obligation a domain owes: designed (a 'design' link targets it), built (a 'design' link from
// a component whose file exists), proved (a 'proof' link from an automated or manual source; a
// source with no state is automated) and planned (not proved, but a 'proof' link from a planned
// source targets it).
//
// An obligation that sits in a domain is owed by that domain. A pattern rule sits under a pattern,
// outside every domain, and is owed instead by each domain that follows the pattern (one of the
// domain's use cases follows it), unless the rule names a setting that every following use case in
// that domain marks "Not applicable:" with a reason. In each domain that owes it, only components and
// tests in that domain design and prove it. The unsatisfied and unproved checks
// (lathe/checks/15-unsatisfied.sql, 16-unproved.sql) apply the same rules.

const ITEMS = `
  WITH obligation_kinds AS (
    SELECT kind, arg_min(label, rowid) AS label, min(rowid) AS ord
    FROM kinds WHERE obligation AND kind <> '' GROUP BY kind
  ),
  roles AS (
    SELECT DISTINCT relation, source_kind, target_kind, role FROM relations WHERE role IN ('design', 'proof')
  ),
  states AS (
    SELECT path, record, lower(trim(any_value(value))) AS state FROM fields WHERE name = 'state' GROUP BY path, record
  ),
  role_links AS (
    SELECT DISTINCT l.target, t.kind AS target_kind, ro.role, s.kind AS source_kind, s.domain AS source_domain,
      coalesce(nullif(st.state, ''), 'automated') AS state,
      EXISTS (SELECT 1 FROM file_facts f WHERE f.path = s.path AND f.record = s.id AND f.file_exists) AS source_file_exists
    FROM links l
    JOIN records s ON s.id = l.source AND s.path = l.path
    JOIN records t ON t.id = l.target
    JOIN roles ro ON ro.relation = l.relation AND ro.source_kind = s.kind AND ro.target_kind IN (t.kind, '*')
    LEFT JOIN states st ON st.path = s.path AND st.record = s.id
  ),
  follows AS (
    SELECT DISTINCT u.domain, l.target AS pattern, u.path
    FROM records u JOIN links l ON l.path = u.path AND l.relation = 'follows'
    WHERE u.kind = 'use_case' AND u.id <> '' AND u.domain IS NOT NULL
  ),
  owed AS (
    SELECT DISTINCT r.domain, r.id, r.kind, false AS per_domain
    FROM records r JOIN obligation_kinds k ON k.kind = r.kind
    WHERE r.domain IS NOT NULL AND r.id <> ''
    UNION
    SELECT domain, id, kind, true AS per_domain FROM (
      SELECT f.domain, r.id, r.kind,
        bool_and(coalesce(trim(st.value), '') <> ''
                 AND regexp_full_match(coalesce(trim(uv.value), ''), '(?is)not\\s+applicable\\s*:\\s*\\S.*')) AS not_applicable
      FROM records r
      JOIN obligation_kinds k ON k.kind = r.kind
      JOIN follows f ON f.pattern = r.parent
      LEFT JOIN fields st ON st.path = r.path AND st.name = 'setting'
      LEFT JOIN fields uv ON uv.path = f.path AND uv.name = trim(st.value)
      WHERE r.kind = 'pattern_rule' AND r.domain IS NULL AND r.id <> ''
      GROUP BY f.domain, r.id, r.kind
    ) WHERE NOT not_applicable
  ),
  items AS (
    SELECT o.domain, o.id, o.kind,
      EXISTS (SELECT 1 FROM role_links x WHERE x.target = o.id AND x.target_kind = o.kind AND x.role = 'design'
                                          AND (NOT o.per_domain OR x.source_domain = o.domain)) AS designed,
      EXISTS (SELECT 1 FROM role_links x WHERE x.target = o.id AND x.target_kind = o.kind AND x.role = 'design'
                                          AND (NOT o.per_domain OR x.source_domain = o.domain)
                                          AND x.source_kind = 'component' AND x.source_file_exists) AS built,
      EXISTS (SELECT 1 FROM role_links x WHERE x.target = o.id AND x.target_kind = o.kind AND x.role = 'proof'
                                          AND (NOT o.per_domain OR x.source_domain = o.domain)
                                          AND x.state IN ('automated', 'manual')) AS proved,
      EXISTS (SELECT 1 FROM role_links x WHERE x.target = o.id AND x.target_kind = o.kind AND x.role = 'proof'
                                          AND (NOT o.per_domain OR x.source_domain = o.domain)
                                          AND x.state = 'planned') AS planned_proof
    FROM owed o
  )`;

/** One row per domain record and obligation kind, in domain order then meta-model order, including empty ones. */
export const COVERAGE_COUNTS_SQL = `${ITEMS}
  SELECT d.id AS domain, k.kind, k.label,
    count(i.id)::INTEGER AS total,
    count(i.id) FILTER (WHERE i.designed)::INTEGER AS designed,
    count(i.id) FILTER (WHERE i.built)::INTEGER AS built,
    count(i.id) FILTER (WHERE i.proved)::INTEGER AS proved,
    count(i.id) FILTER (WHERE NOT i.proved AND i.planned_proof)::INTEGER AS planned
  FROM (SELECT DISTINCT id FROM records WHERE kind = 'domain' AND id <> '') d
  CROSS JOIN obligation_kinds k
  LEFT JOIN items i ON i.domain = d.id AND i.kind = k.kind
  GROUP BY d.id, k.kind, k.label, k.ord
  ORDER BY d.id, k.ord`;

/** One row per missing link: (domain, id, kind, missing). A pattern rule has a gap in each domain that owes it. */
export const COVERAGE_GAPS_SQL = `${ITEMS}
  SELECT domain, id, kind, 'satisfies' AS missing FROM items WHERE NOT designed
  UNION ALL
  SELECT domain, id, kind, 'proves' AS missing FROM items WHERE NOT proved
  ORDER BY domain, id, missing DESC`;
