-- Once a domain has flows, each of its use cases is carried out by one.
--
-- A flow names the use cases it carries out with `carries_out`. A domain with no flows is not reported: its
-- interaction design has not started. Add the use case to a flow's `carries_out`, or write a flow for it.
--
-- severity: warning
-- kinds: use_case flow
SELECT 'warning' AS severity, 'use-case-without-flow' AS "check", u.id AS record,
       'Use case ' || u.id || ' is not carried out by any flow, though domain ' || u.domain
       || ' has flows; link the flow that carries it out with "carries_out".' AS message
FROM records u
WHERE u.kind = 'use_case' AND u.id <> '' AND u.domain IS NOT NULL
  AND EXISTS (SELECT 1 FROM records f WHERE f.kind = 'flow' AND f.domain = u.domain)
  AND NOT EXISTS (
    SELECT 1 FROM links l JOIN records f ON f.path = l.path
    WHERE l.relation = 'carries_out' AND l.target = u.id AND f.kind = 'flow'
  )
ORDER BY record
