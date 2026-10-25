-- Every section a kind names in `kinds.csv` is a folder that `sections.csv` lists.
--
-- A kind in an unknown folder is shown in no folder of the app (FORMAT.md section 15). Fix the kind's
-- `section`, or add the folder to the product's `sections.csv`.
--
-- severity: error
SELECT DISTINCT 'error' AS severity, 'unknown-section' AS "check", NULL AS record,
       'Kind "' || kind || '" sits in section "' || section || '", which sections.csv does not list.' AS message
FROM kinds
WHERE coalesce(section, '') <> ''
  AND section NOT IN (SELECT section FROM sections)
ORDER BY message
