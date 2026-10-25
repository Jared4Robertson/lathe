-- A product is a root record and has no parent.
--
-- Every other record sits under a product, so a product itself sits under nothing. Remove the product's
-- `parent` field.
--
-- severity: error
-- kinds: product
SELECT 'error' AS severity, 'product-has-parent' AS "check", nullif(id, '') AS record,
       coalesce(nullif(id, ''), path) || ' is a product, so it must not have a parent, but names ' || parent || '.' AS message
FROM records
WHERE kind = 'product' AND parent IS NOT NULL
ORDER BY path
