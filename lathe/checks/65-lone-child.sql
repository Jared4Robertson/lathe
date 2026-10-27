-- A capability, a layer or a group with exactly one child, of any kind.
--
-- A level that holds one record groups nothing. Only its own children are counted, not theirs, and one with
-- no children is not reported. A group (the `group` of requirements, interaction requirements, pattern rules
-- and standard rules, FORMAT.md section 22) is counted among its parent's children of one kind, compared trimmed and in any
-- letter case, and reported on that parent. Merge it into a neighbor, or give it more.
--
-- severity: warning
-- kinds: capability layer requirement interaction_requirement pattern_rule standard_rule
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
UNION ALL
SELECT 'warning', 'lone-child', m.parent,
       upper(left(p.kind, 1)) || replace(substr(p.kind, 2), '_', ' ') || ' ' || m.parent || '''s group "' || m.label
       || '" has only one ' || replace(m.kind, '_', ' ') || ', ' || coalesce(nullif(m.child, ''), m.child_path)
       || '; merge it into a neighboring group, or give it more.'
FROM (
  SELECT r.parent, r.kind, lower(trim(g.value)) AS bucket, min(trim(g.value)) AS label, count(DISTINCT r.path) AS n,
         any_value(r.id) AS child, any_value(r.path) AS child_path
  FROM records r
  JOIN fields g ON g.path = r.path AND g.name = 'group' AND trim(g.value) <> ''
  WHERE r.kind IN ('requirement', 'interaction_requirement', 'pattern_rule', 'standard_rule') AND coalesce(r.parent, '') <> ''
  GROUP BY r.parent, r.kind, bucket
) m
JOIN (SELECT id, any_value(kind) AS kind FROM records WHERE id <> '' GROUP BY id) p ON p.id = m.parent
WHERE m.n = 1
ORDER BY record, message
