-- A kind's section belongs to the kind's own stage (FORMAT.md section 15). A product-level section, listed
-- with no stage (such as shared), may hold a kind of any stage.
SELECT DISTINCT 'error' AS severity, 'section-stage-mismatch' AS "check", NULL AS record,
       'Kind "' || k.kind || '" is in stage "' || coalesce(k.stage, '') || '", but its section "' || k.section
       || '" belongs to stage "' || s.stage || '".' AS message
FROM kinds k
JOIN sections s ON s.section = k.section
WHERE coalesce(s.stage, '') <> ''
  AND coalesce(k.stage, '') <> s.stage
ORDER BY message
