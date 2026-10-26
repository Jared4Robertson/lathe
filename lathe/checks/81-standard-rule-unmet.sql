-- A standard rule that nothing meets or cites.
--
-- A standard rule asks nothing of a domain, so it owes no coverage (FORMAT.md section 20), but a rule that no
-- component, design step or test `meets`, and that no other record of its product cites in its prose, has no
-- use, and nothing outlives its purpose. A citation from the rule itself or from its own standard does not
-- count, so a standard that lists its rules by ID does not keep them all alive. A `meets` link from any
-- record counts here; one from a kind the meta-model does not allow is relation-not-allowed. Link what
-- follows the rule with `meets`, cite the rule where it is followed, or remove the rule.
--
-- severity: warning
-- kinds: standard_rule standard component test
SELECT 'warning' AS severity, 'standard-rule-unmet' AS "check", r.id AS record,
       'Nothing meets or cites standard rule ' || r.id || ' (' || r.title || '). Add meets: [' || r.id
       || '] to a component or test that follows it, cite it where it is followed, or remove it.' AS message
FROM records r
WHERE r.kind = 'standard_rule' AND r.id <> ''
  AND NOT EXISTS (SELECT 1 FROM links l WHERE l.relation = 'meets' AND l.target = r.id)
  AND NOT EXISTS (
    SELECT 1 FROM prose_mentions m JOIN records s ON s.id = m.record
    WHERE m.cited = r.id AND m.record <> r.id AND m.record <> coalesce(r.parent, '')
      AND s.product IS NOT DISTINCT FROM r.product
  )
ORDER BY record
