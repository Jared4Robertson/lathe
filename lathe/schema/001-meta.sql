-- The meta-model's own tables: what each table is for, the kinds, their parents, the relations and the folders.
-- These rows are part of the schema, written by migrations (and, for a product's own kinds and relations, by the
-- store when it generates their tables). They are never stored in data files.

CREATE TABLE meta_migration (
  version INTEGER PRIMARY KEY,
  name VARCHAR NOT NULL
);
COMMENT ON TABLE meta_migration IS 'The migrations applied to this database, in order.';
COMMENT ON COLUMN meta_migration.version IS 'The migration''s number, from its file name.';
COMMENT ON COLUMN meta_migration.name IS 'The migration''s file name.';

CREATE TYPE table_role AS ENUM ('meta', 'registry', 'supertype', 'kind', 'part', 'link', 'declaration', 'checking', 'result');
CREATE TYPE stage AS ENUM ('define', 'design');
CREATE TYPE obligation_kind AS ENUM ('none', 'full', 'proof');
CREATE TYPE link_role AS ENUM ('design', 'proof');

CREATE TABLE meta_table (
  name VARCHAR PRIMARY KEY,
  role table_role NOT NULL,
  owner_column VARCHAR,
  CHECK ((role = 'part') = (owner_column IS NOT NULL))
);
COMMENT ON TABLE meta_table IS 'Every table in the schema and what it is for. Only kind, part, link, declaration and checking tables are stored in data files.';
COMMENT ON COLUMN meta_table.name IS 'The table''s name, which is also its data file''s name: data/<name>.jsonl.';
COMMENT ON COLUMN meta_table.role IS 'meta: the meta-model; registry: every record ID; supertype: the records one relation end accepts; kind: one row per record of a kind; part: rows that belong to one record, removed with it; link: one row per link of a relation; declaration: a product''s own kinds and relations; checking: checks and their settings; result: the problems a run finds.';
COMMENT ON COLUMN meta_table.owner_column IS 'For a part table, the column naming the record each row belongs to.';

CREATE TABLE meta_section (
  name VARCHAR PRIMARY KEY,
  stage stage,
  position INTEGER NOT NULL CHECK (position >= 1),
  label VARCHAR NOT NULL,
  description VARCHAR NOT NULL
);
COMMENT ON TABLE meta_section IS 'The folders a domain''s records are read in, by stage, such as Domain model or Test plan, and the Shared folder at product level.';
COMMENT ON COLUMN meta_section.name IS 'The folder''s name, such as domain-model.';
COMMENT ON COLUMN meta_section.stage IS 'The stage the folder belongs to; none for the product-level Shared folder.';
COMMENT ON COLUMN meta_section.position IS 'The folder''s place in its stage, from 1.';
COMMENT ON COLUMN meta_section.label IS 'The folder''s name as people read it.';
COMMENT ON COLUMN meta_section.description IS 'What the folder holds.';

CREATE TABLE meta_kind (
  name VARCHAR PRIMARY KEY CHECK (regexp_full_match(name, '[a-z][a-z0-9_]*')),
  label VARCHAR NOT NULL,
  stage stage,
  section VARCHAR REFERENCES meta_section (name),
  obligation obligation_kind NOT NULL,
  id_pattern VARCHAR,
  id_example VARCHAR,
  product_id VARCHAR
);
COMMENT ON TABLE meta_kind IS 'Every kind of record: Lathe''s own and each product''s. A kind''s table has the same name, and its description is that table''s comment.';
COMMENT ON COLUMN meta_kind.name IS 'The kind''s name, which is also its table''s name, such as use_case.';
COMMENT ON COLUMN meta_kind.label IS 'The kind''s name as people read it, such as Use case.';
COMMENT ON COLUMN meta_kind.stage IS 'The stage its records belong to: define or design; none for a kind outside the stages.';
COMMENT ON COLUMN meta_kind.section IS 'The folder its records are read in.';
COMMENT ON COLUMN meta_kind.obligation IS 'What a record of the kind asks: full (it must be designed, built and proved), proof (it needs proof only) or none.';
COMMENT ON COLUMN meta_kind.id_pattern IS 'How its IDs are written, such as <P>-<D>-UC<nn>.';
COMMENT ON COLUMN meta_kind.id_example IS 'An example ID, such as TL-LEND-UC01.';
COMMENT ON COLUMN meta_kind.product_id IS 'For a product''s own kind, the product that declares it; none for Lathe''s kinds.';

CREATE TABLE meta_kind_parent (
  kind VARCHAR NOT NULL REFERENCES meta_kind (name),
  parent_kind VARCHAR NOT NULL REFERENCES meta_kind (name),
  position INTEGER NOT NULL CHECK (position >= 1),
  column_name VARCHAR NOT NULL,
  PRIMARY KEY (kind, parent_kind),
  UNIQUE (kind, position)
);
COMMENT ON TABLE meta_kind_parent IS 'The kinds a kind''s records may sit under, and the column that names each. A record''s parent is the first of these columns, by position, that holds a value.';
COMMENT ON COLUMN meta_kind_parent.kind IS 'The kind.';
COMMENT ON COLUMN meta_kind_parent.parent_kind IS 'A kind its records may sit under.';
COMMENT ON COLUMN meta_kind_parent.position IS 'How specific this parent is, from 1 (the nearest container) outward.';
COMMENT ON COLUMN meta_kind_parent.column_name IS 'The column of the kind''s table that names a parent of this kind.';

CREATE TABLE meta_relation (
  name VARCHAR PRIMARY KEY CHECK (regexp_full_match(name, '[a-z][a-z0-9_]*')),
  role link_role,
  forward_label VARCHAR NOT NULL,
  reverse_label VARCHAR NOT NULL,
  product_id VARCHAR
);
COMMENT ON TABLE meta_relation IS 'Every relation: Lathe''s own and each product''s. Its links are rows of the table with the same name, (source_id, target_id), and its description is that table''s comment.';
COMMENT ON COLUMN meta_relation.name IS 'The relation''s name, which is also its link table''s name, such as proves.';
COMMENT ON COLUMN meta_relation.role IS 'What a link does for coverage: design (it designs the obligation it targets) or proof (it proves it); none otherwise.';
COMMENT ON COLUMN meta_relation.forward_label IS 'The link read from its source, such as Proves.';
COMMENT ON COLUMN meta_relation.reverse_label IS 'The link read from its target, such as Proved by.';
COMMENT ON COLUMN meta_relation.product_id IS 'For a product''s own relation, the product that declares it; none for Lathe''s relations.';

CREATE TABLE meta_relation_pair (
  relation VARCHAR NOT NULL REFERENCES meta_relation (name),
  source_kind VARCHAR NOT NULL,
  target_kind VARCHAR NOT NULL,
  description VARCHAR NOT NULL,
  PRIMARY KEY (relation, source_kind, target_kind)
);
COMMENT ON TABLE meta_relation_pair IS 'The kinds a relation may link, as (source kind, target kind) pairs. A target kind of * means any record.';
COMMENT ON COLUMN meta_relation_pair.relation IS 'The relation.';
COMMENT ON COLUMN meta_relation_pair.source_kind IS 'The kind a link starts from.';
COMMENT ON COLUMN meta_relation_pair.target_kind IS 'The kind a link points at, or * for any record.';
COMMENT ON COLUMN meta_relation_pair.description IS 'What a link between these kinds means.';

CREATE TABLE meta_supertype_member (
  supertype VARCHAR NOT NULL,
  kind VARCHAR NOT NULL,
  PRIMARY KEY (supertype, kind)
);
COMMENT ON TABLE meta_supertype_member IS 'The kinds each supertype table holds. A supertype has a row for every record of its member kinds, so a link can point at any of them with a real foreign key.';
COMMENT ON COLUMN meta_supertype_member.supertype IS 'The supertype table, such as obligation.';
COMMENT ON COLUMN meta_supertype_member.kind IS 'A kind whose records it holds.';

INSERT INTO meta_table VALUES
  ('meta_migration', 'meta', NULL), ('meta_table', 'meta', NULL), ('meta_section', 'meta', NULL),
  ('meta_kind', 'meta', NULL), ('meta_kind_parent', 'meta', NULL), ('meta_relation', 'meta', NULL),
  ('meta_relation_pair', 'meta', NULL), ('meta_supertype_member', 'meta', NULL);

INSERT INTO meta_section VALUES
  ('domain-model', 'define', 1, 'Domain model', 'The aggregates and their domain rules.'),
  ('use-cases', 'define', 2, 'Capabilities', 'Capabilities, the use cases in them, and their UC requirements.'),
  ('interaction-design', 'design', 1, 'Interaction design', 'Flows and their steps, views, APIs and their endpoints, integrations, and interaction requirements.'),
  ('technical-specification', 'design', 2, 'Technical specification', 'The components of the target design, in their layers, and the technical flows that use them.'),
  ('test-plan', 'design', 3, 'Test plan', 'The tests that prove the obligations.'),
  ('shared', NULL, 1, 'Shared', 'What a product''s domains share: patterns, standards and their rules.');
