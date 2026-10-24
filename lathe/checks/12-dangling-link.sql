-- Every link points at a record that exists.
SELECT DISTINCT 'error' AS severity, 'dangling-link' AS "check", nullif(l.source, '') AS record,
       coalesce(nullif(l.source, ''), l.path) || ' ' || l.relation || ' ' || l.target || ', which does not exist.' AS message
FROM links l
WHERE l.target NOT IN (SELECT id FROM records)
ORDER BY record, message
