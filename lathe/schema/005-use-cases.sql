-- Use cases: capabilities, use cases with their actors, UC requirements, each use case's one flow and its steps, and the
-- patterns use cases and domains follow, with their settings, rules and slots. The flow and flow step tables are created
-- in 006-interface-design.sql, after interface: a variant step names its interface, one of the two references that run
-- from use cases forward to interface design, deliberately (meta_stage).

CREATE TABLE capability (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  domain_id VARCHAR NOT NULL REFERENCES domain (id),
  position INTEGER NOT NULL CHECK (position >= 1),
  description VARCHAR NOT NULL CHECK (trim(description) <> ''),
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
  goal VARCHAR NOT NULL CHECK (trim(goal) <> ''),
  result_id VARCHAR NOT NULL REFERENCES operation (id),
  notes VARCHAR
);
COMMENT ON TABLE use_case IS 'One role invoking one command, or asking one query, with the steps that lead to it: its result names the operation, and the use case is a command use case or a query use case by the result''s kind. It has its actors (use_case_actor rows, the first its main actor), its UC requirements and its flow, the same through every interface that offers it. No two use cases of a product share their first actor and their result.';
COMMENT ON COLUMN use_case.id IS 'The use case''s ID, such as TL-LEND-UC01.';
COMMENT ON COLUMN use_case.title IS 'What the actor does: a command use case starts with its command''s verb (Borrow a tool); a query use case names the question (See the tools waiting for repair).';
COMMENT ON COLUMN use_case.capability_id IS 'The capability it sits in.';
COMMENT ON COLUMN use_case.goal IS 'What the actor wants to reach and from where they start, in a sentence or a short paragraph.';
COMMENT ON COLUMN use_case.result_id IS 'The use case''s result: the one command its actor invokes (a command use case), which its main path invokes and after which it only asks queries, or the one query they ask (a query use case), at its main path''s last step that invokes anything. Its kind is the operation''s.';
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
COMMENT ON TABLE uc_requirement IS 'One rule a use case must follow, whatever the interface: a step of the use case''s own flow fulfills it. A rule only one interface can meet is a view or API requirement, or a rule of that interface''s pattern, instead.';
COMMENT ON COLUMN uc_requirement.id IS 'The requirement''s ID: its use case''s ID and R<nn>, such as TL-LEND-UC01-R01.';
COMMENT ON COLUMN uc_requirement.title IS 'The requirement in a few words.';
COMMENT ON COLUMN uc_requirement.use_case_id IS 'The use case it belongs to.';
COMMENT ON COLUMN uc_requirement.statement IS 'The requirement, stated with MUST, MUST NOT, SHOULD or MAY, in one sentence.';
COMMENT ON COLUMN uc_requirement.group_name IS 'A short heading it is shown under among its siblings, such as Validation or Paging.';

CREATE TABLE pattern (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  product_id VARCHAR NOT NULL REFERENCES product (id),
  description VARCHAR NOT NULL CHECK (trim(description) <> ''),
  notes VARCHAR
);
COMMENT ON TABLE pattern IS 'Behavior several use cases share, stated once: a fixed part, the settings each use case that follows it fills in (its configuration, the known ways it varies) and its slots (the open-ended variation, filled with code against a contract). Its settings are pattern_setting rows, its rules pattern_rule records and its slots slot records.';
COMMENT ON COLUMN pattern.id IS 'The pattern''s ID, such as TL-PAT-LIBRARIAN-ACTION.';
COMMENT ON COLUMN pattern.title IS 'The pattern''s name, such as Librarian action.';
COMMENT ON COLUMN pattern.product_id IS 'The product it belongs to.';
COMMENT ON COLUMN pattern.description IS 'The shared behavior, in a paragraph.';
COMMENT ON COLUMN pattern.notes IS 'Longer notes, such as how a domain or use case uses the pattern.';

CREATE TABLE pattern_setting (
  pattern_id VARCHAR NOT NULL REFERENCES pattern (id),
  position INTEGER NOT NULL CHECK (position >= 1),
  name VARCHAR NOT NULL CHECK (regexp_full_match(name, '[a-z][a-z0-9_]*')),
  meaning VARCHAR NOT NULL CHECK (trim(meaning) <> ''),
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
  notes VARCHAR
);
COMMENT ON TABLE pattern_rule IS 'One rule of a pattern. Every domain that follows the pattern owes it, with no exception: a rule that holds for only some followers belongs to their use cases, not to the pattern.';
COMMENT ON COLUMN pattern_rule.id IS 'The rule''s ID: its pattern''s ID and R<nn>, such as TL-PAT-LIBRARIAN-ACTION-R01.';
COMMENT ON COLUMN pattern_rule.title IS 'The rule in a few words.';
COMMENT ON COLUMN pattern_rule.pattern_id IS 'The pattern it belongs to.';
COMMENT ON COLUMN pattern_rule.statement IS 'The rule, stated with MUST, MUST NOT, SHOULD or MAY.';
COMMENT ON COLUMN pattern_rule.group_name IS 'A short heading it is shown under among its siblings, such as Validation or Paging.';
COMMENT ON COLUMN pattern_rule.notes IS 'Longer notes on how the rule applies.';

CREATE TABLE slot (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  pattern_id VARCHAR NOT NULL REFERENCES pattern (id),
  statement VARCHAR NOT NULL CHECK (trim(statement) <> ''),
  fills_vary_by_design VARCHAR CHECK (trim(fills_vary_by_design) <> '')
);
COMMENT ON TABLE slot IS 'An open-ended part of a pattern, which neither its fixed part nor its settings can express: code fills it against its contract. A technical record that fills it, written by hand, is a fill (fills): accidental complexity recorded where it is owed, and debt until the pattern can derive it. Three fills of one slot are a pattern candidate, unless the slot says why its fills vary by design.';
COMMENT ON COLUMN slot.id IS 'The slot''s ID: its pattern''s ID and SL<nn>, such as TL-PAT-LIBRARIAN-ACTION-SL01.';
COMMENT ON COLUMN slot.title IS 'What fills it, in a few words, such as Refusal message.';
COMMENT ON COLUMN slot.pattern_id IS 'The pattern it belongs to.';
COMMENT ON COLUMN slot.statement IS 'Its contract: what every fill MUST do, in one sentence.';
COMMENT ON COLUMN slot.fills_vary_by_design IS 'Why its fills are written per record by design, in one sentence, such as Each UI component builds its own view''s requirements. Given only when every fill holds what is its own record''s alone, never what fills repeat; pattern-candidate then skips the slot and its page says so. None when its fills should repeat, so three of them are a pattern candidate.';

INSERT INTO meta_kind VALUES
  ('capability', 'Capability', 'use-cases', 20, false, '<P>-<D>-CAP<nn>', 'TL-LEND-CAP01', 'domain', NULL, 'essential'),
  ('use_case', 'Use case', 'use-cases', 21, false, '<P>-<D>-UC<nn>', 'TL-LEND-UC01', 'domain', NULL, 'essential'),
  ('uc_requirement', 'UC requirement', 'use-cases', 22, true, '<use case>-R<nn>', 'TL-LEND-UC01-R01', 'parent', NULL, 'essential'),
  ('pattern', 'Pattern', 'use-cases', 25, false, '<P>-PAT-<name>', 'TL-PAT-LIBRARIAN-ACTION', 'parent', NULL, 'essential'),
  ('pattern_rule', 'Pattern rule', 'use-cases', 26, true, '<pattern>-R<nn>', 'TL-PAT-LIBRARIAN-ACTION-R01', 'parent', NULL, 'essential'),
  ('slot', 'Slot', 'use-cases', 27, false, '<pattern>-SL<nn>', 'TL-PAT-LIBRARIAN-ACTION-SL01', 'parent', NULL, 'essential');
INSERT INTO meta_kind_parent VALUES
  ('capability', 'domain', 1, 'domain_id'),
  ('use_case', 'capability', 1, 'capability_id'),
  ('uc_requirement', 'use_case', 1, 'use_case_id'),
  ('pattern', 'product', 1, 'product_id'),
  ('pattern_rule', 'pattern', 1, 'pattern_id'),
  ('slot', 'pattern', 1, 'pattern_id');
INSERT INTO meta_table VALUES
  ('capability', 'kind', NULL), ('use_case', 'kind', NULL), ('use_case_actor', 'part', 'use_case_id'), ('uc_requirement', 'kind', NULL),
  ('pattern', 'kind', NULL), ('pattern_setting', 'part', 'pattern_id'), ('pattern_rule', 'kind', NULL), ('slot', 'kind', NULL);
