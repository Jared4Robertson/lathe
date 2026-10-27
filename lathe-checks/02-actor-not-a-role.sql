-- A use case's actor is one of its product's roles.
--
-- This is this repo's own check (lathe/FORMAT.md section 12). Specs name roles, never people: each product
-- lists its roles in its header as `actors`, separated by spaces (Lathe's are `Owner Reader Agent`), and a
-- use case's `actor` names one or more of them, separated by commas. Change the actor to one of the
-- product's roles, or add the role to the product's `actors` and say in its body what the role does. A
-- product with use cases but no `actors` is reported too.
--
-- severity: warning
-- kinds: use_case
WITH product_roles AS (
  SELECT p.id AS product, trim(word) AS role
  FROM records p
  JOIN fields f ON f.path = p.path AND f.name = 'actors'
  CROSS JOIN unnest(string_split(regexp_replace(trim(f.value), '\s+', ' ', 'g'), ' ')) AS t(word)
  WHERE p.kind = 'product' AND trim(word) <> ''
),
named AS (
  SELECT u.id, u.title, u.product, trim(actor) AS name
  FROM records u
  JOIN fields f ON f.path = u.path AND f.name = 'actor'
  CROSS JOIN unnest(string_split(f.value, ',')) AS t(actor)
  WHERE u.kind = 'use_case' AND u.id <> '' AND trim(actor) <> ''
)
SELECT 'warning' AS severity, 'actor-not-a-role' AS "check", n.id AS record,
       'Use case ' || n.id || ' (' || n.title || ') names "' || n.name || '" as its actor, which is not one of product '
       || n.product || '''s actors (' || (SELECT string_agg(r.role, ', ' ORDER BY r.role) FROM product_roles r WHERE r.product = n.product)
       || '); name a role, or add it to the product''s actors.' AS message
FROM named n
WHERE EXISTS (SELECT 1 FROM product_roles r WHERE r.product = n.product)
  AND NOT EXISTS (SELECT 1 FROM product_roles r WHERE r.product = n.product AND r.role = n.name)
UNION ALL
SELECT 'warning', 'actor-not-a-role', p.id,
       'Product ' || p.id || ' (' || p.title || ') has use cases but no "actors" field; list its roles in its header, '
       || 'such as actors: Owner Reader Agent.'
FROM records p
WHERE p.kind = 'product' AND p.id <> ''
  AND EXISTS (SELECT 1 FROM records u WHERE u.kind = 'use_case' AND u.product = p.id)
  AND NOT EXISTS (SELECT 1 FROM product_roles r WHERE r.product = p.id)
ORDER BY record
