-- What a product's domains share: patterns with their settings and rules, and standards with their rules.

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
COMMENT ON TABLE pattern_rule IS 'One rule of a pattern. Every domain that follows the pattern proves it, unless it names a setting all of that domain''s followers mark Not applicable, or its applies-when condition is met by no follower there.';
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

CREATE TABLE standard (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  product_id VARCHAR NOT NULL REFERENCES product (id),
  description VARCHAR
);
COMMENT ON TABLE standard IS 'A library of engineering rules that holds for the product''s code, such as logging, error handling or naming. What follows one of its rules meets it; a standard asks nothing of a domain.';
COMMENT ON COLUMN standard.id IS 'The standard''s ID, such as TL-STD-CODE.';
COMMENT ON COLUMN standard.title IS 'The standard''s name.';
COMMENT ON COLUMN standard.product_id IS 'The product it belongs to.';
COMMENT ON COLUMN standard.description IS 'What the standard covers, in a paragraph.';

CREATE TABLE standard_rule (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  standard_id VARCHAR NOT NULL REFERENCES standard (id),
  statement VARCHAR NOT NULL CHECK (trim(statement) <> ''),
  group_name VARCHAR
);
COMMENT ON TABLE standard_rule IS 'One rule of a standard. It is not an obligation: what follows it links to it with meets.';
COMMENT ON COLUMN standard_rule.id IS 'The rule''s ID: its standard''s ID and R<nn>, such as TL-STD-CODE-R01.';
COMMENT ON COLUMN standard_rule.title IS 'The rule in a few words.';
COMMENT ON COLUMN standard_rule.standard_id IS 'The standard it belongs to.';
COMMENT ON COLUMN standard_rule.statement IS 'The rule, stated with MUST, MUST NOT, SHOULD or MAY.';
COMMENT ON COLUMN standard_rule.group_name IS 'A short heading it is shown under among its siblings.';

INSERT INTO meta_kind VALUES
  ('pattern', 'Pattern', 'define', 'shared', 'none', '<P>-PAT-<name>', 'TL-PAT-LIBRARIAN-ACTION', NULL),
  ('pattern_rule', 'Pattern rule', 'define', 'shared', 'proof', '<pattern>-R<nn>', 'TL-PAT-LIBRARIAN-ACTION-R01', NULL),
  ('standard', 'Standard', 'design', 'shared', 'none', '<P>-STD-<name>', 'TL-STD-CODE', NULL),
  ('standard_rule', 'Standard rule', 'design', 'shared', 'none', '<standard>-R<nn>', 'TL-STD-CODE-R01', NULL);
INSERT INTO meta_kind_parent VALUES
  ('pattern', 'product', 1, 'product_id'),
  ('pattern_rule', 'pattern', 1, 'pattern_id'),
  ('standard', 'product', 1, 'product_id'),
  ('standard_rule', 'standard', 1, 'standard_id');
INSERT INTO meta_table VALUES
  ('pattern', 'kind', NULL), ('pattern_setting', 'part', 'pattern_id'), ('pattern_rule', 'kind', NULL),
  ('standard', 'kind', NULL), ('standard_rule', 'kind', NULL);
