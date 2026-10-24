-- Each meta-model folder defines a kind at most once. A row in a later folder (a product's extension)
-- for a kind already defined widens that kind; it is not a duplicate.
SELECT 'error' AS severity, 'meta-duplicate-kind' AS "check", NULL AS record,
       folder || ' defines kind "' || kind || '" ' || count(*) || ' times; each kind must be defined once in a folder.' AS message
FROM meta_kind_rows
WHERE kind IS NOT NULL AND kind <> ''
GROUP BY folder, kind
HAVING count(*) > 1
ORDER BY folder, kind
