-- Each meta-model folder lists a relation rule (relation, source kind, target kind) at most once.
-- A row in a later folder (a product's extension) for a rule already listed restates or rewords that
-- rule; it is not a duplicate.
SELECT 'error' AS severity, 'meta-duplicate-relation' AS "check", NULL AS record,
       folder || ' lists relation rule "' || relation || '" from ' || source_kind || ' to ' || target_kind || ' '
       || count(*) || ' times; each rule must be listed once in a folder.' AS message
FROM meta_relation_rows
WHERE relation <> '' AND source_kind <> '' AND target_kind <> ''
GROUP BY folder, relation, source_kind, target_kind
HAVING count(*) > 1
ORDER BY folder, relation, source_kind, target_kind
