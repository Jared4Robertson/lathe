-- Work to do: an obligation (any kind the meta-model marks as one) that no automated or manual
-- test proves through a 'proof' link. A test with no state is automated; a planned test is not proof.
SELECT DISTINCT 'warning' AS severity, 'unproved' AS "check", r.id AS record,
       'No test proves ' || replace(r.kind, '_', ' ') || ' ' || r.id ||
       CASE WHEN 'planned' IN (
         SELECT coalesce(nullif((SELECT lower(trim(any_value(f.value))) FROM fields f
                                 WHERE f.path = s.path AND f.record = s.id AND f.name = 'state'), ''), 'automated')
         FROM links l
         JOIN records s ON s.id = l.source AND s.path = l.path
         JOIN relations ro ON ro.role = 'proof' AND ro.relation = l.relation AND ro.source_kind = s.kind
                          AND ro.target_kind IN (r.kind, '*')
         WHERE l.target = r.id
       ) THEN ' yet: its test is only planned.' ELSE '.' END AS message
FROM records r
WHERE r.id <> ''
  AND r.kind IN (SELECT kind FROM kinds WHERE obligation)
  AND NOT EXISTS (
    SELECT 1 FROM links l
    JOIN records s ON s.id = l.source AND s.path = l.path
    JOIN relations ro ON ro.role = 'proof' AND ro.relation = l.relation AND ro.source_kind = s.kind
                     AND ro.target_kind IN (r.kind, '*')
    WHERE l.target = r.id
      AND coalesce(nullif((SELECT lower(trim(any_value(f.value))) FROM fields f
                           WHERE f.path = s.path AND f.record = s.id AND f.name = 'state'), ''), 'automated')
          IN ('automated', 'manual')
  )
ORDER BY record
