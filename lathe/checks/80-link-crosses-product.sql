-- A link stays inside its product.
--
-- Each product is a space of its own: its records link only to records of the same product, whatever the
-- relation (`satisfies`, `involves`, `applies` and every other). A link from a record of one product to a
-- record of another is reported once for each source, relation and target. A record that sits under no
-- product, and a link to a record that does not exist, are reported by other checks instead. When the target
-- ID is duplicated, the link is reported only if no record with that ID is in the source's product. Remove
-- the link; to point a reader at the other product, name the ID in prose, where it is a plain citation.
--
-- severity: error
SELECT 'error' AS severity, 'link-crosses-product' AS "check", x.source AS record,
       x.source || ' ' || x.relation || ' ' || x.target || ', a record of '
       || string_agg(DISTINCT x.target_product, ' or ' ORDER BY x.target_product) || ', not of its own product '
       || x.source_product || '; a link stays inside its product, so remove it, or name ' || x.target
       || ' in prose, where it is a plain citation.' AS message
FROM (
  SELECT l.source, l.relation, l.target, s.product AS source_product, t.product AS target_product
  FROM links l
  JOIN records s ON s.path = l.path AND s.id = l.source AND s.product IS NOT NULL
  JOIN records t ON t.id = l.target AND t.product IS NOT NULL
  WHERE l.source <> ''
) x
GROUP BY x.source, x.relation, x.target, x.source_product
HAVING NOT bool_or(x.target_product = x.source_product)
ORDER BY record, message
