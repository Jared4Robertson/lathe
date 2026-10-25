-- A test's state, when given, is automated, manual or planned.
--
-- The state is read in any letter case, as coverage reads it. Without a state a test is automated. Fix the
-- value, or remove the field for an automated test.
--
-- severity: error
-- kinds: test
SELECT 'error' AS severity, 'bad-test-state' AS "check", nullif(r.id, '') AS record,
       'Test ' || coalesce(nullif(r.id, ''), r.path) || ' has state "' || f.value
       || '"; a test''s state must be automated, manual or planned.' AS message
FROM records r
JOIN fields f ON f.path = r.path AND f.name = 'state'
WHERE r.kind = 'test' AND trim(f.value) <> '' AND lower(trim(f.value)) NOT IN ('automated', 'manual', 'planned')
ORDER BY r.path
