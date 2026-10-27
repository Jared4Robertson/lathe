-- Domains and their domain model: aggregates, entities and their fields, domain events and their fields, and domain rules.

CREATE TABLE domain (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  product_id VARCHAR NOT NULL REFERENCES product (id),
  description VARCHAR,
  notes VARCHAR,
  UNIQUE (id, product_id)
);
COMMENT ON TABLE domain IS 'A part of the product with its own model, language and owner: one business capability, never a technology layer.';
COMMENT ON COLUMN domain.id IS 'The domain''s ID: the product prefix and the domain code, such as TL-LEND.';
COMMENT ON COLUMN domain.title IS 'The domain''s name, such as Lending.';
COMMENT ON COLUMN domain.product_id IS 'The product it belongs to.';
COMMENT ON COLUMN domain.description IS 'What the domain covers, in a paragraph.';
COMMENT ON COLUMN domain.notes IS 'Longer notes, such as its language or the example values it decides.';

CREATE TABLE aggregate (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  domain_id VARCHAR NOT NULL REFERENCES domain (id),
  description VARCHAR,
  identity VARCHAR,
  notes VARCHAR,
  UNIQUE (id, domain_id)
);
COMMENT ON TABLE aggregate IS 'A cluster of records changed together as one unit, with its own identity and rules.';
COMMENT ON COLUMN aggregate.id IS 'The aggregate''s ID, such as TL-LEND-A1.';
COMMENT ON COLUMN aggregate.title IS 'The aggregate''s name, such as Loan.';
COMMENT ON COLUMN aggregate.domain_id IS 'The domain it belongs to.';
COMMENT ON COLUMN aggregate.description IS 'What the aggregate keeps, in a paragraph.';
COMMENT ON COLUMN aggregate.identity IS 'What identifies one of its records in the business, such as Loan ID.';
COMMENT ON COLUMN aggregate.notes IS 'Longer notes on the aggregate.';

CREATE TYPE entity_role AS ENUM ('root', 'child');

CREATE TABLE entity (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  aggregate_id VARCHAR NOT NULL REFERENCES aggregate (id),
  role entity_role NOT NULL,
  description VARCHAR,
  UNIQUE (id, aggregate_id)
);
COMMENT ON TABLE entity IS 'A record the domain keeps, as one box of an aggregate''s ERD: the aggregate''s root or one of its children. Its fields are entity_field rows.';
COMMENT ON COLUMN entity.id IS 'The entity''s ID, such as TL-LEND-EN01.';
COMMENT ON COLUMN entity.title IS 'The entity''s name, such as Return.';
COMMENT ON COLUMN entity.aggregate_id IS 'The aggregate it belongs to.';
COMMENT ON COLUMN entity.role IS 'root: the record the aggregate is named for; child: one of its parts.';
COMMENT ON COLUMN entity.description IS 'What the entity is, in a sentence or two.';

CREATE TABLE entity_field (
  entity_id VARCHAR NOT NULL REFERENCES entity (id),
  position INTEGER NOT NULL CHECK (position >= 1),
  name VARCHAR NOT NULL CHECK (trim(name) <> ''),
  meaning VARCHAR NOT NULL CHECK (trim(meaning) <> ''),
  type VARCHAR NOT NULL CHECK (trim(type) <> ''),
  example VARCHAR,
  PRIMARY KEY (entity_id, position),
  UNIQUE (entity_id, name)
);
COMMENT ON TABLE entity_field IS 'One field of an entity, in order.';
COMMENT ON COLUMN entity_field.entity_id IS 'The entity.';
COMMENT ON COLUMN entity_field.position IS 'The field''s place in the entity, from 1.';
COMMENT ON COLUMN entity_field.name IS 'The field''s name, such as Returned at.';
COMMENT ON COLUMN entity_field.meaning IS 'What the field means.';
COMMENT ON COLUMN entity_field.type IS 'The kind of value it holds, such as Date and time.';
COMMENT ON COLUMN entity_field.example IS 'An example value.';

CREATE TABLE domain_event (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  aggregate_id VARCHAR NOT NULL REFERENCES aggregate (id),
  description VARCHAR
);
COMMENT ON TABLE domain_event IS 'An unchangeable record that something happened in the domain, raised by its aggregate and named in the past tense (Loan opened). What it carries are event_field rows.';
COMMENT ON COLUMN domain_event.id IS 'The event''s ID, such as TL-LEND-EV01.';
COMMENT ON COLUMN domain_event.title IS 'The event''s name, in the past tense, such as Tool repaired.';
COMMENT ON COLUMN domain_event.aggregate_id IS 'The aggregate that raises it.';
COMMENT ON COLUMN domain_event.description IS 'What happened, in a sentence.';

CREATE TABLE event_field (
  domain_event_id VARCHAR NOT NULL REFERENCES domain_event (id),
  position INTEGER NOT NULL CHECK (position >= 1),
  name VARCHAR NOT NULL CHECK (trim(name) <> ''),
  meaning VARCHAR NOT NULL CHECK (trim(meaning) <> ''),
  type VARCHAR NOT NULL CHECK (trim(type) <> ''),
  example VARCHAR,
  PRIMARY KEY (domain_event_id, position),
  UNIQUE (domain_event_id, name)
);
COMMENT ON TABLE event_field IS 'One field a domain event carries, in order.';
COMMENT ON COLUMN event_field.domain_event_id IS 'The domain event.';
COMMENT ON COLUMN event_field.position IS 'The field''s place in the event, from 1.';
COMMENT ON COLUMN event_field.name IS 'The field''s name, such as Repaired at.';
COMMENT ON COLUMN event_field.meaning IS 'What the field means.';
COMMENT ON COLUMN event_field.type IS 'The kind of value it holds.';
COMMENT ON COLUMN event_field.example IS 'An example value.';

CREATE TABLE domain_rule (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  domain_id VARCHAR NOT NULL REFERENCES domain (id),
  aggregate_id VARCHAR,
  entity_id VARCHAR,
  statement VARCHAR NOT NULL CHECK (trim(statement) <> ''),
  FOREIGN KEY (aggregate_id, domain_id) REFERENCES aggregate (id, domain_id),
  FOREIGN KEY (entity_id, aggregate_id) REFERENCES entity (id, aggregate_id),
  CHECK (entity_id IS NULL OR aggregate_id IS NOT NULL)
);
COMMENT ON TABLE domain_rule IS 'A fact that must always hold for an aggregate''s records, whatever use case changes them. It names its domain, and its aggregate unless it holds across aggregates, when it names them with involves.';
COMMENT ON COLUMN domain_rule.id IS 'The rule''s ID, such as TL-LEND-DR01.';
COMMENT ON COLUMN domain_rule.title IS 'The rule in a few words.';
COMMENT ON COLUMN domain_rule.domain_id IS 'The domain it belongs to.';
COMMENT ON COLUMN domain_rule.aggregate_id IS 'The aggregate it holds for, of the same domain; none for a rule across aggregates.';
COMMENT ON COLUMN domain_rule.entity_id IS 'The entity of that aggregate it is about, if one.';
COMMENT ON COLUMN domain_rule.statement IS 'The rule, stated with MUST, MUST NOT, SHOULD or MAY.';

INSERT INTO meta_kind VALUES
  ('domain', 'Domain', NULL, NULL, 'none', '<P>-<D>', 'TL-LEND', NULL),
  ('aggregate', 'Aggregate', 'define', 'domain-model', 'none', '<P>-<D>-A<n>', 'TL-LEND-A1', NULL),
  ('entity', 'Entity', 'define', 'domain-model', 'none', '<P>-<D>-EN<nn>', 'TL-LEND-EN01', NULL),
  ('domain_event', 'Domain event', 'define', 'domain-model', 'none', '<P>-<D>-EV<nn>', 'TL-LEND-EV01', NULL),
  ('domain_rule', 'Domain rule', 'define', 'domain-model', 'full', '<P>-<D>-DR<nn>', 'TL-LEND-DR01', NULL);
INSERT INTO meta_kind_parent VALUES
  ('domain', 'product', 1, 'product_id'),
  ('aggregate', 'domain', 1, 'domain_id'),
  ('entity', 'aggregate', 1, 'aggregate_id'),
  ('domain_event', 'aggregate', 1, 'aggregate_id'),
  ('domain_rule', 'entity', 1, 'entity_id'), ('domain_rule', 'aggregate', 2, 'aggregate_id'), ('domain_rule', 'domain', 3, 'domain_id');
INSERT INTO meta_table VALUES
  ('domain', 'kind', NULL), ('aggregate', 'kind', NULL), ('entity', 'kind', NULL), ('entity_field', 'part', 'entity_id'),
  ('domain_event', 'kind', NULL), ('event_field', 'part', 'domain_event_id'), ('domain_rule', 'kind', NULL);
