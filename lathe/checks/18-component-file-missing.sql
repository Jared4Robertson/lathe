-- A component whose file does not exist yet.
--
-- The design may name a file before it is written, so this is work to do, not breakage. Write the file, or
-- fix the path (relative to the repo root).
--
-- severity: warning
-- kinds: component
SELECT 'warning' AS severity, 'component-file-missing' AS "check", nullif(record, '') AS record,
       'Component ' || coalesce(nullif(record, ''), path) || ' names ' || file || ', which does not exist yet.' AS message
FROM file_facts
WHERE kind = 'component' AND NOT file_exists
ORDER BY path
