-- A fitness record's date is a real calendar date written YYYY-MM-DD. A missing date is missing-required-field.
SELECT 'error' AS severity, 'bad-fitness-date' AS "check", nullif(r.id, '') AS record,
       coalesce(nullif(r.id, ''), r.path) || ' has date "' || f.value || '", which is not a real date written YYYY-MM-DD.' AS message
FROM records r
JOIN fields f ON f.path = r.path AND f.name = 'date'
WHERE r.kind = 'fitness' AND trim(f.value) <> ''
  AND (NOT regexp_full_match(trim(f.value), '\d{4}-\d{2}-\d{2}')
       OR try_strptime(trim(f.value), '%Y-%m-%d') IS NULL)
ORDER BY r.path
