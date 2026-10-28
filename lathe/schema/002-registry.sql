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
COMMENT ON TABLE obligation IS 'Every obligation: a record that must be designed, built and proved. Constraints, invariants, specifications, policies, domain services, UC requirements, view requirements, API requirements, pattern rules and standard rules, and a product''s own obligation kinds.';
CREATE TABLE operation (id VARCHAR PRIMARY KEY, kind VARCHAR NOT NULL, FOREIGN KEY (id, kind) REFERENCES record_id (id, kind));
COMMENT ON TABLE operation IS 'Commands and queries: what a flow step invokes and what calls a domain service.';
CREATE TABLE reads_source (id VARCHAR PRIMARY KEY, kind VARCHAR NOT NULL, FOREIGN KEY (id, kind) REFERENCES record_id (id, kind));
COMMENT ON TABLE reads_source IS 'The records that read aggregates: specifications and read models.';
CREATE TABLE calls_source (id VARCHAR PRIMARY KEY, kind VARCHAR NOT NULL, FOREIGN KEY (id, kind) REFERENCES record_id (id, kind));
COMMENT ON TABLE calls_source IS 'The records that use domain services: commands, queries and read models.';
CREATE TABLE follows_source (id VARCHAR PRIMARY KEY, kind VARCHAR NOT NULL, FOREIGN KEY (id, kind) REFERENCES record_id (id, kind));
COMMENT ON TABLE follows_source IS 'The records that may follow a pattern: domains and use cases.';
CREATE TABLE meets_source (id VARCHAR PRIMARY KEY, kind VARCHAR NOT NULL, FOREIGN KEY (id, kind) REFERENCES record_id (id, kind));
COMMENT ON TABLE meets_source IS 'The records that may meet a standard rule: the technical kinds, which show where the rule is applied. A standard rule is proved by its standard rule tests.';

INSERT INTO meta_table VALUES ('record_id', 'registry', NULL);
INSERT INTO meta_table
  SELECT name, 'supertype', NULL FROM (VALUES ('obligation'), ('operation'), ('reads_source'), ('calls_source'), ('follows_source'), ('meets_source')) AS t (name);
INSERT INTO meta_supertype_member
  SELECT 'obligation', kind FROM (VALUES ('constraint'), ('invariant'), ('specification'), ('policy'), ('domain_service'),
    ('uc_requirement'), ('view_requirement'), ('api_requirement'), ('pattern_rule'), ('standard_rule')) AS t (kind)
  UNION ALL SELECT 'operation', kind FROM (VALUES ('command'), ('query')) AS t (kind)
  UNION ALL SELECT 'reads_source', kind FROM (VALUES ('specification'), ('read_model')) AS t (kind)
  UNION ALL SELECT 'calls_source', kind FROM (VALUES ('command'), ('query'), ('read_model')) AS t (kind)
  UNION ALL SELECT 'follows_source', kind FROM (VALUES ('domain'), ('use_case')) AS t (kind)
  UNION ALL SELECT 'meets_source', kind FROM (VALUES ('repository'), ('data_model'), ('table'), ('value_type'), ('predicate'),
    ('event_type'), ('projection'), ('command_handler'), ('query_handler'), ('event_handler'), ('service'), ('ui_component'),
    ('endpoint_handler'), ('adapter')) AS t (kind);
