-- Capabilities, use cases with their actors and steps, and UC requirements.

CREATE TABLE capability (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  domain_id VARCHAR NOT NULL REFERENCES domain (id),
  position INTEGER NOT NULL CHECK (position >= 1),
  description VARCHAR,
  UNIQUE (id, domain_id),
  UNIQUE (domain_id, position)
);
COMMENT ON TABLE capability IS 'An ordered slice of a domain that groups its use cases, flows and tests, such as Membership or Lending.';
COMMENT ON COLUMN capability.id IS 'The capability''s ID, such as TL-LEND-CAP01.';
COMMENT ON COLUMN capability.title IS 'The capability''s name, such as Membership.';
COMMENT ON COLUMN capability.domain_id IS 'The domain it belongs to.';
COMMENT ON COLUMN capability.position IS 'Its place in the domain, from 1.';
COMMENT ON COLUMN capability.description IS 'What the capability covers, in a sentence or two.';

CREATE TABLE use_case (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  domain_id VARCHAR NOT NULL REFERENCES domain (id),
  capability_id VARCHAR,
  goal VARCHAR,
  notes VARCHAR,
  FOREIGN KEY (capability_id, domain_id) REFERENCES capability (id, domain_id),
  UNIQUE (id, domain_id)
);
COMMENT ON TABLE use_case IS 'Something an actor does with the product to reach a goal. Its actors are use_case_actor rows and its steps use_case_step rows.';
COMMENT ON COLUMN use_case.id IS 'The use case''s ID, such as TL-LEND-UC01.';
COMMENT ON COLUMN use_case.title IS 'What the actor does, such as Borrow a tool.';
COMMENT ON COLUMN use_case.domain_id IS 'The domain it belongs to.';
COMMENT ON COLUMN use_case.capability_id IS 'The capability of that domain it sits in, if one.';
COMMENT ON COLUMN use_case.goal IS 'What the actor wants to reach, in a sentence.';
COMMENT ON COLUMN use_case.notes IS 'Longer notes, such as the order in which refusals are reported.';

CREATE TABLE use_case_actor (
  use_case_id VARCHAR NOT NULL REFERENCES use_case (id),
  position INTEGER NOT NULL CHECK (position >= 1),
  role_name VARCHAR NOT NULL,
  PRIMARY KEY (use_case_id, position),
  UNIQUE (use_case_id, role_name)
);
COMMENT ON TABLE use_case_actor IS 'One actor of a use case, in order: a role of the use case''s product.';
COMMENT ON COLUMN use_case_actor.use_case_id IS 'The use case.';
COMMENT ON COLUMN use_case_actor.position IS 'The actor''s place among the use case''s actors, from 1; the first is the main actor.';
COMMENT ON COLUMN use_case_actor.role_name IS 'The role, which the product names in its role rows.';

CREATE TABLE use_case_step (
  use_case_id VARCHAR NOT NULL REFERENCES use_case (id),
  position INTEGER NOT NULL CHECK (position >= 1),
  description VARCHAR NOT NULL CHECK (trim(description) <> ''),
  PRIMARY KEY (use_case_id, position)
);
COMMENT ON TABLE use_case_step IS 'One step of a use case''s main course, in order.';
COMMENT ON COLUMN use_case_step.use_case_id IS 'The use case.';
COMMENT ON COLUMN use_case_step.position IS 'The step''s place, from 1.';
COMMENT ON COLUMN use_case_step.description IS 'What happens in the step, in a sentence.';

CREATE TABLE requirement (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  use_case_id VARCHAR NOT NULL REFERENCES use_case (id),
  statement VARCHAR NOT NULL CHECK (trim(statement) <> ''),
  group_name VARCHAR
);
COMMENT ON TABLE requirement IS 'One rule a use case must follow. Shown as a UC (use case) requirement, to tell it apart from interaction requirements and pattern rules.';
COMMENT ON COLUMN requirement.id IS 'The requirement''s ID: its use case''s ID and R<nn>, such as TL-LEND-UC01-R01.';
COMMENT ON COLUMN requirement.title IS 'The requirement in a few words.';
COMMENT ON COLUMN requirement.use_case_id IS 'The use case it belongs to.';
COMMENT ON COLUMN requirement.statement IS 'The requirement, stated with MUST, MUST NOT, SHOULD or MAY, in one sentence.';
COMMENT ON COLUMN requirement.group_name IS 'A short heading it is shown under among its siblings, such as Validation or Paging.';

INSERT INTO meta_kind VALUES
  ('capability', 'Capability', 'define', 'use-cases', 'none', '<P>-<D>-CAP<nn>', 'TL-LEND-CAP01', NULL),
  ('use_case', 'Use case', 'define', 'use-cases', 'none', '<P>-<D>-UC<nn>', 'TL-LEND-UC01', NULL),
  ('requirement', 'UC requirement', 'define', 'use-cases', 'full', '<use case>-R<nn>', 'TL-LEND-UC01-R01', NULL);
INSERT INTO meta_kind_parent VALUES
  ('capability', 'domain', 1, 'domain_id'),
  ('use_case', 'capability', 1, 'capability_id'), ('use_case', 'domain', 2, 'domain_id'),
  ('requirement', 'use_case', 1, 'use_case_id');
INSERT INTO meta_table VALUES
  ('capability', 'kind', NULL), ('use_case', 'kind', NULL), ('use_case_actor', 'part', 'use_case_id'),
  ('use_case_step', 'part', 'use_case_id'), ('requirement', 'kind', NULL);
