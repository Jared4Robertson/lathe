-- A test's `test_type` does not suit what it proves.
--
-- Kept conservative: only a test of type domain_rule that proves requirements and no domain rule, or a test
-- of type acceptance that proves domain rules and no requirement, is reported. A unit test may prove either,
-- so it is not reported, nor is any other type, nor a test that proves both. Change the type, or what the
-- test proves.
--
-- severity: warning
-- kinds: test
SELECT 'warning' AS severity, 'test-type-mismatch' AS "check", t.id AS record,
       'Test ' || t.id || ' has test_type ' || t.test_type || ' but proves only '
       || CASE WHEN t.test_type = 'acceptance' THEN 'domain rules' ELSE 'use case requirements' END
       || ' (' || t.targets || '); '
       || CASE WHEN t.test_type = 'acceptance'
               THEN 'an acceptance test proves requirements, so give it test_type domain_rule, or correct what it proves.'
               ELSE 'a domain_rule test proves domain rules, so give it test_type acceptance, or correct what it proves.' END AS message
FROM (
  SELECT r.id, lower(trim(any_value(tt.value))) AS test_type,
         string_agg(DISTINCT l.target, ', ' ORDER BY l.target) AS targets,
         count(*) FILTER (WHERE p.kind = 'requirement') AS requirements,
         count(*) FILTER (WHERE p.kind = 'domain_rule') AS rules
  FROM records r
  JOIN fields tt ON tt.path = r.path AND tt.name = 'test_type'
  JOIN links l ON l.path = r.path AND l.relation = 'proves'
  JOIN records p ON p.id = l.target
  WHERE r.kind = 'test' AND r.id <> ''
  GROUP BY r.id, r.path
) t
WHERE (t.test_type = 'domain_rule' AND t.requirements > 0 AND t.rules = 0)
   OR (t.test_type = 'acceptance' AND t.rules > 0 AND t.requirements = 0)
ORDER BY record
