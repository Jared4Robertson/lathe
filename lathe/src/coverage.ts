// Coverage as views over the typed tables. Every kind the schema marks as an obligation (meta_kind.obligation full or
// proof) is counted, through the obligation supertype; a link counts as design or proof by its relation's role
// (meta_relation.role). For each obligation a domain owes: designed (a 'design' link targets it, from a component or a
// technical step), built (a 'design' link from a component whose file exists), proved (a 'proof' link from an
// automated or manual test whose file backs it, or from a record that is not a test), planned (not proved, but a
// 'proof' link from a planned test targets it) and planned_any (a 'proof' link from a planned test targets it, proved
// or not, so proof still owed by a planned test is not hidden by another test that already proves it). Each domain's
// tests are also counted by state.
//
// An obligation that sits in a domain is owed by that domain. A pattern rule sits under a pattern, outside every
// domain, and is owed instead by the domains owed_pattern_rules names; in each domain that owes it, only components,
// technical steps and tests in that domain design and prove it. A proof-only obligation kind asks for proof alone: it
// counts as designed and built, so its designed and built equal its total and it has no 'satisfies' gaps.
//
// The views read two tables the engine fills from the code before the checks run (FACT_TABLES_SQL): file_facts, a
// row for each test or component that names a file, and file_mentions, the IDs a test's file names. The checks read
// the same views, so coverage and the unsatisfied, unproved and proof-still-owed checks judge alike.

/** The tables the engine fills from scanning the code: the files records name, and the IDs a test's file names. */
export const FACT_TABLES_SQL = `
CREATE OR REPLACE TABLE file_facts (
  record VARCHAR NOT NULL, kind VARCHAR NOT NULL, file VARCHAR NOT NULL, file_exists BOOLEAN NOT NULL,
  contains_id BOOLEAN, key_file VARCHAR, key_file_inside BOOLEAN, key_file_exists BOOLEAN
);
CREATE OR REPLACE TABLE file_mentions (record VARCHAR NOT NULL, mentioned VARCHAR NOT NULL);`;

/**
 * The coverage views, created over the typed tables and the fact tables:
 * - owed_pattern_rules (domain, id, kind): each pattern rule a domain owes. A domain follows a pattern when the domain
 *   itself `follows` it or one of its use cases does; these are the pattern's followers in that domain. A following
 *   domain owes each rule of the pattern, except a rule whose `setting` every following use case there marks not
 *   applicable (a setting_value with a not_applicable reason), when the domain does not follow the pattern itself;
 *   and a rule with an applies-when setting that no follower there meets: a follower meets it when its setting_value
 *   for that setting has a value equal to applies_when_value (or, when applies_when_negated, different from it),
 *   compared trimmed and in any letter case. Such a rule is waived there: neither owed nor proved.
 * - obligation_kind (kind, label, proof_only, ord): the obligation kinds in kind order (meta_kind.position, then a product's own by name).
 * - role_link: each design or proof link to an obligation, with its source's kind, domain and state, whether the
 *   source's file exists and whether its claim is backed (an automated test's file names the test, its key, or the
 *   target).
 * - coverage_item (domain, id, kind, per_domain, designed, built, proved, planned_proof): each obligation a domain owes.
 * - coverage_count, coverage_gap and coverage_tests: the per-domain counts, the gaps and the tests by state.
 */
export const COVERAGE_VIEWS_SQL = `
CREATE OR REPLACE VIEW owed_pattern_rules AS
WITH followers AS (
  SELECT DISTINCT u.domain_id AS domain, f.target_id AS pattern, f.source_id AS follower, false AS by_domain
  FROM follows f JOIN use_case u ON u.id = f.source_id
  UNION
  SELECT DISTINCT d.id AS domain, f.target_id AS pattern, f.source_id AS follower, true AS by_domain
  FROM follows f JOIN domain d ON d.id = f.source_id
),
rules AS (
  SELECT r.id, 'pattern_rule' AS kind, r.pattern_id AS pattern, r.setting, r.applies_when_setting AS when_setting,
         coalesce(r.applies_when_negated, false) AS when_not, lower(trim(r.applies_when_value)) AS when_value
  FROM pattern_rule r
  WHERE EXISTS (SELECT 1 FROM meta_kind k WHERE k.name = 'pattern_rule' AND k.obligation <> 'none')
),
judged AS (
  SELECT f.domain, c.id, c.kind,
    -- A domain that follows the pattern itself marks nothing not applicable: one such follower makes this false.
    bool_and(NOT f.by_domain AND c.setting IS NOT NULL AND sv.not_applicable IS NOT NULL) AS not_applicable,
    bool_or(c.when_setting IS NULL
            OR (wv.value IS NOT NULL AND ((lower(trim(wv.value)) = c.when_value) <> c.when_not))) AS meets
  FROM rules c
  JOIN followers f ON f.pattern = c.pattern
  LEFT JOIN setting_value sv ON sv.follower_id = f.follower AND sv.pattern_id = c.pattern AND sv.setting = c.setting
  LEFT JOIN setting_value wv ON wv.follower_id = f.follower AND wv.pattern_id = c.pattern AND wv.setting = c.when_setting
  GROUP BY f.domain, c.id, c.kind
)
SELECT domain, id, kind FROM judged WHERE NOT not_applicable AND meets;

CREATE OR REPLACE VIEW obligation_kind AS
SELECT name AS kind, label, obligation = 'proof' AS proof_only, row_number() OVER (ORDER BY position NULLS LAST, name) AS ord
FROM meta_kind WHERE obligation <> 'none';

CREATE OR REPLACE VIEW role_link AS
SELECT DISTINCT l.relation, l.source_id AS source, l.target_id AS target, ob.kind AS target_kind, r.role,
  s.kind AS source_kind, ss.domain_id AS source_domain,
  coalesce(t.state::VARCHAR, 'automated') AS state,
  coalesce(ff.file_exists, false) AS source_file_exists,
  -- An automated test's claim counts only when its file backs it: the file names the test's own ID (or its key), or
  -- names this target. An unbacked claim is reported by proof-not-in-file.
  CASE WHEN s.kind <> 'test' OR t.state <> 'automated' THEN true
       ELSE coalesce(ff.contains_id, false) OR m.record IS NOT NULL
  END AS backed
FROM link l
JOIN meta_relation r ON r.name = l.relation AND r.role IS NOT NULL
JOIN obligation ob ON ob.id = l.target_id
JOIN record_id s ON s.id = l.source_id
LEFT JOIN record_scope ss ON ss.id = l.source_id
LEFT JOIN test t ON t.id = l.source_id
LEFT JOIN file_facts ff ON ff.record = l.source_id
LEFT JOIN (SELECT DISTINCT record, mentioned FROM file_mentions) m ON m.record = l.source_id AND m.mentioned = l.target_id;

CREATE OR REPLACE VIEW coverage_item AS
WITH owed AS (
  SELECT DISTINCT s.domain_id AS domain, o.id, o.kind, false AS per_domain
  FROM obligation o JOIN record_scope s ON s.id = o.id
  WHERE s.domain_id IS NOT NULL
  UNION
  SELECT domain, id, kind, true AS per_domain FROM owed_pattern_rules
)
SELECT o.domain, o.id, o.kind, o.per_domain,
  k.proof_only OR coalesce(bool_or(x.role = 'design'), false) AS designed,
  k.proof_only OR coalesce(bool_or(x.role = 'design' AND x.source_kind = 'component' AND x.source_file_exists), false) AS built,
  coalesce(bool_or(x.role = 'proof' AND x.state IN ('automated', 'manual') AND x.backed), false) AS proved,
  coalesce(bool_or(x.role = 'proof' AND x.state = 'planned'), false) AS planned_proof
FROM owed o
JOIN obligation_kind k ON k.kind = o.kind
-- In a domain that owes a pattern rule, only links from records in that domain count.
LEFT JOIN role_link x ON x.target = o.id AND (NOT o.per_domain OR x.source_domain = o.domain)
GROUP BY o.domain, o.id, o.kind, o.per_domain, k.proof_only;

CREATE OR REPLACE VIEW coverage_count AS
SELECT d.id AS domain, k.kind, k.label,
  count(i.id)::INTEGER AS total,
  count(i.id) FILTER (WHERE i.designed)::INTEGER AS designed,
  count(i.id) FILTER (WHERE i.built)::INTEGER AS built,
  count(i.id) FILTER (WHERE i.proved)::INTEGER AS proved,
  count(i.id) FILTER (WHERE NOT i.proved AND i.planned_proof)::INTEGER AS planned,
  count(i.id) FILTER (WHERE i.planned_proof)::INTEGER AS planned_any,
  k.ord
FROM domain d
CROSS JOIN obligation_kind k
LEFT JOIN coverage_item i ON i.domain = d.id AND i.kind = k.kind
GROUP BY d.id, k.kind, k.label, k.ord;

CREATE OR REPLACE VIEW coverage_gap AS
SELECT domain, id, kind, 'satisfies' AS missing FROM coverage_item WHERE NOT designed
UNION ALL
SELECT domain, id, kind, 'proves' AS missing FROM coverage_item WHERE NOT proved;

CREATE OR REPLACE VIEW coverage_tests AS
SELECT d.id AS domain,
  count(t.id) FILTER (WHERE t.state = 'automated')::INTEGER AS automated,
  count(t.id) FILTER (WHERE t.state = 'manual')::INTEGER AS manual,
  count(t.id) FILTER (WHERE t.state = 'planned')::INTEGER AS planned
FROM domain d LEFT JOIN test t ON t.domain_id = d.id
GROUP BY d.id;`;

/** One row per domain and obligation kind, in domain order then schema order, including empty ones. */
export const COVERAGE_COUNTS_SQL = `SELECT domain, kind, label, total, designed, built, proved, planned, planned_any FROM coverage_count ORDER BY domain, ord`;

/** One row per missing link: (domain, id, kind, missing). A pattern rule has a gap in each domain that owes it. */
export const COVERAGE_GAPS_SQL = `SELECT domain, id, kind, missing FROM coverage_gap ORDER BY domain, id, missing DESC`;

/** One row per domain: its tests by state. */
export const COVERAGE_TESTS_SQL = `SELECT domain, automated, manual, planned FROM coverage_tests ORDER BY domain`;
