-- A record's body cites an ID that no record has.
--
-- A citation is an ID-shaped token with one of the workspace's known prefixes (FORMAT.md section 12). Code
-- spans and fenced code blocks are not read. Fix the wording, or put the ID in code if it is only an
-- example.
--
-- severity: warning
SELECT 'warning' AS severity, 'unknown-id-in-prose' AS "check", nullif(m.record, '') AS record,
       coalesce(nullif(m.record, ''), m.path) || ' mentions ' || m.cited || ', which does not exist.' AS message
FROM prose_mentions m
WHERE NOT EXISTS (SELECT 1 FROM records r WHERE r.id = m.cited)
ORDER BY m.record, m.path, m.cited
