-- Work to do: a flow step carries out part of its flow, so what it fulfills belongs to a use case the flow
-- carries out. For a step under flow F, a "fulfills" target is inside F when it is one of:
--   1. a requirement whose parent is a use case F carries_out;
--   2. a domain rule that a use case F carries_out applies;
--   3. an interaction requirement that fulfills a record of 1 or 2, or that sits under F itself.
-- Anything else is reported. Kept conservative: a step whose flow carries out no use case, and a target
-- that does not exist or is of another kind, are left to other checks.
SELECT DISTINCT 'warning' AS severity, 'flow-step-fulfills-outside-flow' AS "check", s.id AS record,
       'Flow step ' || s.id || ' fulfills ' || l.target || ', which its flow ' || s.parent
       || ' does not carry out: it is not a requirement of a use case the flow carries out ('
       || (SELECT string_agg(DISTINCT c.target, ', ' ORDER BY c.target)
           FROM links c JOIN records f ON f.path = c.path AND f.kind = 'flow'
           WHERE c.relation = 'carries_out' AND f.id = s.parent)
       || '), nor a domain rule one of them applies, nor an interaction requirement that fulfills either or sits under the flow.' AS message
FROM records s
JOIN links l ON l.path = s.path AND l.relation = 'fulfills'
WHERE s.kind = 'flow_step' AND s.id <> ''
  -- The step's flow carries out at least one use case.
  AND EXISTS (
    SELECT 1 FROM links c JOIN records f ON f.path = c.path AND f.kind = 'flow'
    WHERE c.relation = 'carries_out' AND f.id = s.parent
  )
  -- The target exists and is a kind a step may fulfill.
  AND EXISTS (SELECT 1 FROM records t WHERE t.id = l.target AND t.kind IN ('requirement', 'domain_rule', 'interaction_requirement'))
  AND l.target NOT IN (
    SELECT inside.target FROM (
      -- 1. Requirements of the use cases the flow carries out.
      SELECT r.id AS target
      FROM links c JOIN records f ON f.path = c.path AND f.kind = 'flow'
      JOIN records r ON r.kind = 'requirement' AND r.parent = c.target
      WHERE c.relation = 'carries_out' AND f.id = s.parent
      UNION
      -- 2. Domain rules those use cases apply.
      SELECT a.target
      FROM links c JOIN records f ON f.path = c.path AND f.kind = 'flow'
      JOIN records u ON u.id = c.target AND u.kind = 'use_case'
      JOIN links a ON a.path = u.path AND a.relation = 'applies'
      WHERE c.relation = 'carries_out' AND f.id = s.parent
    ) inside
    UNION
    -- 3. Interaction requirements that fulfill one of those...
    SELECT ir.id
    FROM records ir JOIN links x ON x.path = ir.path AND x.relation = 'fulfills'
    WHERE ir.kind = 'interaction_requirement'
      AND x.target IN (
        SELECT r.id
        FROM links c JOIN records f ON f.path = c.path AND f.kind = 'flow'
        JOIN records r ON r.kind = 'requirement' AND r.parent = c.target
        WHERE c.relation = 'carries_out' AND f.id = s.parent
        UNION
        SELECT a.target
        FROM links c JOIN records f ON f.path = c.path AND f.kind = 'flow'
        JOIN records u ON u.id = c.target AND u.kind = 'use_case'
        JOIN links a ON a.path = u.path AND a.relation = 'applies'
        WHERE c.relation = 'carries_out' AND f.id = s.parent
      )
    UNION
    -- ...or that sit under the flow itself.
    SELECT ir.id FROM records ir WHERE ir.kind = 'interaction_requirement' AND ir.parent = s.parent
  )
ORDER BY record, message
