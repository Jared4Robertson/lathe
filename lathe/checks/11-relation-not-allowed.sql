-- A known relation must be allowed from the source's kind to the target's kind ('*' allows any target kind).
SELECT DISTINCT 'error' AS severity, 'relation-not-allowed' AS "check", nullif(l.source, '') AS record,
       coalesce(nullif(l.source, ''), l.path) || ' (' || s.kind || ') ' || l.relation || ' ' || t.id || ' (' || t.kind
       || '), but "' || l.relation || '" is not allowed from ' || s.kind || ' to ' || t.kind || '.' AS message
FROM links l
JOIN records s ON s.path = l.path
JOIN records t ON t.id = l.target
WHERE l.relation IN (SELECT relation FROM relations)
  AND s.kind IN (SELECT kind FROM kinds)
  AND NOT EXISTS (
    SELECT 1 FROM relations rr
    WHERE rr.relation = l.relation AND rr.source_kind = s.kind AND (rr.target_kind = t.kind OR rr.target_kind = '*')
  )
ORDER BY record, message
