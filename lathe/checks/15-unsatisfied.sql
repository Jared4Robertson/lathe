-- Work to do: a requirement or domain rule that no component satisfies.
SELECT DISTINCT 'warning' AS severity, 'unsatisfied' AS "check", r.id AS record,
       'No component satisfies ' || replace(r.kind, '_', ' ') || ' ' || r.id || '.' AS message
FROM records r
WHERE r.kind IN ('requirement', 'domain_rule') AND r.id <> ''
  AND NOT EXISTS (
    SELECT 1 FROM links l JOIN records s ON s.id = l.source
    WHERE l.target = r.id AND l.relation = 'satisfies' AND s.kind = 'component'
  )
ORDER BY record
