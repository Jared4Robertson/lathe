-- An entity's role is root or child.
--
-- `root` is the aggregate's root record and `child` one of its parts (FORMAT.md section 17), in any letter
-- case. A missing or empty role is missing-required-field only. Fix the `role` value.
--
-- severity: error
-- kinds: entity
SELECT 'error' AS severity, 'entity-role' AS "check", nullif(r.id, '') AS record,
       'Entity ' || coalesce(nullif(r.id, ''), r.path) || ' has role "' || trim(f.value)
       || '"; set role to root, for the aggregate''s root record, or child, for one of its parts.' AS message
FROM records r
JOIN fields f ON f.path = r.path AND f.name = 'role'
WHERE r.kind = 'entity' AND trim(f.value) <> '' AND lower(trim(f.value)) NOT IN ('root', 'child')
ORDER BY record, message
