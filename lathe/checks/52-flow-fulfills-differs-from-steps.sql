-- A flow with steps fulfills something none of its steps fulfills.
--
-- Once a flow has steps, what the flow fulfills is the union of what its steps fulfill, so each `fulfills`
-- link belongs on the step that does it. A flow with steps may leave its own `fulfills` out: its steps' links
-- are enough. Move the link onto the step that carries it out.
--
-- severity: warning
-- kinds: flow flow_step
SELECT DISTINCT 'warning' AS severity, 'flow-fulfills-differs-from-steps' AS "check", f.id AS record,
       'Flow ' || f.id || ' fulfills ' || l.target || ', but none of its steps does; move the link onto the step that carries it out.' AS message
FROM records f
JOIN links l ON l.path = f.path AND l.relation = 'fulfills'
WHERE f.kind = 'flow' AND f.id <> ''
  AND EXISTS (SELECT 1 FROM records s WHERE s.kind = 'flow_step' AND s.parent = f.id)
  AND NOT EXISTS (
    SELECT 1 FROM records s JOIN links sl ON sl.path = s.path AND sl.relation = 'fulfills'
    WHERE s.kind = 'flow_step' AND s.parent = f.id AND sl.target = l.target
  )
ORDER BY record, message
