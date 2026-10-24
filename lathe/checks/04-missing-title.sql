-- Every record has a title.
SELECT 'error' AS severity, 'missing-title' AS "check", nullif(id, '') AS record,
       coalesce(nullif(id, ''), path) || ' has no title.' AS message
FROM records
WHERE trim(title) = ''
ORDER BY path
