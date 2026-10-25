-- Work to do: once a domain has layers, each of its components sits in one of them, as use cases sit in
-- capabilities (29-use-case-outside-capability.sql). A domain with no layers may hold its components itself.
SELECT 'warning' AS severity, 'component-outside-layer' AS "check", c.id AS record,
       'Component ' || c.id || ' sits directly under domain ' || c.parent
       || ', which has layers; move it into the layer it belongs to.' AS message
FROM records c
JOIN records d ON d.id = c.parent AND d.kind = 'domain'
WHERE c.kind = 'component' AND c.id <> ''
  AND EXISTS (SELECT 1 FROM records l WHERE l.kind = 'layer' AND l.parent = d.id)
ORDER BY record
