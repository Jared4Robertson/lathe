-- A capability or a layer with exactly one child, of any kind.
--
-- A level that holds one record groups nothing. Only its own children are counted, not theirs, and one with
-- no children is not reported. Merge it into a neighbor, or give it more.
--
-- severity: warning
-- kinds: capability layer
SELECT 'warning' AS severity, 'lone-child' AS "check", g.id AS record,
       upper(left(g.kind, 1)) || substr(g.kind, 2) || ' ' || g.id || ' has only one child, '
       || coalesce(nullif(g.child, ''), g.child_path)
       || '; merge it into a neighboring ' || g.kind || ', or give it more.' AS message
FROM (
  SELECT r.id, any_value(r.kind) AS kind, count(DISTINCT c.path) AS n,
         any_value(c.id) AS child, any_value(c.path) AS child_path
  FROM records r
  JOIN records c ON c.parent = r.id
  WHERE r.kind IN ('capability', 'layer') AND r.id <> ''
  GROUP BY r.id
) g
WHERE g.n = 1
ORDER BY record, message
