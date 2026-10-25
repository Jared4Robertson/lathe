-- An automated test names the file that runs it in `run_by`.
--
-- A test with no state, or state automated, is automated. Manual and planned tests need no `run_by`. Add the
-- path of the test file, relative to the repo root, or give the test the state it really has.
--
-- severity: error
-- kinds: test
SELECT 'error' AS severity, 'test-run-by-missing' AS "check", nullif(r.id, '') AS record,
       'Test ' || coalesce(nullif(r.id, ''), r.path) || ' is automated but has no "run_by" naming the file that runs it; '
       || 'name that file, or give the test state manual or planned.' AS message
FROM records r
WHERE r.kind = 'test'
  AND coalesce((SELECT max(lower(trim(s.value))) FROM fields s WHERE s.path = r.path AND s.name = 'state'), '')
      NOT IN ('manual', 'planned')
  AND NOT EXISTS (SELECT 1 FROM fields s WHERE s.path = r.path AND s.name = 'run_by' AND trim(s.value) <> '')
ORDER BY r.path
