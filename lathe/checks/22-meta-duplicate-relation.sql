-- The meta-model lists each relation rule (relation, source kind, target kind) once.
SELECT 'error' AS severity, 'meta-duplicate-relation' AS "check", NULL AS record,
       'The meta-model lists relation rule "' || relation || '" from ' || source_kind || ' to ' || target_kind || ' '
       || count(*) || ' times; each rule must be listed once.' AS message
FROM relations
WHERE relation IS NOT NULL AND source_kind IS NOT NULL AND target_kind IS NOT NULL
GROUP BY relation, source_kind, target_kind
HAVING count(*) > 1
ORDER BY relation, source_kind, target_kind
