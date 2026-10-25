-- A record's parent is a record in the workspace.
--
-- A `parent` that names no record leaves the record outside every product and domain. Fix the ID, or add the
-- missing parent record. A record whose parent does not exist is reported here only, not also by the parent
-- kind check.
--
-- severity: error
SELECT 'error' AS severity, 'unknown-parent' AS "check", nullif(r.id, '') AS record,
       coalesce(nullif(r.id, ''), r.path) || ' names parent ' || r.parent || ', which does not exist.' AS message
FROM records r
WHERE r.parent IS NOT NULL
  AND r.parent NOT IN (SELECT id FROM records)
ORDER BY r.path
