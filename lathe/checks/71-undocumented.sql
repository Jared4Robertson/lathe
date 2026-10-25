-- Every kind, relation and check says what it is, so the format reference documents all of them.
--
-- The reference (`lathe format`, lathe/REFERENCE.md) is generated from the meta-model and the check files, so
-- an empty description or header leaves a hole in it. Reported are a kind with an empty description in
-- `kinds.csv`, a relation rule with an empty description in `relations.csv`, and a check file, Lathe's or the
-- product's, whose header comment lacks a summary sentence, an explanation or a severity line. A check's
-- header is one summary sentence, a blank comment line, the explanation ending with how to fix what it
-- reports, a blank comment line, then `-- severity: error` (or `warning`, or `error, warning`) and an optional
-- `-- kinds: ...` line. Write what is missing.
--
-- severity: error
SELECT 'error' AS severity, 'undocumented' AS "check", NULL AS record, message
FROM (
  SELECT 1 AS part, kind AS name, 'The kind ' || kind || ' has no description in kinds.csv; say in a sentence what a '
         || kind || ' record is.' AS message
  FROM kinds
  WHERE kind <> '' AND trim(coalesce(description, '')) = ''
  UNION ALL
  SELECT 2, relation || ' ' || source_kind || ' ' || target_kind,
         'The relation ' || relation || ' from ' || source_kind || ' to ' || target_kind
         || ' has no description in relations.csv; say in a sentence what the link means.'
  FROM relations
  WHERE relation <> '' AND trim(coalesce(description, '')) = ''
  UNION ALL
  SELECT 3, source,
         'The check ' || source || ' has no ' || replace(missing, ', ', ' or ') || ' in its header comment; start the file with '
         || 'a summary sentence, a blank comment line, the explanation and how to fix it, then a severity line.'
  FROM check_docs
  WHERE missing <> ''
)
ORDER BY part, name
