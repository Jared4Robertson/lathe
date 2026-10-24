-- Every record's kind is one of the kinds in meta/kinds.csv.
SELECT 'error' AS severity, 'unknown-kind' AS "check", nullif(r.id, '') AS record,
       CASE WHEN r.kind = '' THEN coalesce(nullif(r.id, ''), r.path) || ' has no kind.'
            ELSE coalesce(nullif(r.id, ''), r.path) || ' has kind "' || r.kind || '", which is not a known kind.'
       END AS message
FROM records r
WHERE r.kind NOT IN (SELECT kind FROM kinds)
ORDER BY r.path
