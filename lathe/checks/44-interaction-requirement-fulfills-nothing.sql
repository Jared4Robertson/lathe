-- Work to do: an interaction requirement carries out a use case's requirement or a domain rule at a
-- view, endpoint or flow, so it names what it carries out with "fulfills".
SELECT 'warning' AS severity, 'interaction-requirement-fulfills-nothing' AS "check", r.id AS record,
       'Interaction requirement ' || r.id || ' fulfills nothing; link the requirement or domain rule it carries out with "fulfills".' AS message
FROM records r
WHERE r.kind = 'interaction_requirement' AND r.id <> ''
  AND NOT EXISTS (SELECT 1 FROM links l WHERE l.path = r.path AND l.relation = 'fulfills')
ORDER BY record
