-- Work to do: a test whose proof counts in no domain's coverage, so it proves nothing anyone counts. A test's
-- proof of a target counts, as in lathe/src/coverage.ts, when the target is an obligation in a domain, or a
-- pattern rule owed by the domain the test sits in (a domain owes a pattern rule when it follows the pattern
-- itself, or when one of its use cases does, unless every following use case there marks the rule's setting
-- Not applicable).
-- A test is reported when it has at least one 'proof' link to a record that exists and none of its proofs
-- counts; the message says why for each target. A target that does not exist is only a dangling-link.
-- The test's state does not matter: a planned test that will prove nothing counted is reported too.
SELECT severity, "check", record, message FROM (
WITH follows AS (
  SELECT DISTINCT u.domain, l.target AS pattern, u.path
  FROM records u JOIN links l ON l.path = u.path AND l.relation = 'follows'
  WHERE u.kind = 'use_case' AND u.id <> '' AND u.domain IS NOT NULL
),
domain_follows AS (
  SELECT DISTINCT d.id AS domain, l.target AS pattern
  FROM records d JOIN links l ON l.path = d.path AND l.relation = 'follows'
  WHERE d.kind = 'domain' AND d.id <> ''
),
owed_pattern_rules AS (
  SELECT domain, id FROM (
    SELECT f.domain, r.id,
      bool_and(coalesce(trim(st.value), '') <> ''
               AND regexp_full_match(coalesce(trim(uv.value), ''), '(?is)not\s+applicable\s*:\s*\S.*')) AS not_applicable
    FROM records r
    JOIN follows f ON f.pattern = r.parent
    LEFT JOIN fields st ON st.path = r.path AND st.name = 'setting'
    LEFT JOIN fields uv ON uv.path = f.path AND uv.name = trim(st.value)
    WHERE r.kind = 'pattern_rule' AND r.domain IS NULL AND r.id <> ''
    GROUP BY f.domain, r.id
  ) WHERE NOT not_applicable
  UNION
  SELECT df.domain, r.id
  FROM records r JOIN domain_follows df ON df.pattern = r.parent
  WHERE r.kind = 'pattern_rule' AND r.domain IS NULL AND r.id <> ''
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
           THEN ' is owed by no domain: every use case that follows ' || target_parent || ' marks its setting Not applicable'
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
