// Coverage queries, driven by the meta-model. Every kind marked as an obligation in kinds.csv is
// counted; a link counts as design or proof by its relation rule's role in relations.csv.
// For each obligation record: designed (a 'design' link targets it), built (a 'design' link from
// a component whose file exists), proved (a 'proof' link from an automated or manual source; a
// source with no state is automated) and planned (not proved, but a 'proof' link from a planned
// source targets it).

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
    SELECT DISTINCT l.target, t.kind AS target_kind, ro.role, s.kind AS source_kind,
      coalesce(nullif(st.state, ''), 'automated') AS state,
      EXISTS (SELECT 1 FROM file_facts f WHERE f.path = s.path AND f.record = s.id AND f.file_exists) AS source_file_exists
    FROM links l
    JOIN records s ON s.id = l.source AND s.path = l.path
    JOIN records t ON t.id = l.target
    JOIN roles ro ON ro.relation = l.relation AND ro.source_kind = s.kind AND ro.target_kind IN (t.kind, '*')
    LEFT JOIN states st ON st.path = s.path AND st.record = s.id
  ),
  items AS (
    SELECT DISTINCT r.domain, r.id, r.kind,
      EXISTS (SELECT 1 FROM role_links x WHERE x.target = r.id AND x.target_kind = r.kind AND x.role = 'design') AS designed,
      EXISTS (SELECT 1 FROM role_links x WHERE x.target = r.id AND x.target_kind = r.kind AND x.role = 'design'
                                          AND x.source_kind = 'component' AND x.source_file_exists) AS built,
      EXISTS (SELECT 1 FROM role_links x WHERE x.target = r.id AND x.target_kind = r.kind AND x.role = 'proof'
                                          AND x.state IN ('automated', 'manual')) AS proved,
      EXISTS (SELECT 1 FROM role_links x WHERE x.target = r.id AND x.target_kind = r.kind AND x.role = 'proof'
                                          AND x.state = 'planned') AS planned_proof
    FROM records r JOIN obligation_kinds k ON k.kind = r.kind
    WHERE r.domain IS NOT NULL AND r.id <> ''
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

/** One row per missing link: (domain, id, kind, missing). */
export const COVERAGE_GAPS_SQL = `${ITEMS}
  SELECT domain, id, kind, 'satisfies' AS missing FROM items WHERE NOT designed
  UNION ALL
  SELECT domain, id, kind, 'proves' AS missing FROM items WHERE NOT proved
  ORDER BY domain, id, missing DESC`;
