-- Work to do: a use case with no requirements under it.
SELECT DISTINCT 'warning' AS severity, 'use-case-without-requirements' AS "check", u.id AS record,
       'Use case ' || u.id || ' has no requirements.' AS message
FROM records u
WHERE u.kind = 'use_case' AND u.id <> ''
  AND NOT EXISTS (SELECT 1 FROM records r WHERE r.parent = u.id AND r.kind = 'requirement')
ORDER BY record
