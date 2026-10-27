-- The ID registry and the supertype tables. Both are filled by the store from the kind tables; neither is stored.

CREATE TABLE record_id (
  id VARCHAR PRIMARY KEY CHECK (regexp_full_match(id, '[A-Z][A-Z0-9]*(-[A-Z0-9]+)*')),
  kind VARCHAR NOT NULL,
  UNIQUE (id, kind)
);
COMMENT ON TABLE record_id IS 'Every record''s ID with its kind, so an ID is unique across every kind''s table and a bare ID resolves to its kind. Each kind''s id is a foreign key into it.';
COMMENT ON COLUMN record_id.id IS 'The record''s ID: capital letters and digits in parts joined by hyphens, such as TL-LEND-UC01. Never reused or renumbered.';
COMMENT ON COLUMN record_id.kind IS 'The record''s kind, which is the table that holds it.';

-- Each supertype holds one row per record of its member kinds (meta_supertype_member).
CREATE TABLE obligation (id VARCHAR PRIMARY KEY, kind VARCHAR NOT NULL, FOREIGN KEY (id, kind) REFERENCES record_id (id, kind));
COMMENT ON TABLE obligation IS 'Every obligation: the records that must be designed or proved. A link that designs, proves, supports or carries out an obligation points here.';
CREATE TABLE follows_source (id VARCHAR PRIMARY KEY, kind VARCHAR NOT NULL, FOREIGN KEY (id, kind) REFERENCES record_id (id, kind));
COMMENT ON TABLE follows_source IS 'The records that may follow a pattern: use cases and domains.';
CREATE TABLE fulfills_source (id VARCHAR PRIMARY KEY, kind VARCHAR NOT NULL, FOREIGN KEY (id, kind) REFERENCES record_id (id, kind));
COMMENT ON TABLE fulfills_source IS 'The records that may carry out an obligation: flows, flow steps, views, endpoints and interaction requirements.';
CREATE TABLE uses_source (id VARCHAR PRIMARY KEY, kind VARCHAR NOT NULL, FOREIGN KEY (id, kind) REFERENCES record_id (id, kind));
COMMENT ON TABLE uses_source IS 'The records that may use a view, endpoint or component: flows, flow steps, views and technical steps.';
CREATE TABLE uses_target (id VARCHAR PRIMARY KEY, kind VARCHAR NOT NULL, FOREIGN KEY (id, kind) REFERENCES record_id (id, kind));
COMMENT ON TABLE uses_target IS 'The records that may be used: views, endpoints and components.';
CREATE TABLE implements_target (id VARCHAR PRIMARY KEY, kind VARCHAR NOT NULL, FOREIGN KEY (id, kind) REFERENCES record_id (id, kind));
COMMENT ON TABLE implements_target IS 'The records a component may implement: endpoints and views.';
CREATE TABLE reacts_to_source (id VARCHAR PRIMARY KEY, kind VARCHAR NOT NULL, FOREIGN KEY (id, kind) REFERENCES record_id (id, kind));
COMMENT ON TABLE reacts_to_source IS 'The records that may react to a domain event: aggregates, use cases and components.';
CREATE TABLE satisfies_source (id VARCHAR PRIMARY KEY, kind VARCHAR NOT NULL, FOREIGN KEY (id, kind) REFERENCES record_id (id, kind));
COMMENT ON TABLE satisfies_source IS 'The records that may design an obligation: components and technical steps.';
CREATE TABLE meets_source (id VARCHAR PRIMARY KEY, kind VARCHAR NOT NULL, FOREIGN KEY (id, kind) REFERENCES record_id (id, kind));
COMMENT ON TABLE meets_source IS 'The records that may meet a standard rule: components, tests and technical steps.';

INSERT INTO meta_table VALUES ('record_id', 'registry', NULL);
INSERT INTO meta_table
  SELECT name, 'supertype', NULL FROM (VALUES ('obligation'), ('follows_source'), ('fulfills_source'), ('uses_source'), ('uses_target'),
    ('implements_target'), ('reacts_to_source'), ('satisfies_source'), ('meets_source')) AS t (name);
INSERT INTO meta_supertype_member VALUES
  ('obligation', 'requirement'), ('obligation', 'domain_rule'), ('obligation', 'interaction_requirement'), ('obligation', 'pattern_rule'),
  ('follows_source', 'use_case'), ('follows_source', 'domain'),
  ('fulfills_source', 'flow'), ('fulfills_source', 'flow_step'), ('fulfills_source', 'view'), ('fulfills_source', 'endpoint'),
  ('fulfills_source', 'interaction_requirement'),
  ('uses_source', 'flow'), ('uses_source', 'flow_step'), ('uses_source', 'view'), ('uses_source', 'design_step'),
  ('uses_target', 'view'), ('uses_target', 'endpoint'), ('uses_target', 'component'),
  ('implements_target', 'endpoint'), ('implements_target', 'view'),
  ('reacts_to_source', 'aggregate'), ('reacts_to_source', 'use_case'), ('reacts_to_source', 'component'),
  ('satisfies_source', 'component'), ('satisfies_source', 'design_step'),
  ('meets_source', 'component'), ('meets_source', 'test'), ('meets_source', 'design_step');
