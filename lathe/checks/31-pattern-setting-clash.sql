-- A use case follows two patterns that share a setting name.
--
-- The use case has one field for both settings, so the two cannot be given different values. Rename the
-- setting in one of the patterns, and its field in the use cases that follow it.
--
-- severity: warning
-- kinds: use_case pattern
SELECT 'warning' AS severity, 'pattern-setting-clash' AS "check", x.use_case AS record,
       'Use case ' || x.use_case || ' follows patterns ' || string_agg(x.pattern, ' and ' ORDER BY x.pattern)
       || ', which share the setting "' || x.name || '"; its one "' || x.name || '" field answers both.' AS message
FROM (
  SELECT DISTINCT u.id AS use_case, s.pattern, s.name
  FROM records u
  JOIN links l ON l.path = u.path AND l.relation = 'follows'
  JOIN (
    SELECT DISTINCT p.id AS pattern, t.name
    FROM records p
    JOIN fields f ON f.path = p.path AND f.name = 'settings'
    CROSS JOIN unnest(string_split_regex(trim(f.value), '\s+')) AS t(name)
    WHERE p.kind = 'pattern' AND p.id <> '' AND t.name <> ''
  ) s ON s.pattern = l.target
  WHERE u.kind = 'use_case' AND u.id <> ''
) x
GROUP BY x.use_case, x.name
HAVING count(*) > 1
ORDER BY record, message
