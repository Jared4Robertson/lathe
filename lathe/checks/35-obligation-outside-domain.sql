-- An obligation that sits in no domain.
--
-- It counts in no domain's coverage, so it is reported rather than silently dropped. A pattern rule under a
-- pattern is the exception: each domain that follows the pattern owes it (pattern-not-followed reports a
-- pattern nobody follows). Move the record under a domain, or fix its parent chain.
--
-- severity: warning
-- kinds: requirement domain_rule interaction_requirement
SELECT DISTINCT 'warning' AS severity, 'obligation-outside-domain' AS "check", nullif(r.id, '') AS record,
       upper(left(r.kind, 1)) || replace(substr(r.kind, 2), '_', ' ') || ' ' || coalesce(nullif(r.id, ''), r.path)
       || ' sits in no domain, so no domain''s coverage counts it; move it under a domain.' AS message
FROM records r
WHERE r.domain IS NULL
  AND r.kind IN (SELECT kind FROM kinds WHERE obligation)
  AND NOT (r.kind = 'pattern_rule' AND EXISTS (SELECT 1 FROM records p WHERE p.id = r.parent AND p.kind = 'pattern'))
ORDER BY record, message
