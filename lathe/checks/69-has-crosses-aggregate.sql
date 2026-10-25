-- has_one and has_many link an entity to its parts, and parts belong to their aggregate (FORMAT.md section 17),
-- so both ends sit in the same aggregate. Only refers_to may cross aggregates and domains. A link to a record
-- that does not exist, or that is not an entity, is reported by dangling-link or relation-not-allowed instead.
-- When the target ID is duplicated, the link is reported only if no entity with that ID shares the source's
-- aggregate.
SELECT 'error' AS severity, 'has-crosses-aggregate' AS "check", nullif(x.source, '') AS record,
       'Entity ' || coalesce(nullif(x.source, ''), x.path) || ' ' || x.relation || ' ' || x.target
       || ', which sits in ' || string_agg(DISTINCT x.target_parent, ' or ' ORDER BY x.target_parent)
       || ', not in ' || x.source_parent || '; a part belongs to its aggregate, so use refers_to, or move '
       || x.target || ' into ' || x.source_parent || '.' AS message
FROM (
  SELECT l.path, l.source, l.relation, l.target, s.parent AS source_parent, t.parent AS target_parent
  FROM links l
  JOIN records s ON s.path = l.path AND s.kind = 'entity'
  JOIN records t ON t.id = l.target AND t.kind = 'entity'
  WHERE l.relation IN ('has_one', 'has_many')
) x
GROUP BY x.path, x.source, x.relation, x.target, x.source_parent
HAVING NOT bool_or(x.target_parent IS NOT DISTINCT FROM x.source_parent)
ORDER BY record, message
