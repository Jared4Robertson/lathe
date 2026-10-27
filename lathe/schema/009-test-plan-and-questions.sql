-- The test plan, and open questions.

CREATE TYPE test_state AS ENUM ('automated', 'manual', 'planned');

CREATE TABLE test (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  domain_id VARCHAR NOT NULL REFERENCES domain (id),
  capability_id VARCHAR,
  test_type VARCHAR NOT NULL CHECK (regexp_full_match(test_type, '[a-z][a-z0-9_]*')),
  state test_state NOT NULL,
  file VARCHAR,
  key VARCHAR,
  key_file VARCHAR,
  given VARCHAR,
  "when" VARCHAR,
  "then" VARCHAR,
  FOREIGN KEY (capability_id, domain_id) REFERENCES capability (id, domain_id),
  CHECK (state <> 'automated' OR file IS NOT NULL),
  CHECK (key_file IS NULL OR file IS NOT NULL)
);
COMMENT ON TABLE test IS 'A test that proves obligations, or supports them without proving them. An automated test names the file that runs it; a manual test describes its procedure; a planned test is not proof.';
COMMENT ON COLUMN test.id IS 'The test''s ID, such as TL-LEND-T01.';
COMMENT ON COLUMN test.title IS 'What the test shows, in a sentence.';
COMMENT ON COLUMN test.domain_id IS 'The domain it belongs to.';
COMMENT ON COLUMN test.capability_id IS 'The capability of that domain it sits in, if one.';
COMMENT ON COLUMN test.test_type IS 'What kind of test it is, in lower case, such as unit, acceptance or domain_rule.';
COMMENT ON COLUMN test.state IS 'automated: a file runs it; manual: a person follows its procedure; planned: meant to prove its obligations, but not proof yet.';
COMMENT ON COLUMN test.file IS 'The file that runs it, from the product root; an automated test must name one.';
COMMENT ON COLUMN test.key IS 'Text its file contains in place of IDs.';
COMMENT ON COLUMN test.key_file IS 'The file that holds the key (or the IDs), when the test runs from a shared class in another file; that file is read in place of file, which must still exist.';
COMMENT ON COLUMN test.given IS 'The state the test starts from.';
COMMENT ON COLUMN test."when" IS 'What the test does.';
COMMENT ON COLUMN test."then" IS 'What the test expects.';

CREATE TABLE question (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  product_id VARCHAR NOT NULL REFERENCES product (id),
  domain_id VARCHAR,
  aggregate_id VARCHAR,
  use_case_id VARCHAR,
  component_id VARCHAR,
  owner VARCHAR NOT NULL CHECK (trim(owner) <> ''),
  description VARCHAR,
  FOREIGN KEY (domain_id, product_id) REFERENCES domain (id, product_id),
  FOREIGN KEY (aggregate_id, domain_id) REFERENCES aggregate (id, domain_id),
  FOREIGN KEY (use_case_id, domain_id) REFERENCES use_case (id, domain_id),
  FOREIGN KEY (component_id, domain_id) REFERENCES component (id, domain_id),
  CHECK ((aggregate_id IS NOT NULL)::INTEGER + (use_case_id IS NOT NULL)::INTEGER + (component_id IS NOT NULL)::INTEGER <= 1),
  CHECK (domain_id IS NOT NULL OR (aggregate_id IS NULL AND use_case_id IS NULL AND component_id IS NULL))
);
COMMENT ON TABLE question IS 'Something undecided, with the role that decides it. A decided question is removed and its answer written into the records it affects.';
COMMENT ON COLUMN question.id IS 'The question''s ID, such as TL-LEND-Q01 or TL-Q01.';
COMMENT ON COLUMN question.title IS 'The question.';
COMMENT ON COLUMN question.product_id IS 'The product it belongs to.';
COMMENT ON COLUMN question.domain_id IS 'The domain of that product it sits in, if one.';
COMMENT ON COLUMN question.aggregate_id IS 'The aggregate of that domain it sits under, if one.';
COMMENT ON COLUMN question.use_case_id IS 'The use case of that domain it sits under, if one.';
COMMENT ON COLUMN question.component_id IS 'The component of that domain it sits under, if one.';
COMMENT ON COLUMN question.owner IS 'The role that decides it, one of the product''s roles, such as Owner.';
COMMENT ON COLUMN question.description IS 'What is open, and the options.';

INSERT INTO meta_kind VALUES
  ('test', 'Test', 'design', 'test-plan', 'none', '<P>-<D>-T<nn>', 'TL-LEND-T01', NULL),
  ('question', 'Open question', NULL, NULL, 'none', '<P>-<D>-Q<nn> or <P>-Q<nn>', 'TL-LEND-Q01', NULL);
INSERT INTO meta_kind_parent VALUES
  ('test', 'capability', 1, 'capability_id'), ('test', 'domain', 2, 'domain_id'),
  ('question', 'aggregate', 1, 'aggregate_id'), ('question', 'use_case', 2, 'use_case_id'),
  ('question', 'component', 3, 'component_id'), ('question', 'domain', 4, 'domain_id'), ('question', 'product', 5, 'product_id');
INSERT INTO meta_table VALUES ('test', 'kind', NULL), ('question', 'kind', NULL);
