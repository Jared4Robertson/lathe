-- A pattern that no use case and no domain follows.
--
-- No domain owes its rules, so they count in no domain's coverage. Link the use cases or domains that apply
-- it with `follows`, or remove the pattern if nothing needs it.
--
-- severity: warning
-- kinds: pattern
SELECT 'warning' AS severity, 'pattern-not-followed' AS "check", p.id AS record,
       'No use case or domain follows pattern ' || p.id || ', so '
       || CASE (SELECT count(DISTINCT r.id) FROM records r WHERE r.kind = 'pattern_rule' AND r.parent = p.id AND r.id <> '')
            WHEN 0 THEN 'it is not used anywhere.'
            WHEN 1 THEN 'its 1 rule is not counted in any domain''s coverage.'
            ELSE 'its ' || (SELECT count(DISTINCT r.id) FROM records r WHERE r.kind = 'pattern_rule' AND r.parent = p.id AND r.id <> '')
                 || ' rules are not counted in any domain''s coverage.'
          END AS message
FROM (SELECT DISTINCT id FROM records WHERE kind = 'pattern' AND id <> '') p
WHERE NOT EXISTS (
  SELECT 1 FROM links l JOIN records u ON u.id = l.source AND u.path = l.path
  WHERE l.relation = 'follows' AND l.target = p.id AND u.kind IN ('use_case', 'domain')
)
ORDER BY record
