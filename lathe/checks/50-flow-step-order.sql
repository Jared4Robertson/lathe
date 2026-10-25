-- A flow step's order is a whole number that no other step of its flow has.
--
-- Steps are read in `order` (FORMAT.md section 14). Orders are compared as numbers, so 1 and 01 clash. A
-- missing order is missing-required-field. Give each step of the flow its own whole-number `order`.
--
-- severity: error
-- kinds: flow_step
SELECT severity, "check", record, message FROM (
  SELECT 'error' AS severity, 'flow-step-order' AS "check", nullif(s.id, '') AS record,
         'Flow step ' || coalesce(nullif(s.id, ''), s.path) || ' has order "' || s.raw
         || '", which is not a whole number such as 1 or 2.' AS message
  FROM (
    SELECT r.path, r.id, trim(f.value) AS raw
    FROM records r JOIN fields f ON f.path = r.path AND f.name = 'order'
    WHERE r.kind = 'flow_step' AND trim(f.value) <> ''
  ) s
  WHERE NOT regexp_full_match(s.raw, '\d+')
  UNION ALL
  SELECT 'error', 'flow-step-order', nullif(a.id, ''),
         'Flow step ' || coalesce(nullif(a.id, ''), a.path) || ' has order ' || a.n || ' in flow ' || a.parent
         || ', the same as ' || string_agg(coalesce(nullif(b.id, ''), b.path), ', ' ORDER BY b.id, b.path)
         || '; each step of a flow needs its own order.'
  FROM (
    SELECT r.path, r.id, r.parent, TRY_CAST(trim(f.value) AS HUGEINT) AS n
    FROM records r JOIN fields f ON f.path = r.path AND f.name = 'order'
    WHERE r.kind = 'flow_step' AND r.parent IS NOT NULL AND regexp_full_match(trim(f.value), '\d+')
  ) a
  JOIN (
    SELECT r.path, r.id, r.parent, TRY_CAST(trim(f.value) AS HUGEINT) AS n
    FROM records r JOIN fields f ON f.path = r.path AND f.name = 'order'
    WHERE r.kind = 'flow_step' AND r.parent IS NOT NULL AND regexp_full_match(trim(f.value), '\d+')
  ) b ON b.parent = a.parent AND b.n = a.n AND b.path <> a.path
  GROUP BY a.id, a.path, a.n, a.parent
)
ORDER BY record, message
