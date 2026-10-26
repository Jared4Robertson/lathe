// Coverage queries, driven by the meta-model. Every kind marked as an obligation in kinds.csv is
// counted; a link counts as design or proof by its relation rule's role in relations.csv.
// For each obligation a domain owes: designed (a 'design' link targets it), built (a 'design' link from
// a component whose file exists), proved (a 'proof' link from an automated or manual source; a
// source with no state is automated), planned (not proved, but a 'proof' link from a planned
// source targets it) and planned_any (a 'proof' link from a planned source targets it, proved or
// not, so proof still owed by a planned test is not hidden by another test that already proves it).
// Each domain's tests are also counted by state: the test records whose domain it is, a test with
// no state being automated.
//
// An obligation that sits in a domain is owed by that domain. A pattern rule sits under a pattern,
// outside every domain, and is owed instead by the domains in the owed_pattern_rules table
// (OWED_PATTERN_RULES_SQL, built once before the checks run, which read it too). In each domain that owes
// it, only components and tests in that domain design and prove it.
// A proof-only obligation kind (kinds.csv obligation `proof`) asks for proof alone: it counts as designed
// and built, so its designed and built equal its total and it has no 'satisfies' gaps.
// The unsatisfied and unproved checks (lathe/checks/15-unsatisfied.sql, 16-unproved.sql) apply the same rules.

/**
 * Builds owed_pattern_rules (domain, id, kind): each pattern rule, of an obligation kind, that a domain owes.
 * A domain follows a pattern when the domain itself `follows` it or one of its use cases does; these are the
 * pattern's followers in that domain. A following domain owes each rule of the pattern, except:
 * - a rule that names a `setting` which every following use case there gives as "Not applicable:" with a
 *   reason, when the domain does not follow the pattern itself;
 * - a rule whose `applies_when` (`<setting> is <value>` or `<setting> is not <value>`, a setting the pattern
 *   lists) no follower there meets: a follower meets it when it gives that setting a value, not Not
 *   applicable, equal to the value (or, for "is not", different from it), compared trimmed and in any letter
 *   case. Such a rule is waived there: neither owed nor proved. A malformed or unknown `applies_when` is an
 *   applies-when-unknown error and waives nothing.
 * A rule owed both ways is listed once.
 */
export const OWED_PATTERN_RULES_SQL = `
  CREATE TABLE owed_pattern_rules AS
  WITH followers AS (
    SELECT DISTINCT u.domain, l.target AS pattern, u.path, false AS by_domain
    FROM records u JOIN links l ON l.path = u.path AND l.relation = 'follows'
    WHERE u.kind = 'use_case' AND u.id <> '' AND u.domain IS NOT NULL
    UNION
    SELECT DISTINCT d.id AS domain, l.target AS pattern, d.path, true AS by_domain
    FROM records d JOIN links l ON l.path = d.path AND l.relation = 'follows'
    WHERE d.kind = 'domain' AND d.id <> ''
  ),
  rules AS (
    SELECT r.id, r.kind, r.parent AS pattern,
      nullif(trim(coalesce((SELECT any_value(f.value) FROM fields f WHERE f.path = r.path AND f.name = 'setting'), '')), '') AS setting,
      trim(coalesce((SELECT any_value(f.value) FROM fields f WHERE f.path = r.path AND f.name = 'applies_when'), '')) AS applies_when,
      string_split_regex(trim(coalesce((SELECT any_value(f.value) FROM fields f JOIN records p ON p.path = f.path
                                        WHERE p.id = r.parent AND p.kind = 'pattern' AND f.name = 'settings'), '')), '\\s+') AS settings
    FROM records r
    WHERE r.kind = 'pattern_rule' AND r.domain IS NULL AND r.id <> ''
      AND r.kind IN (SELECT kind FROM kinds WHERE obligation)
  ),
  conditions AS (
    SELECT id, kind, pattern, setting,
      CASE WHEN regexp_full_match(applies_when, '(?is)\\S+\\s+is\\s+\\S.*')
                AND list_contains(settings, regexp_extract(applies_when, '(?is)^(\\S+)\\s+is\\s', 1))
           THEN regexp_extract(applies_when, '(?is)^(\\S+)\\s+is\\s', 1) END AS when_setting,
      regexp_full_match(applies_when, '(?is)\\S+\\s+is\\s+not\\s+\\S.*') AS when_not,
      lower(trim(regexp_extract(applies_when, '(?is)^\\S+\\s+is\\s+(?:not\\s+)?(\\S.*)$', 1))) AS when_value
    FROM rules
  ),
  judged AS (
    SELECT f.domain, c.id, c.kind,
      -- A domain that follows the pattern itself gives no Not applicable: one such row makes this false.
      bool_and(NOT f.by_domain AND c.setting IS NOT NULL
               AND regexp_full_match(coalesce(trim(sv.value), ''), '(?is)not\\s+applicable\\s*:\\s*\\S.*')) AS not_applicable,
      bool_or(c.when_setting IS NULL
              OR (coalesce(trim(wv.value), '') <> ''
                  AND NOT regexp_full_match(trim(wv.value), '(?is)not\\s+applicable\\s*:.*')
                  AND ((lower(trim(wv.value)) = c.when_value) <> c.when_not))) AS meets
    FROM conditions c
    JOIN followers f ON f.pattern = c.pattern
    LEFT JOIN fields sv ON sv.path = f.path AND sv.name = c.setting
    LEFT JOIN fields wv ON wv.path = f.path AND wv.name = c.when_setting
    GROUP BY f.domain, c.id, c.kind
  )
  SELECT domain, id, kind FROM judged
  WHERE NOT not_applicable AND meets
  ORDER BY domain, id`;

const ITEMS = `
  WITH obligation_kinds AS (
    SELECT kind, arg_min(label, rowid) AS label, min(rowid) AS ord, bool_or(proof_only) AS proof_only
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
      EXISTS (SELECT 1 FROM file_facts f WHERE f.path = s.path AND f.record = s.id AND f.file_exists) AS source_file_exists,
      -- An automated test's claim counts only when its file backs it: the file names the test's own ID
      -- (or its key), or names this target. An unbacked claim is reported by proof-not-in-file.
      CASE WHEN s.kind <> 'test' OR coalesce(nullif(st.state, ''), 'automated') <> 'automated' THEN true
           ELSE coalesce((SELECT bool_or(f.contains_id) FROM file_facts f WHERE f.path = s.path), false)
                OR EXISTS (SELECT 1 FROM file_mentions m WHERE m.path = s.path AND m.mentioned = l.target)
      END AS backed
    FROM links l
    JOIN records s ON s.id = l.source AND s.path = l.path
    JOIN records t ON t.id = l.target
    JOIN roles ro ON ro.relation = l.relation AND ro.source_kind = s.kind AND ro.target_kind IN (t.kind, '*')
    LEFT JOIN states st ON st.path = s.path AND st.record = s.id
  ),
  owed AS (
    SELECT DISTINCT r.domain, r.id, r.kind, false AS per_domain
    FROM records r JOIN obligation_kinds k ON k.kind = r.kind
    WHERE r.domain IS NOT NULL AND r.id <> ''
    UNION
    SELECT domain, id, kind, true AS per_domain FROM owed_pattern_rules
  ),
  items AS (
    SELECT o.domain, o.id, o.kind,
      k.proof_only OR EXISTS (SELECT 1 FROM role_links x WHERE x.target = o.id AND x.target_kind = o.kind AND x.role = 'design'
                                          AND (NOT o.per_domain OR x.source_domain = o.domain)) AS designed,
      k.proof_only OR EXISTS (SELECT 1 FROM role_links x WHERE x.target = o.id AND x.target_kind = o.kind AND x.role = 'design'
                                          AND (NOT o.per_domain OR x.source_domain = o.domain)
                                          AND x.source_kind = 'component' AND x.source_file_exists) AS built,
      EXISTS (SELECT 1 FROM role_links x WHERE x.target = o.id AND x.target_kind = o.kind AND x.role = 'proof'
                                          AND (NOT o.per_domain OR x.source_domain = o.domain)
                                          AND x.state IN ('automated', 'manual') AND x.backed) AS proved,
      EXISTS (SELECT 1 FROM role_links x WHERE x.target = o.id AND x.target_kind = o.kind AND x.role = 'proof'
                                          AND (NOT o.per_domain OR x.source_domain = o.domain)
                                          AND x.state = 'planned') AS planned_proof
    FROM owed o JOIN obligation_kinds k ON k.kind = o.kind
  )`;

/** One row per domain record and obligation kind, in domain order then meta-model order, including empty ones. */
export const COVERAGE_COUNTS_SQL = `${ITEMS}
  SELECT d.id AS domain, k.kind, k.label,
    count(i.id)::INTEGER AS total,
    count(i.id) FILTER (WHERE i.designed)::INTEGER AS designed,
    count(i.id) FILTER (WHERE i.built)::INTEGER AS built,
    count(i.id) FILTER (WHERE i.proved)::INTEGER AS proved,
    count(i.id) FILTER (WHERE NOT i.proved AND i.planned_proof)::INTEGER AS planned,
    count(i.id) FILTER (WHERE i.planned_proof)::INTEGER AS planned_any
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

/** One row per domain record: its tests by state (automated, manual, planned). A test with no state is automated. */
export const COVERAGE_TESTS_SQL = `
  WITH states AS (
    SELECT path, record, lower(trim(any_value(value))) AS state FROM fields WHERE name = 'state' GROUP BY path, record
  ),
  tests AS (
    SELECT DISTINCT t.domain, t.id, coalesce(nullif(st.state, ''), 'automated') AS state
    FROM records t LEFT JOIN states st ON st.path = t.path AND st.record = t.id
    WHERE t.kind = 'test' AND t.id <> '' AND t.domain IS NOT NULL
  )
  SELECT d.id AS domain,
    count(t.id) FILTER (WHERE t.state = 'automated')::INTEGER AS automated,
    count(t.id) FILTER (WHERE t.state = 'manual')::INTEGER AS manual,
    count(t.id) FILTER (WHERE t.state = 'planned')::INTEGER AS planned
  FROM (SELECT DISTINCT id FROM records WHERE kind = 'domain' AND id <> '') d
  LEFT JOIN tests t ON t.domain = d.id
  GROUP BY d.id
  ORDER BY d.id`;
