-- A record with more children of one kind than the product's `structure.maxChildren` setting.
--
-- The setting is read from `lathe.config.json` (default 15) through the settings table. A parent with that
-- many children of one kind is missing a level between them, such as a capability, a layer or another
-- aggregate. Children are counted per kind. Tests are exempt: the app groups them by what they prove
-- (FORMAT.md section 15), so they are never shown as one list. A child whose parent does not exist is only
-- unknown-parent. Add a level and move the children into it.
--
-- severity: warning
SELECT 'warning' AS severity, 'too-many-children' AS "check", c.parent AS record,
       upper(left(p.kind, 1)) || replace(substr(p.kind, 2), '_', ' ') || ' ' || c.parent || ' has ' || c.n
       || ' children of kind ' || c.kind || ', more than the ' || m.max_children
       || ' that structure.maxChildren allows; add a level between them, such as a capability, a layer or another aggregate.' AS message
FROM (
  SELECT parent, kind, count(DISTINCT path) AS n
  FROM records
  WHERE parent IS NOT NULL AND parent <> '' AND kind <> 'test'
  GROUP BY parent, kind
) c
JOIN (SELECT id, any_value(kind) AS kind FROM records WHERE id <> '' GROUP BY id) p ON p.id = c.parent
CROSS JOIN (SELECT TRY_CAST(any_value(value) AS INTEGER) AS max_children FROM settings WHERE name = 'structure.maxChildren') m
WHERE c.n > m.max_children
ORDER BY record, message
