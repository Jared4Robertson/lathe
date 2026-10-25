-- Work to do: a manual test whose run_by file exists but never mentions it. Nothing ties the file to the
-- test: it names neither the test's ID, nor any ID the test proves (each target of a relation whose role is
-- 'proof'), nor the test's `key` when it has one. Manual tests are not held to the automated rules
-- (test-file-missing-id, proof-not-in-file), so a silent file is a warning: the steps a person follows
-- should say which test they carry out. A missing file is test-file-missing instead.
SELECT 'warning' AS severity, 'manual-test-file-silent' AS "check", nullif(f.record, '') AS record,
       'Manual test ' || coalesce(nullif(f.record, ''), f.path) || ' is run by ' || f.file || ', but that file names neither '
       || coalesce(nullif(f.record, ''), 'the test''s ID') || ' nor any ID it proves'
       || coalesce(' nor its key "' || k.key || '"', '')
       || '; name the test in the file, or point run_by at the file that carries it out.' AS message
FROM file_facts f
LEFT JOIN (SELECT path, max(trim(value)) AS key FROM fields WHERE name = 'key' AND trim(value) <> '' GROUP BY path) k
       ON k.path = f.path
WHERE f.kind = 'test' AND f.file_exists AND NOT coalesce(f.contains_id, false)
  AND coalesce((SELECT max(lower(trim(s.value))) FROM fields s WHERE s.path = f.path AND s.name = 'state'), '') = 'manual'
  AND NOT EXISTS (SELECT 1 FROM file_mentions m WHERE m.path = f.path AND f.record <> '' AND m.mentioned = f.record)
  AND NOT EXISTS (
    SELECT 1
    FROM links l
    JOIN records t ON t.id = l.target
    JOIN relations rr ON rr.relation = l.relation AND rr.role = 'proof' AND rr.source_kind = f.kind
                     AND rr.target_kind IN (t.kind, '*')
    JOIN file_mentions m ON m.path = f.path AND m.mentioned = l.target
    WHERE l.path = f.path
  )
ORDER BY f.path
