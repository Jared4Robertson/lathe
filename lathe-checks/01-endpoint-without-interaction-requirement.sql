-- This repo's own check (lathe/FORMAT.md section 13): every endpoint states at least one interaction
-- requirement, an `interaction_requirement` record whose parent is the endpoint, so that what the endpoint
-- answers is an obligation a component satisfies and a test proves, not only prose in the endpoint's body.
SELECT 'warning' AS severity, 'endpoint-without-interaction-requirement' AS "check", e.id AS record,
       'Endpoint ' || e.id || ' (' || e.title || ') has no interaction requirement; write what it answers as an '
       || 'interaction_requirement under it, such as ' || e.id || '-R01.' AS message
FROM records e
WHERE e.kind = 'endpoint' AND e.id <> ''
  AND NOT EXISTS (SELECT 1 FROM records r WHERE r.kind = 'interaction_requirement' AND r.parent = e.id)
ORDER BY e.id
