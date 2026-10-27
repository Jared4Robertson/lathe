-- Products, the roles their records name, and their typed settings. Products and roles sit outside the stages.

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
  max_children INTEGER NOT NULL CHECK (max_children >= 1)
);
COMMENT ON TABLE product_setting IS 'A product''s typed settings for its checks. A product without a row takes the defaults.';
COMMENT ON COLUMN product_setting.product_id IS 'The product.';
COMMENT ON COLUMN product_setting.max_children IS 'The most children of one kind a record should have before too-many-children warns; the default is 15.';

INSERT INTO meta_kind VALUES ('product', 'Product', NULL, 1, false, '<P>', 'TL', NULL, NULL);
INSERT INTO meta_table VALUES ('product', 'kind', NULL), ('role', 'part', 'product_id'), ('product_setting', 'checking', NULL);
