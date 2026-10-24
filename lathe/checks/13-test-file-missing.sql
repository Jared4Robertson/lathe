-- A test's run_by file, when it names one, must exist, whatever the test's state.
-- (An automated test with no run_by is test-run-by-missing.)
SELECT 'error' AS severity, 'test-file-missing' AS "check", nullif(record, '') AS record,
       'Test ' || coalesce(nullif(record, ''), path) || ' is run by ' || file || ', which does not exist.' AS message
FROM file_facts
WHERE kind = 'test' AND NOT file_exists
ORDER BY path
