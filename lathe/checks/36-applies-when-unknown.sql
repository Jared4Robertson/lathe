-- A pattern rule's `applies_when` is well formed and names one of its pattern's settings.
--
-- A pattern rule that applies only for some values of a setting says so in `applies_when`, written
-- `<setting> is <value>` or `<setting> is not <value>`; it is then waived in each domain where no follower
-- (a following use case, or the domain when it follows the pattern itself) gives that setting a value that
-- meets it. A malformed field, or one naming a setting the pattern does not list, waives nothing. A rule
-- whose parent is not a pattern is reported by the parent checks instead. Write the field as
-- `<setting> is <value>` with one of the pattern's settings, add the setting to the pattern, or remove the
-- field.
--
-- severity: error
-- kinds: pattern_rule pattern
SELECT DISTINCT 'error' AS severity, 'applies-when-unknown' AS "check", nullif(r.id, '') AS record,
       'Pattern rule ' || coalesce(nullif(r.id, ''), r.path) || ' says it applies when "' || trim(aw.value) || '", '
       || CASE WHEN NOT regexp_full_match(trim(aw.value), '(?is)\S+\s+is\s+\S.*')
               THEN 'which is not written as "<setting> is <value>" or "<setting> is not <value>".'
               ELSE 'but pattern ' || p.id || ' has no setting "' || regexp_extract(trim(aw.value), '(?is)^(\S+)\s+is\s', 1) || '"; '
                    || CASE WHEN trim(coalesce(ps.value, '')) = '' THEN 'it has no settings.' ELSE 'its settings are: ' || trim(ps.value) || '.' END
          END AS message
FROM records r
JOIN fields aw ON aw.path = r.path AND aw.name = 'applies_when'
JOIN records p ON p.id = r.parent AND p.kind = 'pattern'
LEFT JOIN fields ps ON ps.path = p.path AND ps.name = 'settings'
WHERE r.kind = 'pattern_rule' AND trim(aw.value) <> ''
  AND (NOT regexp_full_match(trim(aw.value), '(?is)\S+\s+is\s+\S.*')
       OR NOT list_contains(string_split_regex(trim(coalesce(ps.value, '')), '\s+'),
                            regexp_extract(trim(aw.value), '(?is)^(\S+)\s+is\s', 1)))
ORDER BY record, message
