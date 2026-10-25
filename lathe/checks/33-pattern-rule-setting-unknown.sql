-- A pattern rule that depends on a setting names it in `setting`, which must be one of the settings
-- its pattern lists. A rule whose parent is not a pattern is reported by the parent checks instead.
SELECT DISTINCT 'error' AS severity, 'pattern-rule-setting-unknown' AS "check", nullif(r.id, '') AS record,
       'Pattern rule ' || coalesce(nullif(r.id, ''), r.path) || ' depends on the setting "' || trim(st.value)
       || '", which pattern ' || p.id || ' does not list; '
       || CASE WHEN trim(coalesce(ps.value, '')) = '' THEN 'it has no settings.' ELSE 'its settings are: ' || trim(ps.value) || '.' END AS message
FROM records r
JOIN fields st ON st.path = r.path AND st.name = 'setting' AND trim(st.value) <> ''
JOIN records p ON p.id = r.parent AND p.kind = 'pattern'
LEFT JOIN fields ps ON ps.path = p.path AND ps.name = 'settings'
WHERE r.kind = 'pattern_rule'
  AND NOT list_contains(string_split_regex(trim(coalesce(ps.value, '')), '\s+'), trim(st.value))
ORDER BY record, message
