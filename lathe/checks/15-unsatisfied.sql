-- An obligation that no design link targets yet.
--
-- An obligation is any kind the meta-model marks as one. A proof-only obligation kind (kinds.csv obligation
-- `proof`) asks for no design, so it is never reported. A pattern rule is owed by each domain that follows
-- its pattern, itself or through a use case (unless, followed only through use cases, its setting is Not
-- applicable in every one of them there, as in lathe/src/coverage.ts), and only a component in that domain
-- designs it there, so it is reported once for each domain that owes it and lacks one. Link a component to
-- it with `satisfies`, or another design relation.
--
-- severity: warning
-- kinds: requirement domain_rule interaction_requirement
SELECT severity, "check", record, message FROM (
WITH design_links AS (
  SELECT DISTINCT l.target, t.kind AS target_kind, s.domain AS source_domain
  FROM links l
  JOIN records s ON s.id = l.source AND s.path = l.path
  JOIN records t ON t.id = l.target
  JOIN relations ro ON ro.role = 'design' AND ro.relation = l.relation AND ro.source_kind = s.kind
                   AND ro.target_kind IN (t.kind, '*')
),
follows AS (
  SELECT DISTINCT u.domain, l.target AS pattern, u.path
  FROM records u JOIN links l ON l.path = u.path AND l.relation = 'follows'
  WHERE u.kind = 'use_case' AND u.id <> '' AND u.domain IS NOT NULL
),
domain_follows AS (
  SELECT DISTINCT d.id AS domain, l.target AS pattern
  FROM records d JOIN links l ON l.path = d.path AND l.relation = 'follows'
  WHERE d.kind = 'domain' AND d.id <> ''
),
owed_pattern_rules AS (
  SELECT DISTINCT f.domain, r.id, r.kind
  FROM records r JOIN domain_follows f ON f.pattern = r.parent
  WHERE r.kind = 'pattern_rule' AND r.domain IS NULL AND r.id <> ''
    AND r.kind IN (SELECT kind FROM kinds WHERE obligation AND NOT proof_only)
  UNION
  SELECT domain, id, kind FROM (
    SELECT f.domain, r.id, r.kind,
      bool_and(coalesce(trim(st.value), '') <> ''
               AND regexp_full_match(coalesce(trim(uv.value), ''), '(?is)not\s+applicable\s*:\s*\S.*')) AS not_applicable
    FROM records r
    JOIN follows f ON f.pattern = r.parent
    LEFT JOIN fields st ON st.path = r.path AND st.name = 'setting'
    LEFT JOIN fields uv ON uv.path = f.path AND uv.name = trim(st.value)
    WHERE r.kind = 'pattern_rule' AND r.domain IS NULL AND r.id <> ''
      AND r.kind IN (SELECT kind FROM kinds WHERE obligation AND NOT proof_only)
    GROUP BY f.domain, r.id, r.kind
  ) WHERE NOT not_applicable
)
SELECT DISTINCT 'warning' AS severity, 'unsatisfied' AS "check", r.id AS record,
       'Nothing designs ' || replace(r.kind, '_', ' ') || ' ' || r.id || ': no component satisfies it.' AS message
FROM records r
WHERE r.id <> ''
  AND r.kind IN (SELECT kind FROM kinds WHERE obligation AND NOT proof_only)
  AND NOT (r.kind = 'pattern_rule' AND r.domain IS NULL)
  AND NOT EXISTS (SELECT 1 FROM design_links x WHERE x.target = r.id AND x.target_kind = r.kind)
UNION ALL
SELECT DISTINCT 'warning', 'unsatisfied', o.id,
       'Pattern rule ' || o.id || ' is not designed in ' || o.domain || ': no component in ' || o.domain
       || ' satisfies it, though the domain follows its pattern.'
FROM owed_pattern_rules o
WHERE NOT EXISTS (SELECT 1 FROM design_links x WHERE x.target = o.id AND x.target_kind = o.kind
                                                AND x.source_domain = o.domain)
)
ORDER BY record, message
