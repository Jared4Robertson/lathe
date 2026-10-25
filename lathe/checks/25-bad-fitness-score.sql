-- A fitness record's score is a whole number from 1 to 5.
--
-- 1 means the product does not serve its purpose, 5 that it serves it fully. A missing score is
-- missing-required-field. Write the score as `score: 4` or `score: "4"`.
--
-- severity: error
-- kinds: fitness
SELECT 'error' AS severity, 'bad-fitness-score' AS "check", nullif(r.id, '') AS record,
       coalesce(nullif(r.id, ''), r.path) || ' has score "' || f.value || '", which is not a whole number from 1 to 5.' AS message
FROM records r
JOIN fields f ON f.path = r.path AND f.name = 'score'
WHERE r.kind = 'fitness' AND trim(f.value) <> ''
  AND NOT regexp_full_match(trim(f.value), '[1-5]')
ORDER BY r.path
