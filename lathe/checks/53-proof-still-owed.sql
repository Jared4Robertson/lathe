-- An obligation that is already proved, but that a planned test is also meant to prove.
--
-- Coverage counts these in `planned_any` but not in `planned`; this check names each one, with the planned
-- test that still owes its proof, so the list behind `planned_any` is never only a count. An obligation not
-- yet proved whose test is only planned is reported by unproved instead.
--
-- Proof is judged as in lathe/src/coverage.ts: an obligation in a domain is owed by that domain and any test
-- may prove it; a pattern rule is owed by each domain that follows its pattern, itself or through one of its
-- use cases (unless the domain follows only through use cases that all mark the rule's setting Not
-- applicable), and only tests in that domain prove it there or owe it there. An automated test's proof counts
-- only when its file backs it. Write the planned test, or drop its claim if the proof it owes is already
-- made.
--
-- severity: warning
-- kinds: test
SELECT severity, "check", record, message FROM (
WITH states AS (
  SELECT path, record, lower(trim(any_value(value))) AS state FROM fields WHERE name = 'state' GROUP BY path, record
),
proof_links AS (
  SELECT DISTINCT l.target, t.kind AS target_kind, s.id AS source, s.domain AS source_domain,
    coalesce(nullif(st.state, ''), 'automated') AS state,
    CASE WHEN s.kind <> 'test' OR coalesce(nullif(st.state, ''), 'automated') <> 'automated' THEN true
         ELSE coalesce((SELECT bool_or(f.contains_id) FROM file_facts f WHERE f.path = s.path), false)
              OR EXISTS (SELECT 1 FROM file_mentions m WHERE m.path = s.path AND m.mentioned = l.target)
    END AS backed
  FROM links l
  JOIN records s ON s.id = l.source AND s.path = l.path
  JOIN records t ON t.id = l.target
  JOIN relations ro ON ro.role = 'proof' AND ro.relation = l.relation AND ro.source_kind = s.kind
                   AND ro.target_kind IN (t.kind, '*')
  LEFT JOIN states st ON st.path = s.path AND st.record = s.id
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
owed AS (
  SELECT DISTINCT r.domain, r.id, r.kind, false AS per_domain
  FROM records r
  WHERE r.domain IS NOT NULL AND r.id <> '' AND r.kind IN (SELECT kind FROM kinds WHERE obligation)
  UNION
  SELECT domain, id, kind, true AS per_domain FROM (
    SELECT f.domain, r.id, r.kind,
      bool_and(coalesce(trim(st.value), '') <> ''
               AND regexp_full_match(coalesce(trim(uv.value), ''), '(?is)not\s+applicable\s*:\s*\S.*')) AS not_applicable
    FROM records r
    JOIN follows f ON f.pattern = r.parent
    LEFT JOIN fields st ON st.path = r.path AND st.name = 'setting'
    LEFT JOIN fields uv ON uv.path = f.path AND uv.name = trim(st.value)
    WHERE r.kind = 'pattern_rule' AND r.domain IS NULL AND r.id <> ''
      AND r.kind IN (SELECT kind FROM kinds WHERE obligation)
    GROUP BY f.domain, r.id, r.kind
  ) WHERE NOT not_applicable
  UNION
  SELECT df.domain, r.id, r.kind, true AS per_domain
  FROM records r JOIN domain_follows df ON df.pattern = r.parent
  WHERE r.kind = 'pattern_rule' AND r.domain IS NULL AND r.id <> ''
    AND r.kind IN (SELECT kind FROM kinds WHERE obligation)
)
SELECT DISTINCT 'warning' AS severity, 'proof-still-owed' AS "check", o.id AS record,
       upper(left(o.kind, 1)) || replace(substr(o.kind, 2), '_', ' ') || ' ' || o.id || ' is proved'
       || CASE WHEN o.per_domain THEN ' in ' || o.domain ELSE '' END
       || ', but planned test ' || p.source || CASE WHEN o.per_domain THEN ' there' ELSE '' END
       || ' still owes a proof of it; write that test, or drop its proves link to ' || o.id || '.' AS message
FROM owed o
JOIN proof_links p ON p.target = o.id AND p.target_kind = o.kind AND p.state = 'planned' AND p.source <> ''
                  AND (NOT o.per_domain OR p.source_domain = o.domain)
WHERE EXISTS (SELECT 1 FROM proof_links x WHERE x.target = o.id AND x.target_kind = o.kind
                                            AND x.state IN ('automated', 'manual') AND x.backed
                                            AND (NOT o.per_domain OR x.source_domain = o.domain))
)
ORDER BY record, message
