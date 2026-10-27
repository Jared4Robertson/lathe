-- A field's name is unique in its entity or domain event as people read it: trimmed and in any letter case, so
-- "Due date" and " due DATE " are one name. The UNIQUE keys of 004 compare names exactly; these indexes compare them
-- folded. DuckDB keeps them with the tables, so every database the store copies from the schema has them too.

CREATE UNIQUE INDEX entity_field_name_folded ON entity_field (entity_id, lower(trim(name)));
CREATE UNIQUE INDEX event_field_name_folded ON event_field (domain_event_id, lower(trim(name)));
COMMENT ON COLUMN entity_field.name IS 'The field''s name, such as Returned at: one name in its entity, compared trimmed and in any letter case.';
COMMENT ON COLUMN event_field.name IS 'The field''s name, such as Repaired at: one name in its event, compared trimmed and in any letter case.';
