-- A test's state, when given, is automated, manual or planned.
SELECT 'error' AS severity, 'bad-test-state' AS "check", nullif(r.id, '') AS record,
       'Test ' || coalesce(nullif(r.id, ''), r.path) || ' has state "' || f.value
       || '"; a test''s state must be automated, manual or planned.' AS message
FROM records r
JOIN fields f ON f.path = r.path AND f.name = 'state'
WHERE r.kind = 'test' AND trim(f.value) <> '' AND trim(f.value) NOT IN ('automated', 'manual', 'planned')
ORDER BY r.path
