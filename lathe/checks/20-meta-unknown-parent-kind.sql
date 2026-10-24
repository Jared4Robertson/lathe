-- Every kind named in a kind's parent_kinds is a kind the meta-model defines.
SELECT DISTINCT 'error' AS severity, 'meta-unknown-parent-kind' AS "check", NULL AS record,
       'Kind "' || p.kind || '" names parent kind "' || p.parent_kind || '", which the meta-model does not define.' AS message
FROM (SELECT kind, unnest(parent_kinds) AS parent_kind FROM kinds) p
WHERE p.parent_kind NOT IN (SELECT kind FROM kinds WHERE kind IS NOT NULL)
ORDER BY message
