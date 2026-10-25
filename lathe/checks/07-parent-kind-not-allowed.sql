-- A record's parent is of one of the kinds its kind allows as a parent.
--
-- Each kind lists its allowed parent kinds in `parent_kinds` (see the kind's reference). Products are covered
-- by product-has-parent instead, and an unknown parent is unknown-parent only. When the parent ID is
-- duplicated (duplicate-id), the record is reported only if no record with that ID could be its parent. Move
-- the record under a parent of an allowed kind, or widen the kind's `parent_kinds` in the product's
-- extension.
--
-- severity: error
SELECT 'error' AS severity, 'parent-kind-not-allowed' AS "check", nullif(x.id, '') AS record,
       coalesce(nullif(x.id, ''), x.path) || ' (' || x.kind || ') sits under ' || x.parent || ' ('
       || string_agg(DISTINCT x.parent_kind, ' or ' ORDER BY x.parent_kind)
       || '), but a ' || x.kind || ' must sit under: ' || array_to_string(any_value(x.parent_kinds), ', ') || '.' AS message
FROM (
  SELECT r.path, r.id, r.kind, r.parent, p.kind AS parent_kind, k.parent_kinds,
         list_contains(k.parent_kinds, p.kind) AS allowed
  FROM records r
  JOIN kinds k ON k.kind = r.kind
  JOIN records p ON p.id = r.parent
  WHERE r.kind <> 'product'
) x
GROUP BY x.path, x.id, x.kind, x.parent
HAVING NOT bool_or(x.allowed)
ORDER BY record, message
