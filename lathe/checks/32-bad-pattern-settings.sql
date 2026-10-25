-- A pattern's settings are field names a use case can carry.
--
-- A field name is lower-case letters, digits and underscores, starting with a letter, and not one of the
-- fields every record has (`id`, `kind`, `title`, `parent`, `links`). A missing settings field is
-- missing-required-field. Rename the setting in the pattern's `settings` list.
--
-- severity: error
-- kinds: pattern
SELECT DISTINCT 'error' AS severity, 'bad-pattern-settings' AS "check", nullif(p.id, '') AS record,
       'Pattern ' || coalesce(nullif(p.id, ''), p.path) || ' has setting "' || s.name || '", which is not a valid field name'
       || CASE WHEN s.name IN ('id', 'kind', 'title', 'parent', 'links') THEN ': every record already has it.'
               ELSE ': use lower-case letters, digits and underscores, starting with a letter.' END AS message
FROM records p
JOIN fields f ON f.path = p.path AND f.name = 'settings'
CROSS JOIN unnest(string_split_regex(trim(f.value), '\s+')) AS s(name)
WHERE p.kind = 'pattern' AND s.name <> ''
  AND (NOT regexp_full_match(s.name, '[a-z][a-z0-9_]*') OR s.name IN ('id', 'kind', 'title', 'parent', 'links'))
ORDER BY record, message
