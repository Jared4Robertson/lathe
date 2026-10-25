-- An automated test's `run_by` file names the test, so the code can be traced back to it.
--
-- The file must name the test's own ID, or else every ID the test proves (each target of a relation whose
-- role is `proof`); a missing proved ID is proof-not-in-file. This check reports the two cases that leave no
-- proved ID to name:
--
--   * a test with a `key` whose file does not contain that key text (the ID rules then do not apply);
--   * a test that proves no record and whose file does not name its own ID.
--
-- A test that proves no record but `supports` one (a check of a mechanism that backs an obligation without
-- proving it) is not reported: support is never proof, so its file owes no ID. A test with a `key_file` (the
-- file that holds its key, when it runs from a shared class in another file) is judged by that file instead
-- of `run_by`; a key file that is missing or outside the root is test-file-missing only. A test with no state
-- is automated; manual and planned tests are not checked here. Put the test's ID in the test's name in the
-- file, or fix its `key` or `key_file`.
--
-- severity: error
-- kinds: test
SELECT 'error' AS severity, 'test-file-missing-id' AS "check", nullif(f.record, '') AS record,
       'Test ' || coalesce(nullif(f.record, ''), f.path)
       || CASE WHEN f.key_file IS NOT NULL THEN ' names the key file ' || f.key_file ELSE ' is run by ' || f.file END
       || ', but that file '
       || CASE WHEN k.key IS NOT NULL THEN 'does not contain its key "' || k.key || '".'
               ELSE 'does not mention ' || coalesce(nullif(f.record, ''), 'its ID') || ', and the test proves no record whose ID it could name instead.'
          END AS message
FROM file_facts f
LEFT JOIN (SELECT path, max(trim(value)) AS key FROM fields WHERE name = 'key' AND trim(value) <> '' GROUP BY path) k
       ON k.path = f.path
WHERE f.kind = 'test' AND f.file_exists AND NOT f.contains_id AND f.key_file_exists IS NOT false
  AND coalesce((SELECT max(lower(trim(s.value))) FROM fields s WHERE s.path = f.path AND s.name = 'state'), '')
      NOT IN ('manual', 'planned')
  AND (k.key IS NOT NULL OR (NOT EXISTS (
    SELECT 1
    FROM links l
    JOIN records t ON t.id = l.target
    JOIN relations rr ON rr.relation = l.relation AND rr.role = 'proof' AND rr.source_kind = f.kind
                     AND (rr.target_kind = t.kind OR rr.target_kind = '*')
    WHERE l.path = f.path
  ) AND NOT EXISTS (
    SELECT 1
    FROM links l
    JOIN records t ON t.id = l.target
    WHERE l.path = f.path AND l.relation = 'supports'
  )))
ORDER BY f.path
