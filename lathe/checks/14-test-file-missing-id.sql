-- An automated test's run_by file must mention the test's ID or the ID of a record it proves
-- (the target of any relation whose role is 'proof'), for example in the test's name.
-- A test with no state is automated; manual and planned tests are not checked here.
SELECT 'error' AS severity, 'test-file-missing-id' AS "check", nullif(f.record, '') AS record,
       'Test ' || coalesce(nullif(f.record, ''), f.path) || ' is run by ' || f.file || ', but that file mentions neither '
       || coalesce(nullif(f.record, ''), 'its ID') || ' nor the ID of a record it proves.' AS message
FROM file_facts f
WHERE f.kind = 'test' AND f.file_exists AND NOT f.contains_id
  AND coalesce((SELECT max(lower(trim(s.value))) FROM fields s WHERE s.path = f.path AND s.name = 'state'), '')
      NOT IN ('manual', 'planned')
  AND NOT EXISTS (
    SELECT 1
    FROM file_mentions m
    JOIN links l ON l.path = m.path AND l.target = m.mentioned
    JOIN records t ON t.id = l.target
    JOIN relations rr ON rr.relation = l.relation AND rr.role = 'proof' AND rr.source_kind = f.kind
                     AND (rr.target_kind = t.kind OR rr.target_kind = '*')
    WHERE m.path = f.path
  )
ORDER BY f.path
