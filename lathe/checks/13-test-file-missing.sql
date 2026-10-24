-- A test's run_by file must exist.
SELECT 'error' AS severity, 'test-file-missing' AS "check", nullif(record, '') AS record,
       'Test ' || coalesce(nullif(record, ''), path) || ' is run by ' || file || ', which does not exist.' AS message
FROM file_facts
WHERE kind = 'test' AND NOT file_exists
ORDER BY path
