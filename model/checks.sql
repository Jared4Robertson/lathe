-- Consistency checks for the domain model. Run from the repo root:
--   duckdb < model/checks.sql
-- A clean run prints "All checks passed". Otherwise it stops with an error listing every problem.

CREATE VIEW terms AS SELECT * FROM read_csv('model/terms.csv', header = true, all_varchar = true);
CREATE VIEW links AS SELECT * FROM read_csv('model/links.csv', header = true, all_varchar = true);
CREATE VIEW link_names AS SELECT *, source || ' ' || relation || ' ' || target AS label FROM links;

CREATE VIEW problems AS
-- Term names are unique.
SELECT 'Duplicate term' AS problem, name AS item FROM terms GROUP BY name HAVING count(*) > 1
UNION ALL
-- Kinds, contexts, relations and statuses come from fixed lists.
SELECT 'Unknown kind, context or status', name FROM terms
WHERE kind NOT IN ('aggregate', 'entity', 'value_object', 'domain_event', 'term')
   OR context NOT IN ('people_and_tools', 'making_software')
   OR status NOT IN ('decided', 'draft', 'open')
UNION ALL
SELECT 'Unknown relation or status', label FROM link_names
WHERE relation NOT IN ('contains', 'serves', 'raises', 'prompts', 'changes', 'sets', 'is_a')
   OR status NOT IN ('decided', 'draft', 'open')
UNION ALL
-- Every link points at terms that exist.
SELECT 'Link names an unknown term', label FROM link_names
WHERE source NOT IN (SELECT name FROM terms) OR target NOT IN (SELECT name FROM terms)
UNION ALL
-- Only aggregates contain things, and they contain entities or value objects.
SELECT 'Bad containment', l.label FROM link_names l
JOIN terms s ON s.name = l.source JOIN terms t ON t.name = l.target
WHERE l.relation = 'contains' AND (s.kind <> 'aggregate' OR t.kind NOT IN ('entity', 'value_object'))
UNION ALL
-- Aggregates raise domain events, and only domain events prompt, change or set things.
SELECT 'Bad event link', l.label FROM link_names l
JOIN terms s ON s.name = l.source JOIN terms t ON t.name = l.target
WHERE (l.relation = 'raises' AND (s.kind <> 'aggregate' OR t.kind <> 'domain_event'))
   OR (l.relation IN ('prompts', 'changes', 'sets') AND s.kind <> 'domain_event')
UNION ALL
-- Every term in the people-and-tools context is connected to something.
SELECT 'Term with no links', name FROM terms
WHERE context = 'people_and_tools'
  AND name NOT IN (SELECT source FROM links UNION SELECT target FROM links);

SELECT CASE
  WHEN count(*) = 0 THEN 'All checks passed'
  ELSE error(count(*) || ' problem(s): ' || string_agg(problem || ': ' || item, '; '))
END AS result
FROM problems;
