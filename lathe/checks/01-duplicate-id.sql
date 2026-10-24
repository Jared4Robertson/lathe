-- Every record ID must be unique across the workspace.
SELECT 'error' AS severity, 'duplicate-id' AS "check", id AS record,
       'ID ' || id || ' is used by ' || count(*) || ' files: ' || string_agg(path, ', ' ORDER BY path) || '.' AS message
FROM records
WHERE id <> ''
GROUP BY id
HAVING count(*) > 1
ORDER BY id
