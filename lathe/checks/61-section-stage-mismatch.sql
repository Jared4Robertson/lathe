-- A kind's section belongs to the kind's own stage.
--
-- A Define kind sits in a Define folder and a Design kind in a Design folder (FORMAT.md section 14). A
-- product-level section, listed with no stage (such as shared), may hold a kind of any stage. Change the
-- kind's `section` or `stage`, or the folder's stage.
--
-- severity: error
SELECT DISTINCT 'error' AS severity, 'section-stage-mismatch' AS "check", NULL AS record,
       'Kind "' || k.kind || '" is in stage "' || coalesce(k.stage, '') || '", but its section "' || k.section
       || '" belongs to stage "' || s.stage || '".' AS message
FROM kinds k
JOIN sections s ON s.section = k.section
WHERE coalesce(s.stage, '') <> ''
  AND coalesce(k.stage, '') <> s.stage
ORDER BY message
