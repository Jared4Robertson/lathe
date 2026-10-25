-- A test that proves, and supports, nothing.
--
-- A test exists to prove obligations (a `proof` link such as `proves`) or to check a mechanism that backs one
-- (`supports`). One with neither has no purpose the spec can see: running a flow (`runs`) or exercising a
-- component (`covers`) says what it touches, not what it shows. A link to a record that does not exist does
-- not count (it is only a dangling-link). Link the obligation it proves with "proves", or the one it backs
-- with "supports", or remove the test.
--
-- severity: warning
-- kinds: test
SELECT 'warning' AS severity, 'test-proves-nothing' AS "check", s.id AS record,
       'Test ' || s.id || ' proves nothing and supports nothing; link the obligation it proves with "proves", '
       || 'or the one it backs with "supports", or remove it.' AS message
FROM records s
WHERE s.kind = 'test' AND s.id <> ''
  AND NOT EXISTS (
    SELECT 1 FROM links l
    JOIN records t ON t.id = l.target
    JOIN relations ro ON ro.relation = l.relation AND ro.source_kind = s.kind AND ro.target_kind IN (t.kind, '*')
                     AND (ro.role = 'proof' OR ro.relation = 'supports')
    WHERE l.path = s.path
  )
ORDER BY record
