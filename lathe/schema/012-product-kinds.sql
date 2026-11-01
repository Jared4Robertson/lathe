-- A product's own kinds and relations. The store generates a table for each declared kind and relation, with the same
-- registry, keys and checks as Lathe's own.

CREATE TYPE field_type AS ENUM ('text', 'integer', 'boolean', 'date');

CREATE TABLE product_kind (
  name VARCHAR PRIMARY KEY CHECK (regexp_full_match(name, '[a-z][a-z0-9_]*')),
  product_id VARCHAR NOT NULL REFERENCES product (id),
  label VARCHAR NOT NULL CHECK (trim(label) <> ''),
  description VARCHAR NOT NULL CHECK (trim(description) <> ''),
  parent_kind VARCHAR NOT NULL,
  stage stage,
  obligation BOOLEAN NOT NULL,
  id_pattern VARCHAR,
  id_example VARCHAR,
  title_form title_form
);
COMMENT ON TABLE product_kind IS 'A kind a product adds to Lathe''s, such as a report or a CLI command. Its records sit under one parent kind, and its fields are product_kind_field rows.';
COMMENT ON COLUMN product_kind.name IS 'The kind''s name, in lower case with underscores, which is also its table''s name; it must not be a table Lathe already has.';
COMMENT ON COLUMN product_kind.product_id IS 'The product that declares it; only that product''s records may be of the kind.';
COMMENT ON COLUMN product_kind.label IS 'The kind''s name as people read it, such as Report.';
COMMENT ON COLUMN product_kind.description IS 'What a record of the kind is.';
COMMENT ON COLUMN product_kind.parent_kind IS 'The kind its records sit under, their one parent: one of Lathe''s or another product kind. Its table gets a required <parent_kind>_id column.';
COMMENT ON COLUMN product_kind.stage IS 'The stage its records belong to, any of the six, if one; such as technical-specification for a kind of code Lathe has no kind for.';
COMMENT ON COLUMN product_kind.obligation IS 'Whether a record of the kind is an obligation, to be designed, built and proved. An obligation kind joins the obligation supertype.';
COMMENT ON COLUMN product_kind.id_pattern IS 'How its IDs are written, its own pattern, such as <command>-CLI.';
COMMENT ON COLUMN product_kind.id_example IS 'An example ID.';
COMMENT ON COLUMN product_kind.title_form IS 'For a code-bound kind, how its titles are written (meta_kind_title): identifier, invocation or kebab-case; none for a kind titled in words.';

CREATE TABLE product_kind_field (
  kind VARCHAR NOT NULL REFERENCES product_kind (name),
  position INTEGER NOT NULL CHECK (position >= 1),
  name VARCHAR NOT NULL CHECK (regexp_full_match(name, '[a-z][a-z0-9_]*')),
  type field_type NOT NULL,
  required BOOLEAN NOT NULL,
  description VARCHAR NOT NULL CHECK (trim(description) <> ''),
  titles BOOLEAN CHECK (titles),
  PRIMARY KEY (kind, position),
  UNIQUE (kind, name)
);
COMMENT ON TABLE product_kind_field IS 'One typed field of a product kind, in order: a column of its table.';
COMMENT ON COLUMN product_kind_field.kind IS 'The product kind.';
COMMENT ON COLUMN product_kind_field.position IS 'The field''s place among the kind''s columns, from 1.';
COMMENT ON COLUMN product_kind_field.name IS 'The column''s name, in lower case with underscores; not id, title or the parent column. A field named statement, goal, meaning or description is the kind''s lead text, shown first on its records'' pages: a kind has at most one, and it must be required.';
COMMENT ON COLUMN product_kind_field.type IS 'text, integer, boolean or date (YYYY-MM-DD).';
COMMENT ON COLUMN product_kind_field.required IS 'Whether every record of the kind must give it.';
COMMENT ON COLUMN product_kind_field.description IS 'What the field holds.';
COMMENT ON COLUMN product_kind_field.titles IS 'Whether the field''s value is also the record''s title, such as a module''s file: every write sets the title from it, and a title that differs is refused. Only a required text field titles its kind, and at most one does.';

CREATE TABLE product_relation (
  name VARCHAR NOT NULL CHECK (regexp_full_match(name, '[a-z][a-z0-9_]*')),
  source_kind VARCHAR NOT NULL,
  target_kind VARCHAR NOT NULL,
  product_id VARCHAR NOT NULL REFERENCES product (id),
  role link_role,
  forward_label VARCHAR NOT NULL CHECK (trim(forward_label) <> ''),
  reverse_label VARCHAR NOT NULL CHECK (trim(reverse_label) <> ''),
  description VARCHAR NOT NULL CHECK (trim(description) <> ''),
  PRIMARY KEY (name, source_kind, target_kind)
);
COMMENT ON TABLE product_relation IS 'A pair of kinds a product lets a relation link. A new relation name gets its own link table; a name Lathe already has adds the pair to that relation, when its link table''s ends accept the two kinds.';
COMMENT ON COLUMN product_relation.name IS 'The relation''s name, in lower case with underscores.';
COMMENT ON COLUMN product_relation.source_kind IS 'The kind a link starts from.';
COMMENT ON COLUMN product_relation.target_kind IS 'The kind a link points at, or * for any record.';
COMMENT ON COLUMN product_relation.product_id IS 'The product that declares it.';
COMMENT ON COLUMN product_relation.role IS 'design, build or proof, for a new relation that counts toward coverage: a design or build link''s source builds its target once it names a file that exists, and a proof link''s source proves it. A new relation''s links stay inside one product.';
COMMENT ON COLUMN product_relation.forward_label IS 'The link read from its source.';
COMMENT ON COLUMN product_relation.reverse_label IS 'The link read from its target.';
COMMENT ON COLUMN product_relation.description IS 'What a link between these kinds means.';

INSERT INTO meta_table VALUES ('product_kind', 'declaration', NULL), ('product_kind_field', 'declaration', NULL), ('product_relation', 'declaration', NULL);
