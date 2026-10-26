-- A step's order is a whole number that no other step on its path of the flow has, and each path's steps are numbered without gaps.
--
-- The steps of a flow (`flow_step`) and of a technical flow (`design_step`) are read in `order` (FORMAT.md
-- sections 14 and 22), within their `path`: a short name such as main or
-- refused, compared trimmed and in any letter case. A step with no path is on the main path. Orders are
-- compared as numbers, so 1 and 01 clash, and the steps of each path of a flow are numbered 1, 2, 3 and so
-- on. A path whose orders skip a number is reported once, on the first step after the gap, and only when
-- each of its orders is a whole number that no other step of the path has, so one mistake gives one error.
-- A missing order is missing-required-field. Give each step of the path its own whole-number `order`, and
-- close the gap.
--
-- severity: error
-- kinds: flow_step design_step
SELECT severity, "check", record, message FROM (
WITH all_steps AS (
  SELECT r.path, r.id, r.parent, trim(coalesce(f.value, '')) AS raw,
         -- The step's kind and its flow's, as the meta-model labels them: a "Flow step" in a "flow".
         coalesce(k.label, r.kind) AS label, lower(coalesce(fk.label, sk.flow_kind)) AS flow_label,
         coalesce(nullif(lower(trim(p.value)), ''), 'main') AS step_path,
         CASE WHEN regexp_full_match(trim(f.value), '\d+') THEN TRY_CAST(trim(f.value) AS HUGEINT) END AS n
  FROM records r
  LEFT JOIN (SELECT path, any_value(value) AS value FROM fields WHERE name = 'order' GROUP BY path) f ON f.path = r.path
  LEFT JOIN (SELECT path, any_value(value) AS value FROM fields WHERE name = 'path' GROUP BY path) p ON p.path = r.path
  JOIN (VALUES ('flow_step', 'flow'), ('design_step', 'design_flow')) sk(step_kind, flow_kind) ON sk.step_kind = r.kind
  LEFT JOIN (SELECT kind, any_value(label) AS label FROM kinds GROUP BY kind) k ON k.kind = r.kind
  LEFT JOIN (SELECT kind, any_value(label) AS label FROM kinds GROUP BY kind) fk ON fk.kind = sk.flow_kind
),
steps AS (SELECT * FROM all_steps WHERE raw <> ''),
-- Where a message names the path: nothing for the main path, so a flow with one path reads as before.
named AS (
  SELECT *, CASE WHEN step_path = 'main' THEN '' ELSE ' on path ' || step_path END AS on_path FROM steps
),
-- Each (flow, path) whose steps all have a whole-number order, none repeated: only these are checked for gaps.
clean AS (
  SELECT parent, step_path
  FROM all_steps
  WHERE parent IS NOT NULL
  GROUP BY parent, step_path
  HAVING bool_and(n IS NOT NULL) AND count(DISTINCT n) = count(*)
),
gaps AS (
  SELECT s.parent, s.step_path, g.missing
  FROM clean s
  CROSS JOIN LATERAL (
    SELECT m AS missing
    FROM range(1, (SELECT max(n) FROM steps x WHERE x.parent = s.parent AND x.step_path = s.step_path)::BIGINT) t(m)
    WHERE NOT EXISTS (SELECT 1 FROM steps x WHERE x.parent = s.parent AND x.step_path = s.step_path AND x.n = t.m)
  ) g
)
SELECT 'error' AS severity, 'step-order' AS "check", nullif(s.id, '') AS record,
       s.label || ' ' || coalesce(nullif(s.id, ''), s.path) || ' has order "' || s.raw
       || '", which is not a whole number such as 1 or 2.' AS message
FROM steps s
WHERE s.n IS NULL
UNION ALL
SELECT 'error', 'step-order', nullif(a.id, ''),
       a.label || ' ' || coalesce(nullif(a.id, ''), a.path) || ' has order ' || a.n || a.on_path || ' in ' || a.flow_label || ' ' || a.parent
       || ', the same as ' || string_agg(coalesce(nullif(b.id, ''), b.path), ', ' ORDER BY b.id, b.path)
       || CASE WHEN a.step_path = 'main' THEN '; each step of a ' || a.flow_label || ' needs its own order.'
               ELSE '; each step of a path needs its own order.' END
FROM named a
JOIN named b ON b.parent = a.parent AND b.step_path = a.step_path AND b.n = a.n AND b.path <> a.path
WHERE a.parent IS NOT NULL AND a.n IS NOT NULL
GROUP BY a.id, a.path, a.n, a.parent, a.step_path, a.on_path, a.label, a.flow_label
UNION ALL
SELECT 'error', 'step-order', nullif(s.id, ''),
       s.label || ' ' || coalesce(nullif(s.id, ''), s.path) || ' has order ' || s.n || s.on_path || ' in ' || s.flow_label || ' ' || s.parent
       || ', but no step' || CASE WHEN s.step_path = 'main' THEN '' ELSE ' of that path' END || ' has order '
       || g.missing_list || '; number the steps of '
       || CASE WHEN s.step_path = 'main' THEN 'a ' || s.flow_label ELSE 'a path' END || ' 1, 2, 3 and so on, with no gaps.'
FROM (
  SELECT parent, step_path, min(missing) AS first_missing,
         string_agg(missing::VARCHAR, ', ' ORDER BY missing) AS missing_list
  FROM gaps GROUP BY parent, step_path
) g
JOIN named s ON s.parent = g.parent AND s.step_path = g.step_path
WHERE s.n = (SELECT min(x.n) FROM steps x WHERE x.parent = g.parent AND x.step_path = g.step_path AND x.n > g.first_missing)
)
ORDER BY record, message
