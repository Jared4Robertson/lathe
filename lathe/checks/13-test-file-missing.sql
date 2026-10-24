-- A test's run_by file, when it names one, must exist. For an automated or manual test that is an
-- error; a planned test may name the file it will live in, so for it that is a warning, as for a
-- component whose file does not exist yet. (An automated test with no run_by is test-run-by-missing.)
SELECT CASE WHEN st.state = 'planned' THEN 'warning' ELSE 'error' END AS severity,
       'test-file-missing' AS "check", nullif(f.record, '') AS record,
       'Test ' || coalesce(nullif(f.record, ''), f.path) || ' is run by ' || f.file || ', which does not exist'
       || CASE WHEN st.state = 'planned' THEN ' yet.' ELSE '.' END AS message
FROM file_facts f
LEFT JOIN (SELECT path, max(lower(trim(value))) AS state FROM fields WHERE name = 'state' GROUP BY path) st ON st.path = f.path
WHERE f.kind = 'test' AND NOT f.file_exists
ORDER BY f.path
