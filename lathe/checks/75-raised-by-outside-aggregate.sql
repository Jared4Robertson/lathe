-- A domain event's `raised_by` names an entity of the event's own aggregate.
--
-- An event is raised by its aggregate (FORMAT.md section 17), so the entity whose change raises it is one of
-- that aggregate's entities. What another aggregate does about the event is said by its `reacts_to`. An
-- event with no `raised_by` is not reported. A link to a record that does not exist, or that is not an
-- entity, is reported by dangling-link or relation-not-allowed instead. When the target ID is duplicated, the
-- link is reported only if no entity with that ID shares the event's aggregate. Point `raised_by` at an
-- entity of the event's aggregate, or move the event under the aggregate that raises it.
--
-- severity: error
-- kinds: domain_event entity
SELECT 'error' AS severity, 'raised-by-outside-aggregate' AS "check", nullif(x.source, '') AS record,
       'Event ' || coalesce(nullif(x.source, ''), x.path) || ' is raised_by ' || x.target || ', which sits in '
       || string_agg(DISTINCT x.target_parent, ' or ' ORDER BY x.target_parent) || ', not in the event''s aggregate '
       || x.source_parent || '; point raised_by at an entity of ' || x.source_parent
       || ', or move the event under the aggregate that raises it.' AS message
FROM (
  SELECT l.path, l.source, l.target, s.parent AS source_parent, t.parent AS target_parent
  FROM links l
  JOIN records s ON s.path = l.path AND s.kind = 'domain_event'
  JOIN records t ON t.id = l.target AND t.kind = 'entity'
  WHERE l.relation = 'raised_by'
) x
GROUP BY x.path, x.source, x.target, x.source_parent
HAVING NOT bool_or(x.target_parent IS NOT DISTINCT FROM x.source_parent)
ORDER BY record, message
