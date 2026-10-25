-- A test's `run_by` file, and its `key_file` when it names one, exists.
--
-- For an automated or manual test a missing file is an error. A planned test may name the file it will live
-- in, so for it a missing file is a warning, as for a component whose file does not exist yet. An automated
-- test with no `run_by` at all is test-run-by-missing. A `key_file` (the file that holds the test's key, when
-- the test runs from a shared class in another file) must be a file under the product root; one outside it
-- is always an error. A key file is read only for a test that names its `run_by`. Fix the path (relative to
-- the repo root), or write the file.
--
-- severity: error, warning
-- kinds: test
SELECT severity, "check", record, message FROM (
  SELECT CASE WHEN st.state = 'planned' THEN 'warning' ELSE 'error' END AS severity,
         'test-file-missing' AS "check", nullif(f.record, '') AS record, f.path,
         'Test ' || coalesce(nullif(f.record, ''), f.path) || ' is run by ' || f.file || ', which does not exist'
         || CASE WHEN st.state = 'planned' THEN ' yet.' ELSE '.' END AS message
  FROM file_facts f
  LEFT JOIN (SELECT path, max(lower(trim(value))) AS state FROM fields WHERE name = 'state' GROUP BY path) st ON st.path = f.path
  WHERE f.kind = 'test' AND NOT f.file_exists
  UNION ALL
  SELECT CASE WHEN st.state = 'planned' AND f.key_file_inside THEN 'warning' ELSE 'error' END,
         'test-file-missing', nullif(f.record, ''), f.path,
         'Test ' || coalesce(nullif(f.record, ''), f.path) || ' names the key file ' || f.key_file || ', which '
         || CASE WHEN NOT f.key_file_inside THEN 'is outside the product root; name a file under it.'
                 WHEN st.state = 'planned' THEN 'does not exist yet.'
                 ELSE 'does not exist.' END
  FROM file_facts f
  LEFT JOIN (SELECT path, max(lower(trim(value))) AS state FROM fields WHERE name = 'state' GROUP BY path) st ON st.path = f.path
  WHERE f.kind = 'test' AND f.key_file IS NOT NULL AND NOT f.key_file_exists
)
ORDER BY path, message
