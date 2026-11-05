-- Products, the roles their records name, and their typed settings. Products and roles sit outside the stages. Then
-- discovery, the first stage: the business outcomes a product exists to achieve, and the journeys that reach them.

CREATE TABLE product (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  description VARCHAR NOT NULL CHECK (trim(description) <> ''),
  icon VARCHAR,
  color VARCHAR,
  notes VARCHAR
);
COMMENT ON TABLE product IS 'A product: the root of a set of specifications.';
COMMENT ON COLUMN product.id IS 'The product''s ID, its prefix, such as TL.';
COMMENT ON COLUMN product.title IS 'The product''s name, such as Tool Library.';
COMMENT ON COLUMN product.description IS 'What the product is, who it is for and what it must do, in a paragraph.';
COMMENT ON COLUMN product.icon IS 'An emoji or short text shown for the product in the app''s space rail.';
COMMENT ON COLUMN product.color IS 'A CSS color for the product in the app''s space rail.';
COMMENT ON COLUMN product.notes IS 'Longer notes on the product, such as how it is delivered.';

CREATE TABLE role (
  product_id VARCHAR NOT NULL REFERENCES product (id),
  name VARCHAR NOT NULL CHECK (trim(name) <> ''),
  description VARCHAR NOT NULL CHECK (trim(description) <> ''),
  PRIMARY KEY (product_id, name)
);
COMMENT ON TABLE role IS 'A role the product''s records name, such as Owner, Reader or Agent: a use case''s actors and a question''s owner. Specs name roles, never people.';
COMMENT ON COLUMN role.product_id IS 'The product.';
COMMENT ON COLUMN role.name IS 'The role''s name, such as Librarian.';
COMMENT ON COLUMN role.description IS 'Who takes the role and what they do in the product, in a sentence.';

CREATE TABLE product_setting (
  product_id VARCHAR PRIMARY KEY REFERENCES product (id),
  max_children INTEGER NOT NULL CHECK (max_children >= 1),
  max_entities_per_aggregate INTEGER NOT NULL CHECK (max_entities_per_aggregate >= 1),
  technology_words VARCHAR[] NOT NULL,
  strict_check BOOLEAN CHECK (strict_check),
  accepted_warnings INTEGER CHECK (accepted_warnings >= 1),
  CHECK (accepted_warnings IS NULL OR strict_check)
);
COMMENT ON TABLE product_setting IS 'A product''s typed settings for its checks. A product without a row takes the defaults.';
COMMENT ON COLUMN product_setting.product_id IS 'The product.';
COMMENT ON COLUMN product_setting.max_children IS 'The most children of one kind a record should have before too-many-children warns; the default is 15.';
COMMENT ON COLUMN product_setting.max_entities_per_aggregate IS 'The most entities an aggregate should have before aggregate-too-large warns; the default is 7.';
COMMENT ON COLUMN product_setting.technology_words IS 'The words, besides Lathe''s own, that name technology in this product''s essential records, which accidental-in-essential warns of, such as the name of a framework the product is built with; none by default.';
COMMENT ON COLUMN product_setting.strict_check IS 'True when the product''s check is strict: lathe check then fails on any warning of the product, as on an error, beyond the accepted warnings; none by default, when warnings never fail it.';
COMMENT ON COLUMN product_setting.accepted_warnings IS 'The warnings a strict check accepts while zero cannot be reached yet, a recorded deviation shown with the setting and on the check page: the check fails when the product has more, and when it has fewer, until this is lowered to the new count, so it only moves down. Never above the warnings the product has when it is set; none when every warning fails it.';

CREATE TABLE business_outcome (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  product_id VARCHAR NOT NULL REFERENCES product (id),
  statement VARCHAR NOT NULL CHECK (trim(statement) <> ''),
  measure VARCHAR NOT NULL CHECK (trim(measure) <> ''),
  target VARCHAR NOT NULL CHECK (trim(target) <> ''),
  measured_outside VARCHAR CHECK (trim(measured_outside) <> ''),
  notes VARCHAR
);
COMMENT ON TABLE business_outcome IS 'A business outcome: a measurable change the product exists to bring about, which its capabilities and journeys serve and its tests or records measure (measured_by). The trace runs from it to a capability or a journey, a use case, the code and the tests.';
COMMENT ON COLUMN business_outcome.id IS 'The outcome''s ID: its product''s ID and BO<nn>, such as TL-BO01.';
COMMENT ON COLUMN business_outcome.title IS 'The outcome in a few words, such as More tools in use.';
COMMENT ON COLUMN business_outcome.product_id IS 'The product it belongs to.';
COMMENT ON COLUMN business_outcome.statement IS 'The outcome, stated so it can be measured, in one sentence.';
COMMENT ON COLUMN business_outcome.measure IS 'What is measured to know whether it is reached, and how.';
COMMENT ON COLUMN business_outcome.target IS 'The value of the measure that counts as reached, and by when.';
COMMENT ON COLUMN business_outcome.measured_outside IS 'How the outcome is measured outside the code, when no test or record of the product can measure it (adoption by other repos, sales): who counts what, from where. Give it only then; an outcome the code can measure links what measures it with measured_by.';
COMMENT ON COLUMN business_outcome.notes IS 'Longer notes, such as where the measure comes from.';

-- A journey is the summary-level goal: an ordered string of steps from a trigger to a result, each step a use case of
-- any actor and any domain, or a handoff (a policy: whenever an event, then a command), on a main path and any
-- alternate paths. A use case stays the one-sitting goal of one actor; a capability says what the business can do, a
-- journey in what order it happens.
CREATE TABLE journey (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  product_id VARCHAR NOT NULL REFERENCES product (id),
  trigger VARCHAR NOT NULL CHECK (trim(trigger) <> ''),
  result VARCHAR NOT NULL CHECK (trim(result) <> ''),
  notes VARCHAR
);
COMMENT ON TABLE journey IS 'A journey: the use cases and handoffs, in order, that take the product''s people from a trigger to a result a business outcome measures, across actors and domains. It serves business outcomes as a capability does, and its journey test drives it end to end.';
COMMENT ON COLUMN journey.id IS 'The journey''s ID: its product''s ID and JR<nn>, such as TL-JR01.';
COMMENT ON COLUMN journey.title IS 'The summary goal, verb first, naming no interface, such as Get a damaged tool back in lending.';
COMMENT ON COLUMN journey.product_id IS 'The product it belongs to. A journey crosses domains, never products.';
COMMENT ON COLUMN journey.trigger IS 'What starts it, in the world, in a sentence, such as A tool is found damaged.';
COMMENT ON COLUMN journey.result IS 'What it ends in, which an outcome measures, in a sentence, such as The tool is available to borrow again.';
COMMENT ON COLUMN journey.notes IS 'Longer notes on the journey, such as where its time is lost.';

CREATE TABLE journey_step (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  journey_id VARCHAR NOT NULL REFERENCES journey (id),
  path VARCHAR NOT NULL CHECK (trim(path) <> ''),
  position INTEGER NOT NULL CHECK (position >= 1),
  UNIQUE (journey_id, path, position)
);
COMMENT ON TABLE journey_step IS 'One step of a journey, in order on its path, in the journey''s words. It carries out one use case or one policy (a handoff), of its own product (carries_out); a step that carries out nothing yet is a use case still to write. Its actors are its use case''s, derived; a handoff''s actor is the product itself.';
COMMENT ON COLUMN journey_step.id IS 'The step''s ID: its journey''s ID and S<nn>, such as TL-JR01-S01.';
COMMENT ON COLUMN journey_step.title IS 'What happens, in the journey''s words, such as The librarian takes the tool back needing repair.';
COMMENT ON COLUMN journey_step.journey_id IS 'The journey it belongs to.';
COMMENT ON COLUMN journey_step.path IS 'The path it is on: main, or an alternate named for when it is taken, such as found outside a return.';
COMMENT ON COLUMN journey_step.position IS 'Its place on its path, from 1.';

INSERT INTO meta_kind VALUES
  ('product', 'Product', NULL, 1, false, '<P>', 'TL', NULL, NULL, 'essential'),
  ('business_outcome', 'Business outcome', 'discovery', 2, false, '<P>-BO<nn>', 'TL-BO01', 'parent', NULL, 'essential'),
  ('journey', 'Journey', 'discovery', 3, false, '<P>-JR<nn>', 'TL-JR01', 'parent', NULL, 'essential'),
  ('journey_step', 'Journey step', 'discovery', 4, false, '<journey>-S<nn>', 'TL-JR01-S01', 'parent', NULL, 'essential');
INSERT INTO meta_kind_parent VALUES ('business_outcome', 'product', 1, 'product_id'), ('journey', 'product', 1, 'product_id'), ('journey_step', 'journey', 1, 'journey_id');
INSERT INTO meta_table VALUES ('product', 'kind', NULL), ('role', 'part', 'product_id'), ('product_setting', 'checking', NULL), ('business_outcome', 'kind', NULL),
  ('journey', 'kind', NULL), ('journey_step', 'kind', NULL);
