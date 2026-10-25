-- A product check that reads a setting.
--
-- It reports the structure.maxChildren value it sees in the settings table, so a test can tell the setting
-- reached the checks. Nothing needs fixing.
--
-- severity: warning
SELECT 'warning' AS severity, 'max-children-setting' AS "check", NULL AS record,
       'structure.maxChildren is ' || value || '.' AS message
FROM settings
WHERE name = 'structure.maxChildren'
