-- Every link points at a record that exists.
--
-- A link whose target ID is no record is reported once for each source, relation and target. Fix the ID, or
-- remove the link if its target was removed on purpose.
--
-- severity: error
SELECT DISTINCT 'error' AS severity, 'dangling-link' AS "check", nullif(l.source, '') AS record,
       coalesce(nullif(l.source, ''), l.path) || ' ' || l.relation || ' ' || l.target || ', which does not exist.' AS message
FROM links l
WHERE l.target NOT IN (SELECT id FROM records)
ORDER BY record, message
