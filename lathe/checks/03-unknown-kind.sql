-- Every record's kind is one of the kinds the meta-model defines.
--
-- The kinds are Lathe's `meta/kinds.csv` plus any the product adds in its `metaExtensions` folder. A record
-- with a misspelled or missing kind is reported. Fix the `kind` field, or add the kind to the product's
-- `kinds.csv` if it is a kind of its own.
--
-- severity: error
SELECT 'error' AS severity, 'unknown-kind' AS "check", nullif(r.id, '') AS record,
       CASE WHEN r.kind = '' THEN coalesce(nullif(r.id, ''), r.path) || ' has no kind.'
            ELSE coalesce(nullif(r.id, ''), r.path) || ' has kind "' || r.kind || '", which is not a known kind.'
       END AS message
FROM records r
WHERE r.kind NOT IN (SELECT kind FROM kinds)
ORDER BY r.path
