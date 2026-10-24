-- A record has every field its kind requires, with a non-empty value.
SELECT 'error' AS severity, 'missing-required-field' AS "check", nullif(r.id, '') AS record,
       coalesce(nullif(r.id, ''), r.path) || ' (' || r.kind || ') has no "' || req.name || '" field, which every ' || r.kind || ' must have.' AS message
FROM records r
JOIN (SELECT kind, unnest(required_fields) AS name FROM kinds) req ON req.kind = r.kind
WHERE NOT EXISTS (
  SELECT 1 FROM fields f WHERE f.path = r.path AND f.name = req.name AND trim(f.value) <> ''
)
ORDER BY r.path, req.name
