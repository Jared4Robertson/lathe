-- Each entity lists its fields in a Markdown table under a "## Fields" heading (FORMAT.md section 17), with the
-- columns Field, Meaning, Kind of value and Example, one row per field and each field name once. The engine
-- reads the table into entity_tables and, when its columns are right, its rows into entity_fields. Field names
-- are compared trimmed, without code span backticks, and in any letter case. A table with the wrong columns
-- is reported for that alone.
SELECT 'error' AS severity, 'entity-fields' AS "check", nullif(t.record, '') AS record,
       'Entity ' || coalesce(nullif(t.record, ''), t.path) || CASE
         WHEN NOT t.heading THEN ' has no ## Fields table; add a "## Fields" heading with a table of the columns '
                                 || w.wanted || ', one row per field.'
         WHEN t.columns IS NULL THEN ' has a ## Fields heading but no table under it; add a table of the columns '
                                     || w.wanted || ', one row per field.'
         ELSE '''s Fields table has the columns ' || t.columns || '; use the columns ' || w.wanted || ', in that order.'
       END AS message
FROM entity_tables t CROSS JOIN (SELECT 'Field, Meaning, Kind of value and Example' AS wanted) w
WHERE NOT t.heading OR NOT t.columns_ok
UNION ALL
SELECT 'error', 'entity-fields', nullif(any_value(f.record), ''),
       'Entity ' || coalesce(nullif(any_value(f.record), ''), f.path) || '''s Fields table lists the field "'
       || arg_min(trim(f.field, ' `'), f.position) || '" ' || count(*) || ' times, in rows '
       || string_agg(f.position::VARCHAR, ', ' ORDER BY f.position) || '; name each field once.'
FROM entity_fields f
WHERE trim(f.field, ' `') <> ''
GROUP BY f.path, lower(trim(f.field, ' `'))
HAVING count(*) > 1
UNION ALL
SELECT 'error', 'entity-fields', nullif(f.record, ''),
       'Entity ' || coalesce(nullif(f.record, ''), f.path) || '''s Fields table has no field name in row '
       || f.position || '; name the field, or remove the row.'
FROM entity_fields f
WHERE trim(f.field, ' `') = ''
ORDER BY record, message
