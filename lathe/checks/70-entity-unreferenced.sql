-- Work to do: each child entity is a part of its aggregate's root (FORMAT.md section 17), so a has_one or
-- has_many reaches it from the root, directly or through other children of the same aggregate. Links that
-- cross aggregates (has-crosses-aggregate) and refers_to links do not count. An aggregate with no root, or
-- more than one, is aggregate-root only, so its children are not reported.
SELECT 'warning' AS severity, 'entity-unreferenced' AS "check", e.id AS record,
       'Child entity ' || e.id || ' is not reached from ' || e.aggregate || '''s root ' || e.root
       || ' by has_one or has_many; link it from ' || e.root || ' or from the child it is a part of.' AS message
FROM (
  WITH RECURSIVE
    entities AS (
      SELECT e.id, e.parent AS aggregate, lower(trim(coalesce(f.value, ''))) AS role
      FROM records e
      LEFT JOIN fields f ON f.path = e.path AND f.name = 'role'
      WHERE e.kind = 'entity' AND e.id <> ''
    ),
    roots AS (
      SELECT aggregate, any_value(id) AS root FROM entities WHERE role = 'root' GROUP BY aggregate HAVING count(*) = 1
    ),
    parts AS (
      SELECT DISTINCT s.id AS source, t.id AS target
      FROM links l
      JOIN entities s ON s.id = l.source
      JOIN entities t ON t.id = l.target AND t.aggregate = s.aggregate
      WHERE l.relation IN ('has_one', 'has_many')
    ),
    reached (id) AS (
      SELECT root FROM roots
      UNION
      SELECT p.target FROM parts p JOIN reached r ON r.id = p.source
    )
  SELECT e.id, e.aggregate, r.root
  FROM entities e
  JOIN roots r ON r.aggregate = e.aggregate
  WHERE e.role = 'child' AND e.id NOT IN (SELECT id FROM reached)
) e
ORDER BY record
