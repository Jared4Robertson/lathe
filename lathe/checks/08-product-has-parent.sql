-- A product is a root record and has no parent.
SELECT 'error' AS severity, 'product-has-parent' AS "check", nullif(id, '') AS record,
       coalesce(nullif(id, ''), path) || ' is a product, so it must not have a parent, but names ' || parent || '.' AS message
FROM records
WHERE kind = 'product' AND parent IS NOT NULL
ORDER BY path
