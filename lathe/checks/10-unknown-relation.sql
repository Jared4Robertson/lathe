-- Every link uses a relation named in meta/relations.csv.
SELECT DISTINCT 'error' AS severity, 'unknown-relation' AS "check", nullif(l.source, '') AS record,
       coalesce(nullif(l.source, ''), l.path) || ' links to ' || l.target || ' with "' || l.relation || '", which is not a known relation.' AS message
FROM links l
WHERE l.relation NOT IN (SELECT relation FROM relations)
ORDER BY record, message
