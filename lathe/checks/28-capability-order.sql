-- A capability's order is a whole number that no other capability in its domain has.
--
-- Orders are compared as numbers, so 1 and 01 clash. A missing order is missing-required-field. Give each
-- capability in the domain its own whole-number `order`.
--
-- severity: error
-- kinds: capability
SELECT severity, "check", record, message FROM (
  SELECT 'error' AS severity, 'capability-order' AS "check", nullif(c.id, '') AS record,
         'Capability ' || coalesce(nullif(c.id, ''), c.path) || ' has order "' || c.raw
         || '", which is not a whole number such as 1 or 2.' AS message
  FROM (
    SELECT r.path, r.id, trim(f.value) AS raw
    FROM records r JOIN fields f ON f.path = r.path AND f.name = 'order'
    WHERE r.kind = 'capability' AND trim(f.value) <> ''
  ) c
  WHERE NOT regexp_full_match(c.raw, '\d+')
  UNION ALL
  SELECT 'error', 'capability-order', nullif(a.id, ''),
         'Capability ' || coalesce(nullif(a.id, ''), a.path) || ' has order ' || a.n || ' in domain ' || a.parent
         || ', the same as ' || string_agg(coalesce(nullif(b.id, ''), b.path), ', ' ORDER BY b.id, b.path)
         || '; each capability in a domain needs its own order.'
  FROM (
    SELECT r.path, r.id, r.parent, TRY_CAST(trim(f.value) AS HUGEINT) AS n
    FROM records r JOIN fields f ON f.path = r.path AND f.name = 'order'
    WHERE r.kind = 'capability' AND regexp_full_match(trim(f.value), '\d+')
  ) a
  JOIN (
    SELECT r.path, r.id, r.parent, TRY_CAST(trim(f.value) AS HUGEINT) AS n
    FROM records r JOIN fields f ON f.path = r.path AND f.name = 'order'
    WHERE r.kind = 'capability' AND regexp_full_match(trim(f.value), '\d+')
  ) b ON b.parent = a.parent AND b.n = a.n AND b.path <> a.path
  GROUP BY a.id, a.path, a.n, a.parent
)
ORDER BY record, message
