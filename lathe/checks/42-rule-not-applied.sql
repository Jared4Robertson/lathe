-- Work to do: a domain rule that no use case applies. A rule that nothing applies is either missing
-- from a use case's "applies" links or no longer needed.
SELECT 'warning' AS severity, 'rule-not-applied' AS "check", r.id AS record,
       'Domain rule ' || r.id || ' is not applied by any use case; link it with "applies" from each use case that relies on it, or remove it.' AS message
FROM records r
WHERE r.kind = 'domain_rule' AND r.id <> ''
  AND NOT EXISTS (
    SELECT 1 FROM links l JOIN records u ON u.path = l.path
    WHERE l.relation = 'applies' AND l.target = r.id AND u.kind = 'use_case'
  )
ORDER BY record
