-- A component that satisfies no obligation.
--
-- A component exists to design or implement something the product owes, so it links each obligation it
-- serves with a `design` link such as `satisfies`. One with no such link has no purpose the spec can see: it
-- is a leftover, or its purpose is unwritten. Shared infrastructure is no exception: link the requirements,
-- domain rules or pattern rules it makes possible. A link to a record that does not exist does not count (it
-- is only a dangling-link). Link what the component designs or implements with "satisfies", or remove it.
--
-- severity: warning
-- kinds: component
SELECT 'warning' AS severity, 'component-satisfies-nothing' AS "check", c.id AS record,
       'Component ' || c.id || ' satisfies no obligation; link each requirement, domain rule or pattern rule it '
       || 'designs or implements with "satisfies" (for shared infrastructure, the ones it makes possible), '
       || 'or remove it.' AS message
FROM records c
WHERE c.kind = 'component' AND c.id <> ''
  AND NOT EXISTS (
    SELECT 1 FROM links l
    JOIN records t ON t.id = l.target
    JOIN relations ro ON ro.role = 'design' AND ro.relation = l.relation AND ro.source_kind = c.kind
                     AND ro.target_kind IN (t.kind, '*')
    WHERE l.path = c.path
  )
ORDER BY record
