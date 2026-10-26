-- A record with more children of one kind than the product's `structure.maxChildren` setting.
--
-- The setting is read from `lathe.config.json` (default 15) through the settings table. A parent with that
-- many children of one kind is missing a level between them, such as a capability, a layer or another
-- aggregate. Children are counted per kind. Tests are exempt: the app groups them by what they prove
-- (FORMAT.md section 15), so they are never shown as one list. A flow's steps are counted per path
-- (FORMAT.md section 14), since each path reads as its own list, and requirements, interaction requirements,
-- pattern rules and standard rules per `group` (FORMAT.md section 21), since each group reads under its own heading; the
-- ungrouped ones are one list. Groups are compared trimmed and in any letter case. A child whose parent does
-- not exist is only unknown-parent. Add a level, or a group, and move the children into it.
--
-- severity: warning
SELECT 'warning' AS severity, 'too-many-children' AS "check", c.parent AS record,
       upper(left(p.kind, 1)) || replace(substr(p.kind, 2), '_', ' ') || ' ' || c.parent || ' has ' || c.n
       || ' children of kind ' || c.kind
       || CASE WHEN c.kind = 'flow_step' AND c.bucket <> 'main' THEN ' on path ' || c.label
               WHEN c.kind <> 'flow_step' AND c.bucket <> '' THEN ' in group ' || c.label ELSE '' END
       || ', more than the ' || m.max_children
       || ' that structure.maxChildren allows; add a level between them, such as a capability, a layer or another aggregate.' AS message
FROM (
  SELECT r.parent, r.kind,
         -- A flow step's path (main when it has none); a grouped kind's group (none when it has none); every
         -- other kind is one list.
         CASE WHEN r.kind = 'flow_step' THEN coalesce(nullif(lower(trim(fp.value)), ''), 'main')
              WHEN r.kind IN ('requirement', 'interaction_requirement', 'pattern_rule', 'standard_rule') THEN lower(trim(coalesce(fg.value, '')))
              ELSE '' END AS bucket,
         -- The path or group as first written.
         min(CASE WHEN r.kind = 'flow_step' THEN trim(coalesce(fp.value, '')) ELSE trim(coalesce(fg.value, '')) END) AS label,
         count(DISTINCT r.path) AS n
  FROM records r
  LEFT JOIN (SELECT path, any_value(value) AS value FROM fields WHERE name = 'path' GROUP BY path) fp ON fp.path = r.path
  LEFT JOIN (SELECT path, any_value(value) AS value FROM fields WHERE name = 'group' GROUP BY path) fg ON fg.path = r.path
  WHERE r.parent IS NOT NULL AND r.parent <> '' AND r.kind <> 'test'
  GROUP BY r.parent, r.kind, bucket
) c
JOIN (SELECT id, any_value(kind) AS kind FROM records WHERE id <> '' GROUP BY id) p ON p.id = c.parent
CROSS JOIN (SELECT TRY_CAST(any_value(value) AS INTEGER) AS max_children FROM settings WHERE name = 'structure.maxChildren') m
WHERE c.n > m.max_children
ORDER BY record, message
