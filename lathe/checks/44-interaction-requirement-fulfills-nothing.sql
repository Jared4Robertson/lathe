-- An interaction requirement names what it carries out.
--
-- An interaction requirement carries out a use case's requirement, a domain rule or a pattern rule at a
-- view, endpoint or flow, so it links what it carries out with `fulfills`. Add the `fulfills` link.
--
-- severity: warning
-- kinds: interaction_requirement
SELECT 'warning' AS severity, 'interaction-requirement-fulfills-nothing' AS "check", r.id AS record,
       'Interaction requirement ' || r.id || ' fulfills nothing; link the requirement or domain rule it carries out with "fulfills".' AS message
FROM records r
WHERE r.kind = 'interaction_requirement' AND r.id <> ''
  AND NOT EXISTS (SELECT 1 FROM links l WHERE l.path = r.path AND l.relation = 'fulfills')
ORDER BY record
