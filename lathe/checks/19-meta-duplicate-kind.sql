-- The meta-model defines each kind once.
SELECT 'error' AS severity, 'meta-duplicate-kind' AS "check", NULL AS record,
       'The meta-model defines kind "' || kind || '" ' || count(*) || ' times; each kind must be defined once.' AS message
FROM kinds
WHERE kind IS NOT NULL AND kind <> ''
GROUP BY kind
HAVING count(*) > 1
ORDER BY kind
