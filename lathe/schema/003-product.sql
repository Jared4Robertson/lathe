-- Products, the roles their records name, and their typed settings. Products and roles sit outside the stages. Then
-- discovery, the first stage: the business outcomes a product exists to achieve.

CREATE TABLE product (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  description VARCHAR,
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
  description VARCHAR,
  PRIMARY KEY (product_id, name)
);
COMMENT ON TABLE role IS 'A role the product''s records name, such as Owner, Reader or Agent: a use case''s actors and a question''s owner. Specs name roles, never people.';
COMMENT ON COLUMN role.product_id IS 'The product.';
COMMENT ON COLUMN role.name IS 'The role''s name, such as Librarian.';
COMMENT ON COLUMN role.description IS 'Who takes the role and what they do.';

CREATE TABLE product_setting (
  product_id VARCHAR PRIMARY KEY REFERENCES product (id),
  max_children INTEGER NOT NULL CHECK (max_children >= 1),
  max_entities_per_aggregate INTEGER NOT NULL CHECK (max_entities_per_aggregate >= 1)
);
COMMENT ON TABLE product_setting IS 'A product''s typed settings for its checks. A product without a row takes the defaults.';
COMMENT ON COLUMN product_setting.product_id IS 'The product.';
COMMENT ON COLUMN product_setting.max_children IS 'The most children of one kind a record should have before too-many-children warns; the default is 15.';
COMMENT ON COLUMN product_setting.max_entities_per_aggregate IS 'The most entities an aggregate should have before aggregate-too-large warns; the default is 7.';

CREATE TABLE business_outcome (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  product_id VARCHAR NOT NULL REFERENCES product (id),
  statement VARCHAR NOT NULL CHECK (trim(statement) <> ''),
  measure VARCHAR NOT NULL CHECK (trim(measure) <> ''),
  target VARCHAR NOT NULL CHECK (trim(target) <> ''),
  notes VARCHAR
);
COMMENT ON TABLE business_outcome IS 'A business outcome: a measurable change the product exists to bring about, which its capabilities serve. The trace runs from it to a capability, a use case, the code and the tests.';
COMMENT ON COLUMN business_outcome.id IS 'The outcome''s ID: its product''s ID and BO<nn>, such as TL-BO01.';
COMMENT ON COLUMN business_outcome.title IS 'The outcome in a few words, such as More tools in use.';
COMMENT ON COLUMN business_outcome.product_id IS 'The product it belongs to.';
COMMENT ON COLUMN business_outcome.statement IS 'The outcome, stated so it can be measured, in one sentence.';
COMMENT ON COLUMN business_outcome.measure IS 'What is measured to know whether it is reached, and how.';
COMMENT ON COLUMN business_outcome.target IS 'The value of the measure that counts as reached, and by when.';
COMMENT ON COLUMN business_outcome.notes IS 'Longer notes, such as where the measure comes from.';

INSERT INTO meta_kind VALUES
  ('product', 'Product', NULL, 1, false, '<P>', 'TL', NULL, NULL),
  ('business_outcome', 'Business outcome', 'discovery', 2, false, '<P>-BO<nn>', 'TL-BO01', 'parent', NULL);
INSERT INTO meta_kind_parent VALUES ('business_outcome', 'product', 1, 'product_id');
INSERT INTO meta_table VALUES ('product', 'kind', NULL), ('role', 'part', 'product_id'), ('product_setting', 'checking', NULL), ('business_outcome', 'kind', NULL);
