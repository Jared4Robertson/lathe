-- Once a domain has capabilities, each of its use cases sits in one of them.
--
-- A use case left directly under the domain is missing from the domain's use case index. Make one of the
-- domain's capabilities its `parent`; its ID does not change. A domain with no capabilities is not reported.
--
-- severity: warning
-- kinds: use_case capability
SELECT 'warning' AS severity, 'use-case-outside-capability' AS "check", u.id AS record,
       'Use case ' || u.id || ' sits directly under domain ' || u.parent
       || ', which has capabilities; move it under the capability it belongs to.' AS message
FROM records u
JOIN records d ON d.id = u.parent AND d.kind = 'domain'
WHERE u.kind = 'use_case' AND u.id <> ''
  AND EXISTS (SELECT 1 FROM records c WHERE c.kind = 'capability' AND c.parent = d.id)
ORDER BY record
