-- A record with more children of one kind than the product's `structure.maxChildren` setting.
--
-- The setting is read from `lathe.config.json` (default 15) through the settings table. A parent with that
-- many children of one kind is missing a level between them, such as a capability, a layer or another
-- aggregate. Children are counted per kind. Tests are exempt: the app groups them by what they prove
-- (FORMAT.md section 15), so they are never shown as one list. The steps of a flow or a technical flow are
-- counted per path (FORMAT.md sections 14 and 21), since each path reads as its own list. A child whose parent does not exist is only
-- unknown-parent. Add a level and move the children into it.
--
-- severity: warning
SELECT 'warning' AS severity, 'too-many-children' AS "check", c.parent AS record,
       upper(left(p.kind, 1)) || replace(substr(p.kind, 2), '_', ' ') || ' ' || c.parent || ' has ' || c.n
       || ' children of kind ' || c.kind || CASE WHEN c.bucket IN ('', 'main') THEN '' ELSE ' on path ' || c.bucket END
       || ', more than the ' || m.max_children
       || ' that structure.maxChildren allows; add a level between them, such as a capability, a layer or another aggregate.' AS message
FROM (
  SELECT r.parent, r.kind,
         -- A step's path (main when it has none); every other kind is one list.
         CASE WHEN r.kind IN ('flow_step', 'design_step') THEN coalesce(nullif(lower(trim(fp.value)), ''), 'main') ELSE '' END AS bucket,
         count(DISTINCT r.path) AS n
  FROM records r
  LEFT JOIN (SELECT path, any_value(value) AS value FROM fields WHERE name = 'path' GROUP BY path) fp ON fp.path = r.path
  WHERE r.parent IS NOT NULL AND r.parent <> '' AND r.kind <> 'test'
  GROUP BY r.parent, r.kind, bucket
) c
JOIN (SELECT id, any_value(kind) AS kind FROM records WHERE id <> '' GROUP BY id) p ON p.id = c.parent
CROSS JOIN (SELECT TRY_CAST(any_value(value) AS INTEGER) AS max_children FROM settings WHERE name = 'structure.maxChildren') m
WHERE c.n > m.max_children
ORDER BY record, message
