-- An automated test's file names every ID the test proves, unless it names the test's own ID.
--
-- Each target of a relation whose role is `proof` must appear in the file, as a whole ID, when the file does
-- not name the test's own ID. Each proved ID the file leaves out is one error. A test whose file names its
-- own ID vouches for all its claims; a test with a `key` is checked by test-file-missing-id instead. A test
-- with a `key_file` is judged by that file instead of `run_by`; a key file that is missing or outside the
-- root is test-file-missing only. A `supports` link is not a proof claim, so its target need not appear.
-- Manual and planned tests are not checked here. Name the ID in the test's name in the file, name the test's
-- own ID there, or remove the claim.
--
-- severity: error
-- kinds: test
SELECT 'error' AS severity, 'proof-not-in-file' AS "check", nullif(record, '') AS record,
       'Test ' || coalesce(nullif(record, ''), path) || ' proves ' || target || ', but its '
       || CASE WHEN key_file IS NOT NULL THEN 'key file ' || key_file ELSE 'file ' || file END
       || ' names neither ' || coalesce(nullif(record, ''), 'the test''s ID') || ' nor ' || target
       || '; name the test''s ID, or every ID it proves, in that file.' AS message
FROM (
  SELECT DISTINCT f.path, f.record, f.file, f.key_file, l.target
  FROM file_facts f
  JOIN links l ON l.path = f.path
  JOIN records t ON t.id = l.target
  JOIN relations rr ON rr.relation = l.relation AND rr.role = 'proof' AND rr.source_kind = f.kind
                   AND (rr.target_kind = t.kind OR rr.target_kind = '*')
  WHERE f.kind = 'test' AND f.file_exists AND NOT f.contains_id AND f.key_file_exists IS NOT false
    AND coalesce((SELECT max(lower(trim(s.value))) FROM fields s WHERE s.path = f.path AND s.name = 'state'), '')
        NOT IN ('manual', 'planned')
    AND NOT EXISTS (SELECT 1 FROM fields k WHERE k.path = f.path AND k.name = 'key' AND trim(k.value) <> '')
    AND NOT EXISTS (SELECT 1 FROM file_mentions m WHERE m.path = f.path AND m.mentioned = l.target)
)
ORDER BY path, target
