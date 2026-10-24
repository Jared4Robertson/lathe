-- Example questions to ask a diagram. Run from that diagram's folder, for example:
--   cd model/people-and-tools && duckdb < ../queries.sql
-- Or open an interactive session with `duckdb` there and paste any one of them.

CREATE VIEW terms AS SELECT * FROM read_csv('terms.csv', header = true, all_varchar = true);
CREATE VIEW links AS SELECT * FROM read_csv('links.csv', header = true, all_varchar = true);

-- What is inside each aggregate?
SELECT l.source AS aggregate, l.target AS part, t.kind, l.cardinality, l.note
FROM links l JOIN terms t ON t.name = l.target
WHERE l.relation = 'contains'
ORDER BY aggregate, part;

-- What can change something inside a Tool?
SELECT l.source AS event, l.relation, l.target AS part, l.note
FROM links l
WHERE l.relation IN ('changes', 'sets')
  AND l.target IN (SELECT target FROM links WHERE source = 'Tool' AND relation = 'contains')
ORDER BY part, event;

-- What is still open or in draft?
SELECT 'link' AS item, source || ' ' || relation || ' ' || target AS what, status, note FROM links WHERE status <> 'decided'
UNION ALL
SELECT 'term', name, status, definition FROM terms WHERE status <> 'decided'
ORDER BY status, item;
