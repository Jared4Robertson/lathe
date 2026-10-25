-- A domain event that nothing reacts to.
--
-- An event is worth naming when something changes because it happened (FORMAT.md section 18): an aggregate,
-- which may sit in another aggregate or domain, a use case that starts, or a component that handles it, each
-- linking to the event with `reacts_to`. An event kept only for the record can be fine, so this is a
-- warning. A `reacts_to` link from any record counts here; one from a kind the meta-model does not allow is
-- relation-not-allowed. Add `reacts_to` to what changes, starts or runs when the event happens, or leave the
-- event unheard on purpose.
--
-- severity: warning
-- kinds: domain_event aggregate use_case component
SELECT 'warning' AS severity, 'event-unheard' AS "check", e.id AS record,
       'Nothing reacts to event ' || e.id || ' (' || e.title || '). That can be fine for an event kept for the '
       || 'record; otherwise add reacts_to: [' || e.id || '] to the aggregate that changes, the use case that '
       || 'starts or the component that handles it when it happens.' AS message
FROM records e
WHERE e.kind = 'domain_event' AND e.id <> ''
  AND NOT EXISTS (SELECT 1 FROM links l WHERE l.relation = 'reacts_to' AND l.target = e.id)
ORDER BY record
