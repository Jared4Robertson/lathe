-- Use cases: capabilities, use cases with their actors, UC requirements, and the patterns use cases and domains follow,
-- with their settings and rules.

CREATE TABLE capability (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  domain_id VARCHAR NOT NULL REFERENCES domain (id),
  position INTEGER NOT NULL CHECK (position >= 1),
  description VARCHAR,
  UNIQUE (domain_id, position)
);
COMMENT ON TABLE capability IS 'An ordered slice of a domain that groups its use cases, such as Catalog or Lending.';
COMMENT ON COLUMN capability.id IS 'The capability''s ID, such as TL-LEND-CAP01.';
COMMENT ON COLUMN capability.title IS 'The capability''s name, such as Catalog.';
COMMENT ON COLUMN capability.domain_id IS 'The domain it belongs to.';
COMMENT ON COLUMN capability.position IS 'Its place in the domain, from 1.';
COMMENT ON COLUMN capability.description IS 'What the capability covers, in a sentence or two.';

CREATE TABLE use_case (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  capability_id VARCHAR NOT NULL REFERENCES capability (id),
  goal VARCHAR,
  notes VARCHAR
);
COMMENT ON TABLE use_case IS 'An actor''s goal: its actors (use_case_actor rows), its UC requirements and its one flow. It changes nothing itself; its flow''s steps invoke commands and queries.';
COMMENT ON COLUMN use_case.id IS 'The use case''s ID, such as TL-LEND-UC01.';
COMMENT ON COLUMN use_case.title IS 'What the actor does, such as Borrow a tool.';
COMMENT ON COLUMN use_case.capability_id IS 'The capability it sits in.';
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

CREATE TABLE uc_requirement (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  use_case_id VARCHAR NOT NULL REFERENCES use_case (id),
  statement VARCHAR NOT NULL CHECK (trim(statement) <> ''),
  group_name VARCHAR
);
COMMENT ON TABLE uc_requirement IS 'One rule a use case must follow. Steps of the use case''s own flow fulfill it.';
COMMENT ON COLUMN uc_requirement.id IS 'The requirement''s ID: its use case''s ID and R<nn>, such as TL-LEND-UC01-R01.';
COMMENT ON COLUMN uc_requirement.title IS 'The requirement in a few words.';
COMMENT ON COLUMN uc_requirement.use_case_id IS 'The use case it belongs to.';
COMMENT ON COLUMN uc_requirement.statement IS 'The requirement, stated with MUST, MUST NOT, SHOULD or MAY, in one sentence.';
COMMENT ON COLUMN uc_requirement.group_name IS 'A short heading it is shown under among its siblings, such as Validation or Paging.';

CREATE TABLE pattern (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  product_id VARCHAR NOT NULL REFERENCES product (id),
  description VARCHAR,
  notes VARCHAR
);
COMMENT ON TABLE pattern IS 'Behavior several use cases share, stated once with the settings each use case that follows it fills in. Its settings are pattern_setting rows and its rules pattern_rule records.';
COMMENT ON COLUMN pattern.id IS 'The pattern''s ID, such as TL-PAT-LIBRARIAN-ACTION.';
COMMENT ON COLUMN pattern.title IS 'The pattern''s name, such as Librarian action.';
COMMENT ON COLUMN pattern.product_id IS 'The product it belongs to.';
COMMENT ON COLUMN pattern.description IS 'The shared behavior, in a paragraph.';
COMMENT ON COLUMN pattern.notes IS 'Longer notes, such as how a domain or use case uses the pattern.';

CREATE TABLE pattern_setting (
  pattern_id VARCHAR NOT NULL REFERENCES pattern (id),
  position INTEGER NOT NULL CHECK (position >= 1),
  name VARCHAR NOT NULL CHECK (regexp_full_match(name, '[a-z][a-z0-9_]*')),
  meaning VARCHAR,
  PRIMARY KEY (pattern_id, position),
  UNIQUE (pattern_id, name)
);
COMMENT ON TABLE pattern_setting IS 'One setting of a pattern, in order: what each follower decides.';
COMMENT ON COLUMN pattern_setting.pattern_id IS 'The pattern.';
COMMENT ON COLUMN pattern_setting.position IS 'The setting''s place in the pattern, from 1.';
COMMENT ON COLUMN pattern_setting.name IS 'The setting''s name, in lower case with underscores, such as required_input.';
COMMENT ON COLUMN pattern_setting.meaning IS 'What a follower decides in it.';

CREATE TABLE pattern_rule (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  pattern_id VARCHAR NOT NULL REFERENCES pattern (id),
  statement VARCHAR NOT NULL CHECK (trim(statement) <> ''),
  group_name VARCHAR,
  setting VARCHAR,
  applies_when_setting VARCHAR,
  applies_when_negated BOOLEAN,
  applies_when_value VARCHAR,
  notes VARCHAR,
  FOREIGN KEY (pattern_id, setting) REFERENCES pattern_setting (pattern_id, name),
  FOREIGN KEY (pattern_id, applies_when_setting) REFERENCES pattern_setting (pattern_id, name),
  CHECK ((applies_when_setting IS NULL) = (applies_when_negated IS NULL) AND (applies_when_setting IS NULL) = (applies_when_value IS NULL))
);
COMMENT ON TABLE pattern_rule IS 'One rule of a pattern. Every domain that follows the pattern owes it, unless it names a setting all of that domain''s followers mark Not applicable, or its applies-when condition is met by no follower there.';
COMMENT ON COLUMN pattern_rule.id IS 'The rule''s ID: its pattern''s ID and R<nn>, such as TL-PAT-LIBRARIAN-ACTION-R01.';
COMMENT ON COLUMN pattern_rule.title IS 'The rule in a few words.';
COMMENT ON COLUMN pattern_rule.pattern_id IS 'The pattern it belongs to.';
COMMENT ON COLUMN pattern_rule.statement IS 'The rule, stated with MUST, MUST NOT, SHOULD or MAY.';
COMMENT ON COLUMN pattern_rule.group_name IS 'A short heading it is shown under among its siblings, such as Validation or Paging.';
COMMENT ON COLUMN pattern_rule.setting IS 'A setting of its pattern the rule depends on: in a domain whose following use cases all mark it Not applicable, the rule does not apply.';
COMMENT ON COLUMN pattern_rule.applies_when_setting IS 'The setting of its pattern its applies-when condition reads; the rule is waived in a domain where no follower gives that setting a value that meets it.';
COMMENT ON COLUMN pattern_rule.applies_when_negated IS 'false: the condition is <setting> is <value>; true: <setting> is not <value>.';
COMMENT ON COLUMN pattern_rule.applies_when_value IS 'The value the condition compares with, trimmed and in any letter case.';
COMMENT ON COLUMN pattern_rule.notes IS 'Longer notes on how the rule applies.';

INSERT INTO meta_kind VALUES
  ('capability', 'Capability', 'use-cases', 17, false, '<P>-<D>-CAP<nn>', 'TL-LEND-CAP01', 'domain', NULL),
  ('use_case', 'Use case', 'use-cases', 18, false, '<P>-<D>-UC<nn>', 'TL-LEND-UC01', 'domain', NULL),
  ('uc_requirement', 'UC requirement', 'use-cases', 19, true, '<use case>-R<nn>', 'TL-LEND-UC01-R01', 'parent', NULL),
  ('pattern', 'Pattern', 'use-cases', 20, false, '<P>-PAT-<name>', 'TL-PAT-LIBRARIAN-ACTION', 'parent', NULL),
  ('pattern_rule', 'Pattern rule', 'use-cases', 21, true, '<pattern>-R<nn>', 'TL-PAT-LIBRARIAN-ACTION-R01', 'parent', NULL);
INSERT INTO meta_kind_parent VALUES
  ('capability', 'domain', 1, 'domain_id'),
  ('use_case', 'capability', 1, 'capability_id'),
  ('uc_requirement', 'use_case', 1, 'use_case_id'),
  ('pattern', 'product', 1, 'product_id'),
  ('pattern_rule', 'pattern', 1, 'pattern_id');
INSERT INTO meta_table VALUES
  ('capability', 'kind', NULL), ('use_case', 'kind', NULL), ('use_case_actor', 'part', 'use_case_id'), ('uc_requirement', 'kind', NULL),
  ('pattern', 'kind', NULL), ('pattern_setting', 'part', 'pattern_id'), ('pattern_rule', 'kind', NULL);
