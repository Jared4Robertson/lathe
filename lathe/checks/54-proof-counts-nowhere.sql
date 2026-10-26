-- A test whose proofs count in no domain's coverage.
--
-- A test's proof of a target counts, as in lathe/src/coverage.ts, when the target is an obligation in a
-- domain, or a pattern rule owed by the domain the test sits in (the owed_pattern_rules table: a domain owes
-- a pattern rule when it follows the pattern itself, or when one of its use cases does, unless the rule is Not
-- applicable or waived there). A test is reported when it has at least one `proof` link to a record that
-- exists and none of its proofs counts; the message says why for each target. A target that does not exist
-- is only a dangling-link. The test's state does not matter: a planned test that will prove nothing counted
-- is reported too. Point the test at an obligation that counts, or move it into the domain that owes the
-- rule.
--
-- severity: warning
-- kinds: test
SELECT severity, "check", record, message FROM (
WITH follows AS (
  SELECT DISTINCT l.target AS pattern
  FROM records u JOIN links l ON l.path = u.path AND l.relation = 'follows'
  WHERE u.kind IN ('use_case', 'domain') AND u.id <> ''
),
claims AS (
  SELECT DISTINCT s.path, s.id AS test, s.domain AS test_domain, t.id AS target, t.kind AS target_kind,
    t.domain AS target_domain, t.parent AS target_parent,
    t.kind IN (SELECT kind FROM kinds WHERE obligation) AS obligation,
    t.kind = 'pattern_rule' AND t.domain IS NULL AS shared
  FROM links l
  JOIN records s ON s.id = l.source AND s.path = l.path
  JOIN records t ON t.id = l.target
  JOIN relations ro ON ro.role = 'proof' AND ro.relation = l.relation AND ro.source_kind = s.kind
                   AND ro.target_kind IN (t.kind, '*')
  WHERE s.kind = 'test'
),
judged AS (
  SELECT c.*,
    c.obligation AND CASE WHEN c.shared
                          THEN EXISTS (SELECT 1 FROM owed_pattern_rules o WHERE o.id = c.target AND o.domain = c.test_domain)
                          ELSE c.target_domain IS NOT NULL END AS counts,
    (SELECT string_agg(DISTINCT o.domain, ', ' ORDER BY o.domain) FROM owed_pattern_rules o WHERE o.id = c.target) AS owers
  FROM claims c
),
explained AS (
  SELECT path, test, counts, target || CASE
      WHEN NOT obligation THEN ' is not an obligation'
      WHEN NOT shared THEN ' sits in no domain'
      WHEN owers IS NOT NULL THEN ' is owed only by ' || owers || ', not by '
           || coalesce(test_domain || ', where the test sits', 'the test, which sits in no domain')
      WHEN EXISTS (SELECT 1 FROM follows f WHERE f.pattern = target_parent)
           THEN ' is owed by no domain: wherever ' || target_parent
                || ' is followed, its setting is Not applicable or no follower meets its applies_when'
      ELSE ' is owed by no domain: no use case follows its pattern ' || coalesce(target_parent, '')
    END AS reason
  FROM judged
),
reasons AS (
  SELECT path, test, bool_or(counts) AS any_counts, string_agg(DISTINCT reason, '; ' ORDER BY reason) AS why
  FROM explained
  GROUP BY path, test
)
SELECT 'warning' AS severity, 'proof-counts-nowhere' AS "check", nullif(test, '') AS record,
       'Test ' || coalesce(nullif(test, ''), path) || '''s proof counts in no domain''s coverage: ' || why
       || '. Prove what the test''s domain owes, or move the test into a domain that owes what it proves.' AS message
FROM reasons
WHERE NOT any_counts
)
ORDER BY record, message
