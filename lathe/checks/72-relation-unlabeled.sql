-- Every relation rule says in plain words what its link means, read from either end.
--
-- Each row of `relations.csv`, Lathe's or an extension's, carries a `forward_label`, the link read from the
-- source ("Satisfies"), and a `reverse_label`, the link read from the target ("Designed by"). The wiki, the
-- inspector, the graph and the format reference show links by these words. An extension that restates a
-- rule may leave them empty to keep the earlier labels, so the rule is reported only when, after every
-- extension is merged, a label is still empty. Write the missing label, in sentence case.
--
-- severity: error
SELECT 'error' AS severity, 'relation-unlabeled' AS "check", NULL AS record,
       'The relation ' || relation || ' from ' || source_kind || ' to ' || target_kind || ' has no '
       || CASE WHEN trim(coalesce(forward_label, '')) = '' AND trim(coalesce(reverse_label, '')) = '' THEN 'forward_label or reverse_label'
               WHEN trim(coalesce(forward_label, '')) = '' THEN 'forward_label'
               ELSE 'reverse_label' END
       || ' in relations.csv; say in plain words what the link means read from '
       || CASE WHEN trim(coalesce(forward_label, '')) = '' AND trim(coalesce(reverse_label, '')) = '' THEN 'each end'
               WHEN trim(coalesce(forward_label, '')) = '' THEN 'the source'
               ELSE 'the target' END
       || ', such as "Satisfies" and "Designed by".' AS message
FROM relations
WHERE relation <> ''
  AND (trim(coalesce(forward_label, '')) = '' OR trim(coalesce(reverse_label, '')) = '')
ORDER BY relation, source_kind, target_kind
