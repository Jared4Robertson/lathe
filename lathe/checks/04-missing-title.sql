-- Every record has a title.
--
-- A title is the short name every page and list shows. For a rule or requirement, it is the rule in a few
-- words. Add a `title` field to the record's header.
--
-- severity: error
SELECT 'error' AS severity, 'missing-title' AS "check", nullif(id, '') AS record,
       coalesce(nullif(id, ''), path) || ' has no title.' AS message
FROM records
WHERE trim(title) = ''
ORDER BY path
