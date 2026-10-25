-- An aggregate that holds entities has exactly one root (FORMAT.md section 17): the record the aggregate is
-- named for, through which its other entities are reached. An aggregate with no entities is not reported.
SELECT 'error' AS severity, 'aggregate-root' AS "check", a.id AS record,
       CASE WHEN a.roots = 0
         THEN 'Aggregate ' || a.id || ' has entities but no root; set role: root on the entity the aggregate is named for.'
         ELSE 'Aggregate ' || a.id || ' has ' || a.roots || ' root entities, ' || a.root_ids
              || '; keep one as root and set role: child on the others.'
       END AS message
FROM (
  SELECT g.id,
         count(DISTINCT e.path) FILTER (WHERE lower(trim(f.value)) = 'root') AS roots,
         string_agg(DISTINCT e.id, ', ' ORDER BY e.id) FILTER (WHERE lower(trim(f.value)) = 'root') AS root_ids
  FROM records g
  JOIN records e ON e.parent = g.id AND e.kind = 'entity'
  LEFT JOIN fields f ON f.path = e.path AND f.name = 'role'
  WHERE g.kind = 'aggregate' AND g.id <> ''
  GROUP BY g.id
) a
WHERE a.roots <> 1
ORDER BY record
