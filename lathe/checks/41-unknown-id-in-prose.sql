-- Drift: a record's body cites an ID with one of the workspace's known prefixes, but no record has that ID.
-- Code spans and fenced code blocks are not read (FORMAT.md section 12).
SELECT 'warning' AS severity, 'unknown-id-in-prose' AS "check", nullif(m.record, '') AS record,
       coalesce(nullif(m.record, ''), m.path) || ' mentions ' || m.cited || ', which does not exist.' AS message
FROM prose_mentions m
WHERE NOT EXISTS (SELECT 1 FROM records r WHERE r.id = m.cited)
ORDER BY m.record, m.path, m.cited
