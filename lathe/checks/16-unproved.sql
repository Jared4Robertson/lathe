-- Work to do: a requirement or domain rule that no test proves.
SELECT DISTINCT 'warning' AS severity, 'unproved' AS "check", r.id AS record,
       'No test proves ' || replace(r.kind, '_', ' ') || ' ' || r.id || '.' AS message
FROM records r
WHERE r.kind IN ('requirement', 'domain_rule') AND r.id <> ''
  AND NOT EXISTS (
    SELECT 1 FROM links l JOIN records s ON s.id = l.source
    WHERE l.target = r.id AND l.relation = 'proves' AND s.kind = 'test'
  )
ORDER BY record
