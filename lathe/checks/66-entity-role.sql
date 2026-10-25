-- An entity's role (FORMAT.md section 17) is root, the aggregate's root record, or child, one of its parts,
-- in any letter case. A missing or empty role is missing-required-field only.
SELECT 'error' AS severity, 'entity-role' AS "check", nullif(r.id, '') AS record,
       'Entity ' || coalesce(nullif(r.id, ''), r.path) || ' has role "' || trim(f.value)
       || '"; set role to root, for the aggregate''s root record, or child, for one of its parts.' AS message
FROM records r
JOIN fields f ON f.path = r.path AND f.name = 'role'
WHERE r.kind = 'entity' AND trim(f.value) <> '' AND lower(trim(f.value)) NOT IN ('root', 'child')
ORDER BY record, message
