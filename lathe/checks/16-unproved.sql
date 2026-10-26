-- An obligation that no automated or manual test proves yet.
--
-- A test proves an obligation through a `proof` link such as `proves`. A test with no state is automated; a
-- planned test is not proof. A pattern rule is owed by the domains the owed_pattern_rules table names (each
-- domain that follows its pattern, unless the rule is Not applicable or waived there, as in
-- lathe/src/coverage.ts), and only a test in that domain proves it there, so it is reported once for each
-- domain that owes it and lacks one. An automated test's proof counts only when its
-- file backs it, as in coverage: the file names the test's own ID (or its key), or names that target. An
-- unbacked claim is also a proof-not-in-file error. Write a test that `proves` it, and name the test in its
-- file.
--
-- severity: warning
-- kinds: requirement domain_rule interaction_requirement pattern_rule
SELECT severity, "check", record, message FROM (
WITH stated AS (
  SELECT DISTINCT l.target, t.kind AS target_kind, s.domain AS source_domain, s.kind AS source_kind, s.path,
         coalesce(nullif((SELECT lower(trim(any_value(f.value))) FROM fields f
                          WHERE f.path = s.path AND f.record = s.id AND f.name = 'state'), ''), 'automated') AS state
  FROM links l
  JOIN records s ON s.id = l.source AND s.path = l.path
  JOIN records t ON t.id = l.target
  JOIN relations ro ON ro.role = 'proof' AND ro.relation = l.relation AND ro.source_kind = s.kind
                   AND ro.target_kind IN (t.kind, '*')
),
proof_links AS (
  SELECT DISTINCT target, target_kind, source_domain, state
  FROM stated x
  WHERE x.source_kind <> 'test' OR x.state <> 'automated'
     OR coalesce((SELECT bool_or(f.contains_id) FROM file_facts f WHERE f.path = x.path), false)
     OR EXISTS (SELECT 1 FROM file_mentions m WHERE m.path = x.path AND m.mentioned = x.target)
)
SELECT DISTINCT 'warning' AS severity, 'unproved' AS "check", r.id AS record,
       'No test proves ' || replace(r.kind, '_', ' ') || ' ' || r.id ||
       CASE WHEN EXISTS (SELECT 1 FROM proof_links x WHERE x.target = r.id AND x.target_kind = r.kind AND x.state = 'planned')
            THEN ' yet: its test is only planned.' ELSE '.' END AS message
FROM records r
WHERE r.id <> ''
  AND r.kind IN (SELECT kind FROM kinds WHERE obligation)
  AND NOT (r.kind = 'pattern_rule' AND r.domain IS NULL)
  AND NOT EXISTS (SELECT 1 FROM proof_links x WHERE x.target = r.id AND x.target_kind = r.kind
                                               AND x.state IN ('automated', 'manual'))
UNION ALL
SELECT DISTINCT 'warning', 'unproved', o.id,
       'Pattern rule ' || o.id || ' is not proved in ' || o.domain ||
       CASE WHEN EXISTS (SELECT 1 FROM proof_links x WHERE x.target = o.id AND x.target_kind = o.kind
                                                     AND x.source_domain = o.domain AND x.state = 'planned')
            THEN ' yet: its test there is only planned.'
            ELSE ': no test in ' || o.domain || ' proves it, though the domain follows its pattern.' END
FROM owed_pattern_rules o
WHERE NOT EXISTS (SELECT 1 FROM proof_links x WHERE x.target = o.id AND x.target_kind = o.kind
                                               AND x.source_domain = o.domain AND x.state IN ('automated', 'manual'))
)
ORDER BY record, message
