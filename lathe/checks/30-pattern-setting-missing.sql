-- A use case that follows a pattern gives each of the pattern's settings as a header field named
-- exactly as the pattern lists it: a value, or "Not applicable:" (any letter case) and a reason.
-- Setting names that are not valid field names are reported by bad-pattern-settings instead.
-- Only a pattern with settings asks for them: a pattern with no `settings` field, or an empty one, asks
-- nothing of the use cases that follow it. A domain that follows a pattern gives no settings.
SELECT 'error' AS severity, 'pattern-setting-missing' AS "check", x.use_case AS record,
       CASE WHEN coalesce(x.value, '') = ''
            THEN 'Use case ' || x.use_case || ' follows pattern ' || x.pattern || ' but has no "' || x.name
                 || '" field; give it a value, or "Not applicable:" and a reason.'
            ELSE 'Use case ' || x.use_case || ' says pattern ' || x.pattern || '''s "' || x.name
                 || '" setting is not applicable but gives no reason after "Not applicable:".'
       END AS message
FROM (
  SELECT DISTINCT u.id AS use_case, s.pattern, s.name,
         (SELECT trim(any_value(f.value)) FROM fields f WHERE f.path = u.path AND f.name = s.name) AS value
  FROM records u
  JOIN links l ON l.path = u.path AND l.relation = 'follows'
  JOIN (
    SELECT DISTINCT p.id AS pattern, t.name
    FROM records p
    JOIN fields f ON f.path = p.path AND f.name = 'settings'
    CROSS JOIN unnest(string_split_regex(trim(f.value), '\s+')) AS t(name)
    WHERE p.kind = 'pattern' AND p.id <> '' AND t.name <> ''
      AND regexp_full_match(t.name, '[a-z][a-z0-9_]*') AND t.name NOT IN ('id', 'kind', 'title', 'parent', 'links')
  ) s ON s.pattern = l.target
  WHERE u.kind = 'use_case' AND u.id <> ''
) x
WHERE coalesce(x.value, '') = ''
   OR regexp_full_match(x.value, '(?i)not\s+applicable\s*:\s*')
ORDER BY record, message
