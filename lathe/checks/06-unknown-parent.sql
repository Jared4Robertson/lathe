-- A record's parent must be a record in the workspace.
SELECT 'error' AS severity, 'unknown-parent' AS "check", nullif(r.id, '') AS record,
       coalesce(nullif(r.id, ''), r.path) || ' names parent ' || r.parent || ', which does not exist.' AS message
FROM records r
WHERE r.parent IS NOT NULL
  AND r.parent NOT IN (SELECT id FROM records)
ORDER BY r.path
