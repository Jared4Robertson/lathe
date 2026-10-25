-- A product check that reads a setting: it reports the structure.maxChildren value it sees.
SELECT 'warning' AS severity, 'max-children-setting' AS "check", NULL AS record,
       'structure.maxChildren is ' || value || '.' AS message
FROM settings
WHERE name = 'structure.maxChildren'
