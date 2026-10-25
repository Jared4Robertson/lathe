-- A known relation is allowed from the source record's kind to the target record's kind.
--
-- Each row of `relations.csv` allows one relation from one source kind to one target kind (`*` allows any
-- target kind). When the target ID is duplicated (duplicate-id), the link is reported only if no record with
-- that ID could be its target, so one duplicate does not turn every link to it into an error. Link to a
-- record of an allowed kind, use the relation meant for this pair, or allow the pair in the product's
-- extension.
--
-- severity: error
SELECT 'error' AS severity, 'relation-not-allowed' AS "check", nullif(x.source, '') AS record,
       coalesce(nullif(x.source, ''), x.path) || ' (' || x.source_kind || ') ' || x.relation || ' ' || x.target || ' ('
       || string_agg(DISTINCT x.target_kind, ' or ' ORDER BY x.target_kind) || '), but "' || x.relation
       || '" is not allowed from ' || x.source_kind || ' to '
       || string_agg(DISTINCT x.target_kind, ' or ' ORDER BY x.target_kind) || '.' AS message
FROM (
  SELECT l.path, l.source, l.relation, l.target, s.kind AS source_kind, t.kind AS target_kind,
         EXISTS (
           SELECT 1 FROM relations rr
           WHERE rr.relation = l.relation AND rr.source_kind = s.kind AND (rr.target_kind = t.kind OR rr.target_kind = '*')
         ) AS allowed
  FROM links l
  JOIN records s ON s.path = l.path
  JOIN records t ON t.id = l.target
  WHERE l.relation IN (SELECT relation FROM relations)
    AND s.kind IN (SELECT kind FROM kinds)
) x
GROUP BY x.path, x.source, x.relation, x.target, x.source_kind
HAVING NOT bool_or(x.allowed)
ORDER BY record, message
