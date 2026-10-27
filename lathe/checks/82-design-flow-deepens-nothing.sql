-- A technical flow that deepens no flow.
--
-- A technical flow says how the system carries out a flow (FORMAT.md section 21), so it names that flow with
-- `deepens`. One that deepens nothing is design with no flow to carry out: the flow is missing, or the link
-- is. A link to a flow that does not exist is only dangling-link. Link the flow it carries out with
-- `deepens`, or write the flow first.
--
-- severity: warning
-- kinds: design_flow
SELECT 'warning' AS severity, 'design-flow-deepens-nothing' AS "check", d.id AS record,
       'Technical flow ' || d.id || ' deepens no flow; link the flow it carries out with "deepens".' AS message
FROM records d
WHERE d.kind = 'design_flow' AND d.id <> ''
  AND NOT EXISTS (SELECT 1 FROM links l WHERE l.path = d.path AND l.relation = 'deepens')
ORDER BY record
