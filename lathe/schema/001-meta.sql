-- The meta-model's own tables: what each table is for, the stages, the kinds, their parents, the relations and the
-- supertypes. These rows are part of the schema, written by migrations (and, for a product's own kinds and relations,
-- by the store when it generates their tables). They are never stored in data files.

CREATE TABLE meta_migration (
  version INTEGER PRIMARY KEY,
  name VARCHAR NOT NULL
);
COMMENT ON TABLE meta_migration IS 'The migrations applied to this database, in order.';
COMMENT ON COLUMN meta_migration.version IS 'The migration''s number, from its file name.';
COMMENT ON COLUMN meta_migration.name IS 'The migration''s file name.';

CREATE TYPE table_role AS ENUM ('meta', 'registry', 'supertype', 'kind', 'part', 'link', 'declaration', 'checking', 'result');
-- The stages, in the order a product is modeled: links run from what is defined first to what is defined later.
CREATE TYPE stage AS ENUM ('discovery', 'domain-model', 'use-cases', 'interaction-design', 'technical-specification', 'test-plan');
CREATE TYPE id_scope AS ENUM ('product', 'domain', 'parent');
CREATE TYPE link_role AS ENUM ('design', 'build', 'proof');
CREATE TYPE link_scope AS ENUM ('product', 'domain', 'aggregate');
-- How a code-bound kind's titles are written: one identifier as in code, an invocation, or a kebab-case name.
CREATE TYPE title_form AS ENUM ('identifier', 'invocation', 'kebab-case');
-- Whether a kind's records are essential complexity, decided once per product (what any correct solution has to
-- capture), or accidental complexity (what comes from the means used to build it); or whether that follows from the
-- record they sit under (a test, a standard rule) or from the record's own type (a standard).
CREATE TYPE complexity AS ENUM ('essential', 'accidental', 'as-parent', 'by-type');

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

CREATE TABLE meta_stage (
  name stage PRIMARY KEY,
  position INTEGER NOT NULL UNIQUE CHECK (position >= 1),
  label VARCHAR NOT NULL,
  description VARCHAR NOT NULL
);
COMMENT ON TABLE meta_stage IS 'The stages a product is modeled in, in order: discovery, domain model, use cases, interaction design, technical specification and test plan. Kinds are colored and ordered by stage; product, role and open questions sit outside them.';
COMMENT ON COLUMN meta_stage.name IS 'The stage''s name, such as domain-model.';
COMMENT ON COLUMN meta_stage.position IS 'The stage''s place in the order, from 1.';
COMMENT ON COLUMN meta_stage.label IS 'The stage''s name as people read it.';
COMMENT ON COLUMN meta_stage.description IS 'What the stage holds.';

CREATE TABLE meta_kind (
  name VARCHAR PRIMARY KEY CHECK (regexp_full_match(name, '[a-z][a-z0-9_]*')),
  label VARCHAR NOT NULL,
  stage stage,
  position INTEGER UNIQUE CHECK (position >= 1),
  obligation BOOLEAN NOT NULL,
  id_pattern VARCHAR,
  id_example VARCHAR,
  id_scope id_scope,
  product_id VARCHAR,
  complexity complexity
);
COMMENT ON TABLE meta_kind IS 'Every kind of record: Lathe''s own and each product''s. A kind''s table has the same name, and its description is that table''s comment.';
COMMENT ON COLUMN meta_kind.name IS 'The kind''s name, which is also its table''s name, such as use_case.';
COMMENT ON COLUMN meta_kind.label IS 'The kind''s name as people read it, such as Use case.';
COMMENT ON COLUMN meta_kind.stage IS 'The stage its records belong to; none for a kind outside the stages (product and open question).';
COMMENT ON COLUMN meta_kind.position IS 'The kind''s place in the order people read kinds, from 1: stage by stage, in the plan''s order within each; none for a product''s own kind, which follows Lathe''s by name.';
COMMENT ON COLUMN meta_kind.obligation IS 'Whether a record of the kind is an obligation: something that must be designed, built and proved. Obligation kinds are the members of the obligation supertype.';
COMMENT ON COLUMN meta_kind.id_pattern IS 'How its IDs are written, such as <P>-<D>-UC<nn>.';
COMMENT ON COLUMN meta_kind.id_example IS 'An example ID, such as TL-LEND-UC01.';
COMMENT ON COLUMN meta_kind.id_scope IS 'What its IDs start with, followed by a hyphen: its product''s ID, its domain''s ID or its parent''s ID. A kind with no owner takes its product, or its domain, from that prefix. None for a kind whose IDs are free.';
COMMENT ON COLUMN meta_kind.product_id IS 'For a product''s own kind, the product that declares it; none for Lathe''s kinds.';
COMMENT ON COLUMN meta_kind.complexity IS 'Whether its records are essential or accidental complexity. essential: complexity that comes from the problem itself, decided once per product (discovery, the domain model, use cases and patterns, the what of interaction design, test data sets); accidental: complexity that comes from the means used to build the solution (the technical specification), which is derived, provided or a recorded fill at a slot; as-parent: as the record it sits under (a test, a standard rule); by-type: as its own type says (a standard: quality is essential, engineering accidental). A kind is never mixed: one that holds both is split. None for an open question, a note on the spec rather than part of it.';

CREATE TABLE meta_kind_title (
  kind VARCHAR PRIMARY KEY REFERENCES meta_kind (name),
  form title_form NOT NULL
);
COMMENT ON TABLE meta_kind_title IS 'The code-bound kinds, whose records are titled by what they are in code rather than in words. Every title is in sentence case, unique within its kind and product, and ends without a period; a kind listed here also takes its form, which the store refuses a title for breaking.';
COMMENT ON COLUMN meta_kind_title.kind IS 'The kind.';
COMMENT ON COLUMN meta_kind_title.form IS 'identifier: one token exactly as in code, with no whitespace, such as LoanRow or lathe:tabs; invocation: the command as typed, lower case first, words one space apart, such as lathe add; kebab-case: lower-case words joined by hyphens, such as event-tense.';

CREATE TABLE meta_kind_parent (
  kind VARCHAR NOT NULL REFERENCES meta_kind (name),
  parent_kind VARCHAR NOT NULL REFERENCES meta_kind (name),
  position INTEGER NOT NULL CHECK (position >= 1),
  column_name VARCHAR NOT NULL,
  PRIMARY KEY (kind, parent_kind),
  UNIQUE (kind, position)
);
COMMENT ON TABLE meta_kind_parent IS 'The kinds a kind''s records may sit under, and the column that names each. Every record has exactly one parent: a kind with two rows here (an endpoint under a command or a query) gives a value in exactly one of the two columns. A kind with no row has no owner.';
COMMENT ON COLUMN meta_kind_parent.kind IS 'The kind.';
COMMENT ON COLUMN meta_kind_parent.parent_kind IS 'A kind its records may sit under.';
COMMENT ON COLUMN meta_kind_parent.position IS 'The order of the kind''s parent kinds, from 1.';
COMMENT ON COLUMN meta_kind_parent.column_name IS 'The column of the kind''s table that names a parent of this kind.';

CREATE TABLE meta_relation (
  name VARCHAR PRIMARY KEY CHECK (regexp_full_match(name, '[a-z][a-z0-9_]*')),
  role link_role,
  scope link_scope NOT NULL,
  forward_label VARCHAR NOT NULL,
  reverse_label VARCHAR NOT NULL,
  product_id VARCHAR
);
COMMENT ON TABLE meta_relation IS 'Every relation: Lathe''s own and each product''s. Its links are rows of the table with the same name, (source_id, target_id), and its description is that table''s comment.';
COMMENT ON COLUMN meta_relation.name IS 'The relation''s name, which is also its link table''s name, such as raises.';
COMMENT ON COLUMN meta_relation.role IS 'What a link does for coverage: design (it designs the obligation it targets), build (it builds it) or proof (it proves it); none otherwise.';
COMMENT ON COLUMN meta_relation.scope IS 'What a link''s two ends must share: product (every link), domain, or aggregate.';
COMMENT ON COLUMN meta_relation.forward_label IS 'The link read from its source, such as Raises.';
COMMENT ON COLUMN meta_relation.reverse_label IS 'The link read from its target, such as Raised by.';
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
  ('meta_migration', 'meta', NULL), ('meta_table', 'meta', NULL), ('meta_stage', 'meta', NULL),
  ('meta_kind', 'meta', NULL), ('meta_kind_title', 'meta', NULL), ('meta_kind_parent', 'meta', NULL), ('meta_relation', 'meta', NULL),
  ('meta_relation_pair', 'meta', NULL), ('meta_supertype_member', 'meta', NULL);

INSERT INTO meta_stage VALUES
  ('discovery', 1, 'Discovery', 'The business outcomes the product exists to achieve, each a measurable statement with its measure and target, which its capabilities serve.'),
  ('domain-model', 2, 'Domain model', 'Domains and their aggregates, entities, value objects, rules (constraints, invariants, specifications and policies), events, commands, read models, queries, domain services and glossary terms.'),
  ('use-cases', 3, 'Use cases', 'Capabilities, the use cases in them with their actors and UC requirements, and the patterns use cases and domains follow.'),
  ('interaction-design', 4, 'Interaction design', 'The product''s interfaces, each use case''s flows (one per interface it happens through) and their steps, and the views, endpoints and integrations the steps reach, with their requirements.'),
  ('technical-specification', 5, 'Technical specification', 'The technical record that implements each design record, such as a command''s handler or an entity''s table, and the standards code meets.'),
  ('test-plan', 6, 'Test plan', 'The tests, one kind per thing tested, each proving exactly its parent, and the test data sets they start from.');
