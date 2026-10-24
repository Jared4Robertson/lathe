// Coverage queries: for each domain, its requirements and domain rules, and whether a
// component satisfies each one and a test proves it.

const ITEMS = `
  WITH items AS (
    SELECT DISTINCT r.domain, r.id, r.kind,
      EXISTS (SELECT 1 FROM links l JOIN records s ON s.id = l.source
              WHERE l.target = r.id AND l.relation = 'satisfies' AND s.kind = 'component') AS satisfied,
      EXISTS (SELECT 1 FROM links l JOIN records s ON s.id = l.source
              WHERE l.target = r.id AND l.relation = 'proves' AND s.kind = 'test') AS proved
    FROM records r
    WHERE r.kind IN ('requirement', 'domain_rule') AND r.domain IS NOT NULL AND r.id <> ''
  )`;

/** One row per domain record, including domains with nothing in them yet. */
export const COVERAGE_COUNTS_SQL = `${ITEMS}
  SELECT d.id AS domain,
    count(i.id) FILTER (WHERE i.kind = 'requirement')::INTEGER AS requirements,
    count(i.id) FILTER (WHERE i.kind = 'requirement' AND i.satisfied)::INTEGER AS requirements_satisfied,
    count(i.id) FILTER (WHERE i.kind = 'requirement' AND i.proved)::INTEGER AS requirements_proved,
    count(i.id) FILTER (WHERE i.kind = 'domain_rule')::INTEGER AS rules,
    count(i.id) FILTER (WHERE i.kind = 'domain_rule' AND i.satisfied)::INTEGER AS rules_satisfied,
    count(i.id) FILTER (WHERE i.kind = 'domain_rule' AND i.proved)::INTEGER AS rules_proved
  FROM (SELECT DISTINCT id FROM records WHERE kind = 'domain' AND id <> '') d
  LEFT JOIN items i ON i.domain = d.id
  GROUP BY d.id
  ORDER BY d.id`;

/** One row per missing link: (domain, id, kind, missing). */
export const COVERAGE_GAPS_SQL = `${ITEMS}
  SELECT domain, id, kind, 'satisfies' AS missing FROM items WHERE NOT satisfied
  UNION ALL
  SELECT domain, id, kind, 'proves' AS missing FROM items WHERE NOT proved
  ORDER BY domain, id, missing DESC`;
