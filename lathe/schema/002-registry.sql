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
COMMENT ON TABLE obligation IS 'Every obligation: a record that must be designed, built and proved. Constraints, invariants, specifications, policies, domain services, storage requirements, UC requirements, view requirements, API requirements, pattern rules and standard rules, and a product''s own obligation kinds.';
CREATE TABLE operation (id VARCHAR PRIMARY KEY, kind VARCHAR NOT NULL, FOREIGN KEY (id, kind) REFERENCES record_id (id, kind));
COMMENT ON TABLE operation IS 'Commands and queries: what a flow step invokes and what calls a domain service.';
CREATE TABLE reads_source (id VARCHAR PRIMARY KEY, kind VARCHAR NOT NULL, FOREIGN KEY (id, kind) REFERENCES record_id (id, kind));
COMMENT ON TABLE reads_source IS 'The records that read aggregates: specifications and read models.';
CREATE TABLE calls_source (id VARCHAR PRIMARY KEY, kind VARCHAR NOT NULL, FOREIGN KEY (id, kind) REFERENCES record_id (id, kind));
COMMENT ON TABLE calls_source IS 'The records that use domain services: commands, queries and read models.';
CREATE TABLE follows_source (id VARCHAR PRIMARY KEY, kind VARCHAR NOT NULL, FOREIGN KEY (id, kind) REFERENCES record_id (id, kind));
COMMENT ON TABLE follows_source IS 'The records that may follow a pattern: domains, use cases and interfaces (an interface''s pattern says how each step of a flow is carried out through it).';
CREATE TABLE technical_record (id VARCHAR PRIMARY KEY, kind VARCHAR NOT NULL, FOREIGN KEY (id, kind) REFERENCES record_id (id, kind));
CREATE TABLE test (id VARCHAR PRIMARY KEY, kind VARCHAR NOT NULL, FOREIGN KEY (id, kind) REFERENCES record_id (id, kind));
COMMENT ON TABLE test IS 'Every test, of each test kind: what may start from a test data set.';
COMMENT ON TABLE technical_record IS 'The records of the technical specification: Lathe''s technical kinds and a product''s own kinds of that stage. Only they meet a standard rule, showing where the rule is applied, and only they name the packages they use.';

CREATE TABLE serves_source (id VARCHAR PRIMARY KEY, kind VARCHAR NOT NULL, FOREIGN KEY (id, kind) REFERENCES record_id (id, kind));
COMMENT ON TABLE serves_source IS 'The records that serve business outcomes: aggregates and read models, through the use cases that sit with them, and journeys, which say in what order it happens.';
CREATE TABLE carries_out_target (id VARCHAR PRIMARY KEY, kind VARCHAR NOT NULL, FOREIGN KEY (id, kind) REFERENCES record_id (id, kind));
COMMENT ON TABLE carries_out_target IS 'What a journey step carries out: a use case, or a policy (a handoff, where the product itself acts).';
CREATE TABLE exchanges_with_source (id VARCHAR PRIMARY KEY, kind VARCHAR NOT NULL, FOREIGN KEY (id, kind) REFERENCES record_id (id, kind));
COMMENT ON TABLE exchanges_with_source IS 'The records that exchange with an integration''s outside system: a flow step, where an actor does it, and a policy, where the product itself does.';

CREATE TABLE stored_in_source (id VARCHAR PRIMARY KEY, kind VARCHAR NOT NULL, FOREIGN KEY (id, kind) REFERENCES record_id (id, kind));
COMMENT ON TABLE stored_in_source IS 'The records that are kept in a data store: repositories, readers and tables.';
CREATE TABLE accidental_record (id VARCHAR PRIMARY KEY, kind VARCHAR NOT NULL, FOREIGN KEY (id, kind) REFERENCES record_id (id, kind));
COMMENT ON TABLE accidental_record IS 'The records of an accidental kind, which is derived (generates), provided (provided_by) or a fill at a slot (fills): the technical records, endpoints and data stores, Lathe''s kinds and a product''s own accidental kinds.';
CREATE TABLE meets_target (id VARCHAR PRIMARY KEY, kind VARCHAR NOT NULL, FOREIGN KEY (id, kind) REFERENCES record_id (id, kind));
COMMENT ON TABLE meets_target IS 'The rules a technical record may follow (meets): a standard''s rules, and a pattern''s rules, which a generic piece of code such as a shared component, an entry point or a build script carries out.';
CREATE TABLE provided_by_source (id VARCHAR PRIMARY KEY, kind VARCHAR NOT NULL, FOREIGN KEY (id, kind) REFERENCES record_id (id, kind));
COMMENT ON TABLE provided_by_source IS 'The records something outside the product may provide: data stores, standards, technical records and obligations, Lathe''s kinds and a product''s own of those.';
CREATE TABLE presents_source (id VARCHAR PRIMARY KEY, kind VARCHAR NOT NULL, FOREIGN KEY (id, kind) REFERENCES record_id (id, kind));
COMMENT ON TABLE presents_source IS 'The records that present commands and queries: views, and the records of a product''s own interface design kinds (such as a command line''s invocations), once the product adds the pair with a product_relation named presents.';

INSERT INTO meta_table VALUES ('record_id', 'registry', NULL);
INSERT INTO meta_table
  SELECT name, 'supertype', NULL FROM (VALUES ('obligation'), ('operation'), ('reads_source'), ('calls_source'), ('follows_source'), ('technical_record'), ('test'), ('serves_source'), ('carries_out_target'), ('exchanges_with_source'), ('stored_in_source'), ('accidental_record'), ('meets_target'), ('provided_by_source'), ('presents_source')) AS t (name);
INSERT INTO meta_supertype_member
  SELECT 'obligation', kind FROM (VALUES ('constraint'), ('invariant'), ('specification'), ('policy'), ('domain_service'),
    ('storage_requirement'), ('uc_requirement'), ('view_requirement'), ('api_requirement'), ('pattern_rule'), ('standard_rule')) AS t (kind)
  UNION ALL SELECT 'operation', kind FROM (VALUES ('command'), ('query')) AS t (kind)
  UNION ALL SELECT 'reads_source', kind FROM (VALUES ('specification'), ('read_model')) AS t (kind)
  UNION ALL SELECT 'calls_source', kind FROM (VALUES ('command'), ('query'), ('read_model')) AS t (kind)
  UNION ALL SELECT 'follows_source', kind FROM (VALUES ('domain'), ('use_case'), ('interface')) AS t (kind)
  UNION ALL SELECT 'technical_record', kind FROM (VALUES ('repository'), ('data_model'), ('table'), ('value_type'), ('rule'), ('predicate'),
    ('event_type'), ('projection'), ('reader'), ('command_handler'), ('query_handler'), ('event_handler'), ('service'), ('ui_component'),
    ('endpoint_handler'), ('adapter'), ('entry_point'), ('tooling')) AS t (kind)
  UNION ALL SELECT 'test', kind FROM (VALUES ('constraint_test'), ('invariant_test'), ('specification_test'), ('policy_test'),
    ('domain_service_test'), ('storage_requirement_test'), ('use_case_test'), ('view_test'), ('endpoint_test'), ('flow_test'), ('journey_test'),
    ('integration_test'), ('pattern_rule_test'), ('standard_rule_test')) AS t (kind)
  UNION ALL SELECT 'serves_source', kind FROM (VALUES ('aggregate'), ('read_model'), ('journey')) AS t (kind)
  UNION ALL SELECT 'carries_out_target', kind FROM (VALUES ('use_case'), ('policy')) AS t (kind)
  UNION ALL SELECT 'exchanges_with_source', kind FROM (VALUES ('flow_step'), ('policy')) AS t (kind)
  UNION ALL SELECT 'stored_in_source', kind FROM (VALUES ('repository'), ('reader'), ('table')) AS t (kind)
  UNION ALL SELECT 'meets_target', kind FROM (VALUES ('standard_rule'), ('pattern_rule')) AS t (kind)
  UNION ALL SELECT 'presents_source', 'view';
INSERT INTO meta_supertype_member
  SELECT 'accidental_record', kind FROM meta_supertype_member WHERE supertype = 'technical_record'
  UNION ALL SELECT 'accidental_record', kind FROM (VALUES ('endpoint'), ('data_store')) AS t (kind);
INSERT INTO meta_supertype_member
  SELECT 'provided_by_source', kind FROM meta_supertype_member WHERE supertype IN ('accidental_record', 'obligation')
  UNION ALL SELECT 'provided_by_source', 'standard';
