-- Every link uses a relation the meta-model names.
--
-- The relations are Lathe's `meta/relations.csv` plus any the product adds in its extension. A link under a
-- misspelled or unknown relation name is reported once for each record and name. Fix the name under `links`,
-- or add the relation to the product's `relations.csv`.
--
-- severity: error
SELECT DISTINCT 'error' AS severity, 'unknown-relation' AS "check", nullif(l.source, '') AS record,
       coalesce(nullif(l.source, ''), l.path) || ' links to ' || l.target || ' with "' || l.relation || '", which is not a known relation.' AS message
FROM links l
WHERE l.relation NOT IN (SELECT relation FROM relations)
ORDER BY record, message
