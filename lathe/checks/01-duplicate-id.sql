-- Every record ID is unique across the whole workspace.
--
-- Links, parents and coverage name records by ID, so two records with one ID make every reference to it
-- ambiguous. Each record with the repeated ID is reported. Give all but one of them a new ID; IDs are never
-- reused, so pick the next free number rather than an old one.
--
-- severity: error
SELECT 'error' AS severity, 'duplicate-id' AS "check", id AS record,
       'ID ' || id || ' is used by ' || count(*) || ' files: ' || string_agg(path, ', ' ORDER BY path) || '.' AS message
FROM records
WHERE id <> ''
GROUP BY id
HAVING count(*) > 1
ORDER BY id
