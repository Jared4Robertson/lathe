-- Each kind's required fields are valid field names.
--
-- A field name is lower-case letters, digits and underscores, starting with a letter, and not one of the
-- fields every record has (`id`, `kind`, `title`, `parent`, `links`). Rename the field in `kinds.csv`.
--
-- severity: error
SELECT DISTINCT 'error' AS severity, 'meta-bad-required-field' AS "check", NULL AS record,
       'Kind "' || kind || '" requires field "' || name || '", which is not a valid field name'
       || CASE WHEN name IN ('id', 'kind', 'title', 'parent', 'links') THEN ': every record already has it.'
               ELSE ': use lower-case letters, digits and underscores, starting with a letter.' END AS message
FROM (SELECT kind, unnest(required_fields) AS name FROM kinds)
WHERE NOT regexp_full_match(name, '[a-z][a-z0-9_]*')
   OR name IN ('id', 'kind', 'title', 'parent', 'links')
ORDER BY message
