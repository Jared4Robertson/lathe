-- Every source_kind and target_kind in a relation rule (other than the '*' target) is a defined kind.
SELECT DISTINCT 'error' AS severity, 'meta-unknown-relation-kind' AS "check", NULL AS record,
       'Relation rule "' || coalesce(r.relation, '') || '" from ' || coalesce(r.source_kind, '(none)') || ' to '
       || coalesce(r.target_kind, '(none)') || ' names ' || s.side || ' kind "' || coalesce(s.name, '') || '", which the meta-model does not define.' AS message
FROM relations r,
     LATERAL (VALUES ('source', r.source_kind), ('target', r.target_kind)) AS s(side, name)
WHERE NOT (s.side = 'target' AND s.name = '*')
  AND (s.name IS NULL OR s.name NOT IN (SELECT kind FROM kinds WHERE kind IS NOT NULL))
ORDER BY message
