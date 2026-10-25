-- Every record has an ID in the form `^[A-Z][A-Z0-9]*(-[A-Z0-9]+)*$`.
--
-- An ID is capital letters and digits, starting with a letter, in parts joined by single hyphens, such as
-- `TL-LEND-UC01`. A record with no ID, or with lower-case letters, spaces or other signs in it, is reported.
-- Rewrite the ID in that form, following the ID convention for its kind.
--
-- severity: error
SELECT 'error' AS severity, 'bad-id' AS "check", nullif(id, '') AS record,
       CASE WHEN id = '' THEN path || ' has no id.'
            ELSE 'ID ' || id || ' (in ' || path || ') does not match the ID format: capital letters and digits in parts joined by hyphens, starting with a letter.'
       END AS message
FROM records
WHERE NOT regexp_full_match(id, '[A-Z][A-Z0-9]*(-[A-Z0-9]+)*')
ORDER BY path
