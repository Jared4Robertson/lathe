-- A domain rule under its domain names the aggregates it ties together with `involves`; a rule under an aggregate or entity names none.
--
-- A domain rule sits on the aggregate, or the entity, it is about. One that holds across aggregates, such as
-- two records saved together or a lifecycle rule for every record in the domain, sits under the domain
-- (FORMAT.md section 16) and says with `involves` which aggregates it ties together. Such a rule is reported
-- when it involves fewer than two aggregates: a rule about one aggregate belongs under that aggregate. It is
-- also reported, once per link, for each aggregate it involves from another domain, since a rule across
-- domains is a domain event's job: one domain raises the event and the other reacts to it. A rule under an
-- aggregate or an entity that uses `involves` is reported too, since its place already says what it is
-- about. Only links to aggregates are counted; a link to a record that does not exist, or that is not an
-- aggregate, is reported by dangling-link or relation-not-allowed instead. A rule whose parent is missing or
-- unknown is not judged. Name the aggregates, move a one-aggregate rule under its aggregate, or drop the link.
--
-- severity: warning
-- kinds: domain_rule aggregate
SELECT 'warning' AS severity, 'domain-rule-involves' AS "check", nullif(f.id, '') AS record, f.message
FROM (
  WITH rules AS (
    -- Each domain rule with the kind of its parent; a duplicated parent ID counts once per kind it has.
    SELECT DISTINCT r.path, r.id, r.parent, r.domain, p.kind AS parent_kind
    FROM records r
    JOIN records p ON p.id = r.parent AND p.kind IN ('domain', 'aggregate', 'entity')
    WHERE r.kind = 'domain_rule'
  ),
  involved AS (
    -- Each aggregate a rule involves, with that aggregate's domain.
    SELECT DISTINCT l.path, l.target, t.domain AS target_domain
    FROM links l
    JOIN records t ON t.id = l.target AND t.kind = 'aggregate'
    WHERE l.relation = 'involves'
  )
  -- A rule under its domain that involves fewer than two aggregates.
  SELECT r.id,
         'Domain rule ' || coalesce(nullif(r.id, ''), r.path) || ' sits under the domain ' || r.parent || ' but involves '
         || CASE count(DISTINCT i.target) WHEN 0 THEN 'no aggregate; name with involves the two or more aggregates it '
                                                     || 'ties together, or move it under the aggregate it is about.'
            ELSE 'only ' || min(i.target) || '; a rule about one aggregate belongs under it, so move it under '
                 || min(i.target) || ', or name with involves every aggregate it ties together.' END AS message
  FROM rules r
  LEFT JOIN involved i ON i.path = r.path
  WHERE r.parent_kind = 'domain'
  GROUP BY r.path, r.id, r.parent
  HAVING count(DISTINCT i.target) < 2
  UNION ALL
  -- Each aggregate of another domain that a rule under its domain involves.
  SELECT r.id,
         'Domain rule ' || coalesce(nullif(r.id, ''), r.path) || ' involves ' || i.target || ', an aggregate of '
         || coalesce(i.target_domain, 'no domain') || ', not of its own domain ' || r.parent
         || '; a rule across domains is a domain event''s job, so have one domain raise an event and the other react to it.'
  FROM rules r
  JOIN involved i ON i.path = r.path
  WHERE r.parent_kind = 'domain' AND i.target_domain IS DISTINCT FROM r.domain
  UNION ALL
  -- A rule under an aggregate or an entity that uses involves at all.
  SELECT r.id,
         'Domain rule ' || coalesce(nullif(r.id, ''), r.path) || ' sits under the ' || r.parent_kind || ' ' || r.parent
         || ' and involves ' || string_agg(DISTINCT l.target, ', ' ORDER BY l.target)
         || '; its place already says what it is about, so drop involves, or move it under its domain if it holds '
         || 'across aggregates.'
  FROM rules r
  JOIN links l ON l.path = r.path AND l.relation = 'involves'
  WHERE r.parent_kind IN ('aggregate', 'entity')
  GROUP BY r.path, r.id, r.parent, r.parent_kind
) f
ORDER BY record, message
