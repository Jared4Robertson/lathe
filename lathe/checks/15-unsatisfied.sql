-- Work to do: an obligation (any kind the meta-model marks as one) that no 'design' link targets.
SELECT DISTINCT 'warning' AS severity, 'unsatisfied' AS "check", r.id AS record,
       'Nothing designs ' || replace(r.kind, '_', ' ') || ' ' || r.id || ': no component satisfies it.' AS message
FROM records r
WHERE r.id <> ''
  AND r.kind IN (SELECT kind FROM kinds WHERE obligation)
  AND NOT EXISTS (
    SELECT 1 FROM links l
    JOIN records s ON s.id = l.source AND s.path = l.path
    JOIN relations ro ON ro.role = 'design' AND ro.relation = l.relation AND ro.source_kind = s.kind
                     AND ro.target_kind IN (r.kind, '*')
    WHERE l.target = r.id
  )
ORDER BY record
