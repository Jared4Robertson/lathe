-- Work to do: a use case with no requirements under it. A use case that follows a pattern is left out:
-- its rules come from the pattern's rules, so it may have no requirements of its own.
SELECT DISTINCT 'warning' AS severity, 'use-case-without-requirements' AS "check", u.id AS record,
       'Use case ' || u.id || ' has no requirements.' AS message
FROM records u
WHERE u.kind = 'use_case' AND u.id <> ''
  AND NOT EXISTS (SELECT 1 FROM records r WHERE r.parent = u.id AND r.kind = 'requirement')
  AND NOT EXISTS (
    SELECT 1 FROM links l JOIN records p ON p.id = l.target AND p.kind = 'pattern'
    WHERE l.path = u.path AND l.relation = 'follows'
  )
ORDER BY record
