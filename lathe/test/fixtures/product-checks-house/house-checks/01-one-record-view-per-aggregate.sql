-- Each aggregate has exactly one Record view use case.
--
-- S2's house rule: one use case follows the Record view pattern for each aggregate, naming the aggregate in
-- its `record` setting. Write the missing use case, or merge the extra ones.
--
-- severity: warning
-- kinds: aggregate use_case
WITH views AS (
  SELECT f.value AS aggregate, u.id AS use_case
  FROM records u
  JOIN links l ON l.path = u.path AND l.relation = 'follows'
  JOIN records p ON p.id = l.target AND p.kind = 'pattern' AND p.title = 'Record view'
  JOIN fields f ON f.path = u.path AND f.name = 'record'
  WHERE u.kind = 'use_case'
)
SELECT 'warning' AS severity, 'house-rule' AS "check", a.id AS record,
       'Aggregate ' || a.id || ' has ' || count(v.use_case) || ' Record view use cases'
       || CASE WHEN count(v.use_case) > 0 THEN ' (' || string_agg(v.use_case, ', ' ORDER BY v.use_case) || ')' ELSE '' END
       || '; it needs exactly one.' AS message
FROM records a
LEFT JOIN views v ON v.aggregate = a.id
WHERE a.kind = 'aggregate'
GROUP BY a.id
HAVING count(v.use_case) <> 1
ORDER BY a.id
