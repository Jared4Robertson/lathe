-- Every record except a product names its parent.
SELECT 'error' AS severity, 'missing-parent' AS "check", nullif(r.id, '') AS record,
       coalesce(nullif(r.id, ''), r.path) || ' (' || r.kind || ') has no parent; every ' || r.kind || ' must name one.' AS message
FROM records r
WHERE r.parent IS NULL
  AND r.kind <> 'product'
  AND r.kind IN (SELECT kind FROM kinds)
ORDER BY r.path
