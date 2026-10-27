-- Each of Lathe's kinds has a place in the order people read them: the product and its domains, the Define stage,
-- the Design stage, then open questions. The app's lists, the graph, the reference and coverage all read kinds in this
-- order. A product's own kinds have no position: they follow Lathe's, by name.

ALTER TABLE meta_kind ADD COLUMN position INTEGER;
COMMENT ON COLUMN meta_kind.position IS 'The kind''s place in the order people read kinds, from 1; none for a product''s own kind, which follows Lathe''s by name.';

UPDATE meta_kind SET position = CASE name
  WHEN 'product' THEN 1
  WHEN 'domain' THEN 2
  WHEN 'capability' THEN 3
  WHEN 'aggregate' THEN 4
  WHEN 'entity' THEN 5
  WHEN 'domain_event' THEN 6
  WHEN 'domain_rule' THEN 7
  WHEN 'use_case' THEN 8
  WHEN 'requirement' THEN 9
  WHEN 'pattern' THEN 10
  WHEN 'pattern_rule' THEN 11
  WHEN 'standard' THEN 12
  WHEN 'standard_rule' THEN 13
  WHEN 'flow' THEN 14
  WHEN 'flow_step' THEN 15
  WHEN 'view' THEN 16
  WHEN 'api' THEN 17
  WHEN 'endpoint' THEN 18
  WHEN 'integration' THEN 19
  WHEN 'interaction_requirement' THEN 20
  WHEN 'layer' THEN 21
  WHEN 'component' THEN 22
  WHEN 'design_flow' THEN 23
  WHEN 'design_step' THEN 24
  WHEN 'test' THEN 25
  WHEN 'question' THEN 26
END;

CREATE UNIQUE INDEX meta_kind_position ON meta_kind (position);
