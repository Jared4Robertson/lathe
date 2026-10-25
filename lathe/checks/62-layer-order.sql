-- A layer's order is a whole number, and no two layers in one domain share it, as for capabilities
-- (28-capability-order.sql). A missing order is missing-required-field. Orders are compared as numbers,
-- so 1 and 01 clash.
SELECT severity, "check", record, message FROM (
  SELECT 'error' AS severity, 'layer-order' AS "check", nullif(c.id, '') AS record,
         'Layer ' || coalesce(nullif(c.id, ''), c.path) || ' has order "' || c.raw
         || '", which is not a whole number such as 1 or 2.' AS message
  FROM (
    SELECT r.path, r.id, trim(f.value) AS raw
    FROM records r JOIN fields f ON f.path = r.path AND f.name = 'order'
    WHERE r.kind = 'layer' AND trim(f.value) <> ''
  ) c
  WHERE NOT regexp_full_match(c.raw, '\d+')
  UNION ALL
  SELECT 'error', 'layer-order', nullif(a.id, ''),
         'Layer ' || coalesce(nullif(a.id, ''), a.path) || ' has order ' || a.n || ' in domain ' || a.parent
         || ', the same as ' || string_agg(coalesce(nullif(b.id, ''), b.path), ', ' ORDER BY b.id, b.path)
         || '; each layer in a domain needs its own order.'
  FROM (
    SELECT r.path, r.id, r.parent, TRY_CAST(trim(f.value) AS HUGEINT) AS n
    FROM records r JOIN fields f ON f.path = r.path AND f.name = 'order'
    WHERE r.kind = 'layer' AND regexp_full_match(trim(f.value), '\d+')
  ) a
  JOIN (
    SELECT r.path, r.id, r.parent, TRY_CAST(trim(f.value) AS HUGEINT) AS n
    FROM records r JOIN fields f ON f.path = r.path AND f.name = 'order'
    WHERE r.kind = 'layer' AND regexp_full_match(trim(f.value), '\d+')
  ) b ON b.parent = a.parent AND b.n = a.n AND b.path <> a.path
  GROUP BY a.id, a.path, a.n, a.parent
)
ORDER BY record, message
