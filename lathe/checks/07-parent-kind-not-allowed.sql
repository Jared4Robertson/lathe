-- A record's parent must be of one of its kind's parent_kinds. Products are covered by product-has-parent.
SELECT DISTINCT 'error' AS severity, 'parent-kind-not-allowed' AS "check", nullif(r.id, '') AS record,
       coalesce(nullif(r.id, ''), r.path) || ' (' || r.kind || ') sits under ' || p.id || ' (' || p.kind
       || '), but a ' || r.kind || ' must sit under: ' || array_to_string(k.parent_kinds, ', ') || '.' AS message
FROM records r
JOIN kinds k ON k.kind = r.kind
JOIN records p ON p.id = r.parent
WHERE r.kind <> 'product'
  AND NOT list_contains(k.parent_kinds, p.kind)
ORDER BY record, message
