-- Work to do: a component whose file does not exist yet.
SELECT 'warning' AS severity, 'component-file-missing' AS "check", nullif(record, '') AS record,
       'Component ' || coalesce(nullif(record, ''), path) || ' names ' || file || ', which does not exist yet.' AS message
FROM file_facts
WHERE kind = 'component' AND NOT file_exists
ORDER BY path
