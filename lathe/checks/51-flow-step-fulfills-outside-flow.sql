-- Work to do: a flow step carries out part of its flow, so what it fulfills belongs to a use case the flow
-- carries out. For a step under flow F, a "fulfills" target is inside F when it is one of:
--   1. a requirement whose parent is a use case F carries_out;
--   2. a domain rule that a use case F carries_out applies;
--   3. a pattern rule of a pattern that a use case F carries_out follows, or that F's domain follows;
--   4. an interaction requirement that fulfills a record of 1, 2 or 3, or that sits under F itself.
-- Anything else is reported. Kept conservative: a step whose flow carries out no use case, and a target
-- that does not exist or is of another kind, are left to other checks.
SELECT severity, "check", record, message FROM (
WITH carried AS (
  -- Each flow and the use cases it carries out.
  SELECT DISTINCT f.id AS flow, f.domain, c.target AS use_case
  FROM records f JOIN links c ON c.path = f.path AND c.relation = 'carries_out'
  WHERE f.kind = 'flow' AND f.id <> ''
),
core AS (
  -- 1. Requirements of the use cases the flow carries out.
  SELECT DISTINCT c.flow, r.id AS target
  FROM carried c JOIN records r ON r.kind = 'requirement' AND r.parent = c.use_case
  UNION
  -- 2. Domain rules those use cases apply.
  SELECT DISTINCT c.flow, a.target
  FROM carried c
  JOIN records u ON u.id = c.use_case AND u.kind = 'use_case'
  JOIN links a ON a.path = u.path AND a.relation = 'applies'
  UNION
  -- 3. Rules of the patterns those use cases follow...
  SELECT DISTINCT c.flow, pr.id
  FROM carried c
  JOIN records u ON u.id = c.use_case AND u.kind = 'use_case'
  JOIN links fo ON fo.path = u.path AND fo.relation = 'follows'
  JOIN records pr ON pr.kind = 'pattern_rule' AND pr.parent = fo.target
  UNION
  -- ...or that the flow's domain follows.
  SELECT DISTINCT c.flow, pr.id
  FROM (SELECT DISTINCT flow, domain FROM carried) c
  JOIN records d ON d.id = c.domain AND d.kind = 'domain'
  JOIN links fo ON fo.path = d.path AND fo.relation = 'follows'
  JOIN records pr ON pr.kind = 'pattern_rule' AND pr.parent = fo.target
),
inside AS (
  SELECT flow, target FROM core
  UNION
  -- 4. Interaction requirements that fulfill one of those...
  SELECT DISTINCT k.flow, ir.id
  FROM core k
  JOIN links x ON x.relation = 'fulfills' AND x.target = k.target
  JOIN records ir ON ir.path = x.path AND ir.kind = 'interaction_requirement'
  UNION
  -- ...or that sit under the flow itself.
  SELECT DISTINCT c.flow, ir.id
  FROM (SELECT DISTINCT flow FROM carried) c
  JOIN records ir ON ir.kind = 'interaction_requirement' AND ir.parent = c.flow
)
SELECT DISTINCT 'warning' AS severity, 'flow-step-fulfills-outside-flow' AS "check", s.id AS record,
       'Flow step ' || s.id || ' fulfills ' || l.target || ', which its flow ' || s.parent
       || ' does not carry out: it is not a requirement of a use case the flow carries out ('
       || (SELECT string_agg(DISTINCT c.use_case, ', ' ORDER BY c.use_case) FROM carried c WHERE c.flow = s.parent)
       || '), nor a domain rule one of them applies, nor a rule of a pattern one of them or the domain follows,'
       || ' nor an interaction requirement that fulfills any of these or sits under the flow.' AS message
FROM records s
JOIN links l ON l.path = s.path AND l.relation = 'fulfills'
WHERE s.kind = 'flow_step' AND s.id <> ''
  -- The step's flow carries out at least one use case.
  AND EXISTS (SELECT 1 FROM carried c WHERE c.flow = s.parent)
  -- The target exists and is a kind a step may fulfill.
  AND EXISTS (SELECT 1 FROM records t WHERE t.id = l.target
                                         AND t.kind IN ('requirement', 'domain_rule', 'interaction_requirement', 'pattern_rule'))
  AND NOT EXISTS (SELECT 1 FROM inside i WHERE i.flow = s.parent AND i.target = l.target)
)
ORDER BY record, message
