-- A test's run_by file must contain the test's ID, for example in the test's name.
SELECT 'error' AS severity, 'test-file-missing-id' AS "check", nullif(record, '') AS record,
       'Test ' || coalesce(nullif(record, ''), path) || ' is run by ' || file || ', but that file does not mention '
       || coalesce(nullif(record, ''), 'its ID') || '.' AS message
FROM file_facts
WHERE kind = 'test' AND file_exists AND NOT contains_id
ORDER BY path
