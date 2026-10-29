-- The domain model: domains, aggregates, entities, value objects and the fields of each, the four kinds of rule
-- (constraint, invariant, specification, policy), domain events, commands, read models, queries, domain services and
-- glossary terms. Each record has exactly one parent, except value objects and specifications, which have no owner.

CREATE TYPE subdomain_type AS ENUM ('core', 'supporting', 'generic');
-- The basic types a field may have, in place of a value object or a reference to an aggregate.
CREATE TYPE basic_type AS ENUM ('text', 'whole number', 'decimal', 'date', 'time', 'date and time', 'yes/no');
CREATE TYPE entity_role AS ENUM ('root', 'child');

CREATE TABLE domain (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  product_id VARCHAR NOT NULL REFERENCES product (id),
  subdomain_type subdomain_type NOT NULL,
  description VARCHAR NOT NULL CHECK (trim(description) <> ''),
  notes VARCHAR
);
COMMENT ON TABLE domain IS 'A part of the product with its own model, language and owner, for one business capability: what DDD calls a bounded context. Domains meet only through published events.';
COMMENT ON COLUMN domain.id IS 'The domain''s ID: the product prefix and the domain code, such as TL-LEND.';
COMMENT ON COLUMN domain.title IS 'The domain''s name, such as Lending.';
COMMENT ON COLUMN domain.product_id IS 'The product it belongs to.';
COMMENT ON COLUMN domain.subdomain_type IS 'core: the product''s edge; supporting: needed for the core but not its edge; generic: solved the same way everywhere. It guides how much modeling the domain deserves.';
COMMENT ON COLUMN domain.description IS 'What the domain covers, in a paragraph.';
COMMENT ON COLUMN domain.notes IS 'Longer notes on the domain.';

CREATE TABLE aggregate (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  domain_id VARCHAR NOT NULL REFERENCES domain (id),
  description VARCHAR NOT NULL CHECK (trim(description) <> ''),
  identity VARCHAR NOT NULL CHECK (trim(identity) <> ''),
  notes VARCHAR
);
COMMENT ON TABLE aggregate IS 'The consistency boundary: a cluster of entities changed together as one unit, by one command at a time. Other aggregates follow its changes through events, and refer to it by ID only.';
COMMENT ON COLUMN aggregate.id IS 'The aggregate''s ID, such as TL-LEND-A1.';
COMMENT ON COLUMN aggregate.title IS 'The aggregate''s name, such as Loan.';
COMMENT ON COLUMN aggregate.domain_id IS 'The domain it belongs to.';
COMMENT ON COLUMN aggregate.description IS 'What the aggregate keeps and why its entities change together, in a paragraph.';
COMMENT ON COLUMN aggregate.identity IS 'What identifies one of its records in the business, such as Loan ID.';
COMMENT ON COLUMN aggregate.notes IS 'Longer notes on the aggregate.';

CREATE TABLE entity (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  aggregate_id VARCHAR NOT NULL REFERENCES aggregate (id),
  role entity_role NOT NULL,
  in_root_table BOOLEAN CHECK (in_root_table),
  description VARCHAR NOT NULL CHECK (trim(description) <> ''),
  CHECK (in_root_table IS NULL OR role = 'child')
);
COMMENT ON TABLE entity IS 'A record the domain keeps, with an identity: its aggregate''s root or one of its children. Its fields are entity_field rows; the value objects it has are the ones its fields are typed with.';
COMMENT ON COLUMN entity.id IS 'The entity''s ID, such as TL-LEND-EN01.';
COMMENT ON COLUMN entity.title IS 'The entity''s name, such as Return.';
COMMENT ON COLUMN entity.aggregate_id IS 'The aggregate it belongs to.';
COMMENT ON COLUMN entity.role IS 'root: the record the aggregate is named for, at most one per aggregate; child: one of its parts.';
COMMENT ON COLUMN entity.in_root_table IS 'true: a child entity with no table of its own, stored in its aggregate root''s table (which then holds its fields as columns); left out otherwise. An entity has at most one table.';
COMMENT ON COLUMN entity.description IS 'What the entity is, in a sentence or two.';

CREATE TABLE value_object (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  description VARCHAR NOT NULL CHECK (trim(description) <> '')
);
COMMENT ON TABLE value_object IS 'A value with no identity of its own, such as an email address or a money amount, defined by its fields and checked by its constraints when it is created. It has no owner: it exists because entities, events or read models use it as a field''s type, and its product follows from its ID.';
COMMENT ON COLUMN value_object.id IS 'The value object''s ID: the product prefix and VO<nn>, such as TL-VO01.';
COMMENT ON COLUMN value_object.title IS 'The value object''s name, such as Email address.';
COMMENT ON COLUMN value_object.description IS 'What the value is, in a sentence or two.';

CREATE TABLE "constraint" (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  value_object_id VARCHAR NOT NULL REFERENCES value_object (id),
  statement VARCHAR NOT NULL CHECK (trim(statement) <> '')
);
COMMENT ON TABLE "constraint" IS 'A value object''s own rule, checked when the value is created, such as an email address having one @.';
COMMENT ON COLUMN "constraint".id IS 'The constraint''s ID: its value object''s ID and C<nn>, such as TL-VO01-C01.';
COMMENT ON COLUMN "constraint".title IS 'The rule in a few words.';
COMMENT ON COLUMN "constraint".value_object_id IS 'The value object it belongs to.';
COMMENT ON COLUMN "constraint".statement IS 'The rule, stated with MUST, MUST NOT, SHOULD or MAY.';

CREATE TABLE invariant (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  aggregate_id VARCHAR NOT NULL REFERENCES aggregate (id),
  statement VARCHAR NOT NULL CHECK (trim(statement) <> '')
);
COMMENT ON TABLE invariant IS 'A rule that holds for one aggregate on every change. Uniqueness across records (no two members share an email) is an invariant, enforced by a unique key of the table.';
COMMENT ON COLUMN invariant.id IS 'The invariant''s ID, such as TL-LEND-INV01.';
COMMENT ON COLUMN invariant.title IS 'The rule in a few words.';
COMMENT ON COLUMN invariant.aggregate_id IS 'The aggregate it holds for.';
COMMENT ON COLUMN invariant.statement IS 'The rule, stated with MUST, MUST NOT, SHOULD or MAY.';

CREATE TABLE specification (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  statement VARCHAR NOT NULL CHECK (trim(statement) <> '')
);
COMMENT ON TABLE specification IS 'A named predicate over one or more aggregates of one domain (Evans), such as Member in good standing. Commands check it before acting, and queries may select by it. It has no owner: it reads its aggregates, and its domain follows from its ID.';
COMMENT ON COLUMN specification.id IS 'The specification''s ID: its domain''s ID and SP<nn>, such as TL-LEND-SP01.';
COMMENT ON COLUMN specification.title IS 'The predicate''s name, such as Member in good standing.';
COMMENT ON COLUMN specification.statement IS 'When a record satisfies it, in a sentence.';

CREATE TABLE domain_event (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  aggregate_id VARCHAR NOT NULL REFERENCES aggregate (id),
  published BOOLEAN NOT NULL,
  description VARCHAR NOT NULL CHECK (trim(description) <> '')
);
COMMENT ON TABLE domain_event IS 'An unchangeable record that something happened to an aggregate, named in the past tense (Loan opened), raised by its commands. What it carries are event_field rows.';
COMMENT ON COLUMN domain_event.id IS 'The event''s ID, such as TL-LEND-EV01.';
COMMENT ON COLUMN domain_event.title IS 'The event''s name, in the past tense, such as Tool repaired.';
COMMENT ON COLUMN domain_event.aggregate_id IS 'The aggregate it happens to.';
COMMENT ON COLUMN domain_event.published IS 'true: its shape is a promise to other domains, whose policies may hear it; false: only its own domain hears it.';
COMMENT ON COLUMN domain_event.description IS 'What happened and what brings it about, in a sentence.';

CREATE TABLE command (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  aggregate_id VARCHAR NOT NULL REFERENCES aggregate (id),
  description VARCHAR NOT NULL CHECK (trim(description) <> '')
);
COMMENT ON TABLE command IS 'A request to change exactly one aggregate, its parent. It checks specifications, raises events and may call domain services, all of its own domain.';
COMMENT ON COLUMN command.id IS 'The command''s ID, such as TL-LEND-CMD01.';
COMMENT ON COLUMN command.title IS 'What it asks for, in the imperative, such as Open a loan.';
COMMENT ON COLUMN command.aggregate_id IS 'The aggregate it changes.';
COMMENT ON COLUMN command.description IS 'What it changes and when it is refused, in a sentence or two; how its handler does it belongs to the handler.';

CREATE TABLE command_change (
  command_id VARCHAR NOT NULL REFERENCES command (id),
  aggregate_id VARCHAR NOT NULL REFERENCES aggregate (id),
  reason VARCHAR NOT NULL CHECK (trim(reason) <> ''),
  PRIMARY KEY (command_id, aggregate_id)
);
COMMENT ON TABLE command_change IS 'A recorded exception to one aggregate per command: another aggregate of the same domain the command changes in the same transaction, and why. lathe check and the Checks page list every one under Recorded exceptions, always visible and never a warning.';
COMMENT ON COLUMN command_change.command_id IS 'The command that also changes the aggregate.';
COMMENT ON COLUMN command_change.aggregate_id IS 'The other aggregate it changes in the same transaction: of the command''s domain, never its own.';
COMMENT ON COLUMN command_change.reason IS 'Why the change cannot follow through an event and a policy.';

CREATE TABLE read_model (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  domain_id VARCHAR NOT NULL REFERENCES domain (id),
  description VARCHAR NOT NULL CHECK (trim(description) <> '')
);
COMMENT ON TABLE read_model IS 'A view of its domain''s data shaped for reading, which reads one or more of the domain''s aggregates. Its fields are read_model_field rows, and it is stored in a table of its own.';
COMMENT ON COLUMN read_model.id IS 'The read model''s ID, such as TL-LEND-RM01.';
COMMENT ON COLUMN read_model.title IS 'The read model''s name, such as Overdue loans.';
COMMENT ON COLUMN read_model.domain_id IS 'The domain it belongs to.';
COMMENT ON COLUMN read_model.description IS 'What it shows, in a sentence or two.';

CREATE TABLE query (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  read_model_id VARCHAR NOT NULL REFERENCES read_model (id),
  description VARCHAR NOT NULL CHECK (trim(description) <> '')
);
COMMENT ON TABLE query IS 'A question asked of one read model, its parent. It changes nothing, and may select by specifications and call domain services of its own domain.';
COMMENT ON COLUMN query.id IS 'The query''s ID: its read model''s domain''s ID and QRY<nn>, such as TL-LEND-QRY01.';
COMMENT ON COLUMN query.title IS 'What it asks, such as List a member''s loans.';
COMMENT ON COLUMN query.read_model_id IS 'The read model it reads.';
COMMENT ON COLUMN query.description IS 'What it returns, in a sentence or two; the code that answers it belongs to its handler.';

CREATE TABLE policy (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  command_id VARCHAR NOT NULL REFERENCES command (id),
  statement VARCHAR NOT NULL CHECK (trim(statement) <> '')
);
COMMENT ON TABLE policy IS 'Whenever an event, then a command (event storming). It belongs to the command it invokes and hears one event: its own domain''s, or another domain''s published one.';
COMMENT ON COLUMN policy.id IS 'The policy''s ID, such as TL-LEND-PO01.';
COMMENT ON COLUMN policy.title IS 'The reaction in a few words, such as Close loans of a retired tool.';
COMMENT ON COLUMN policy.command_id IS 'The command it invokes.';
COMMENT ON COLUMN policy.statement IS 'The reaction: whenever the event, then the command, stated with MUST, SHOULD or MAY.';

CREATE TABLE domain_service (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  domain_id VARCHAR NOT NULL REFERENCES domain (id),
  statement VARCHAR NOT NULL CHECK (trim(statement) <> '')
);
COMMENT ON TABLE domain_service IS 'Domain logic that belongs to no single entity and is not a yes-or-no check, such as calculating a late fee. Commands and queries of its domain call it; it uses no storage and no outside system.';
COMMENT ON COLUMN domain_service.id IS 'The domain service''s ID, such as TL-LEND-DS01.';
COMMENT ON COLUMN domain_service.title IS 'What it works out, such as Late fee.';
COMMENT ON COLUMN domain_service.domain_id IS 'The domain it belongs to.';
COMMENT ON COLUMN domain_service.statement IS 'What it must work out, from what, stated with MUST, SHOULD or MAY.';

CREATE TABLE term (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  domain_id VARCHAR NOT NULL REFERENCES domain (id),
  meaning VARCHAR NOT NULL CHECK (trim(meaning) <> ''),
  group_name VARCHAR
);
COMMENT ON TABLE term IS 'A word of the domain''s glossary and what it means there, so specs, code and conversation use one language.';
COMMENT ON COLUMN term.id IS 'The term''s ID, such as TL-LEND-TM01.';
COMMENT ON COLUMN term.title IS 'The term, such as Loan.';
COMMENT ON COLUMN term.domain_id IS 'The domain whose language it belongs to.';
COMMENT ON COLUMN term.meaning IS 'What it means in that domain.';
COMMENT ON COLUMN term.group_name IS 'A short heading it is shown under among its domain''s terms, such as Records or Writing.';

-- Fields. Entity, value object, event and read model fields share one shape: a field's type is exactly one of a basic
-- type, a value object, or a reference by ID to an aggregate (a reference to another domain's aggregate is allowed).
CREATE TABLE entity_field (
  entity_id VARCHAR NOT NULL REFERENCES entity (id),
  position INTEGER NOT NULL CHECK (position >= 1),
  name VARCHAR NOT NULL CHECK (trim(name) <> ''),
  meaning VARCHAR NOT NULL CHECK (trim(meaning) <> ''),
  type basic_type,
  type_value_object_id VARCHAR REFERENCES value_object (id),
  type_aggregate_id VARCHAR REFERENCES aggregate (id),
  required BOOLEAN NOT NULL,
  column_name VARCHAR,
  example VARCHAR,
  PRIMARY KEY (entity_id, position),
  UNIQUE (entity_id, name),
  CHECK ((type IS NOT NULL)::INTEGER + (type_value_object_id IS NOT NULL)::INTEGER + (type_aggregate_id IS NOT NULL)::INTEGER = 1)
);
COMMENT ON TABLE entity_field IS 'One field of an entity, in order. Its table''s columns follow from it.';
COMMENT ON COLUMN entity_field.entity_id IS 'The entity.';
COMMENT ON COLUMN entity_field.position IS 'The field''s place in the entity, from 1.';
COMMENT ON COLUMN entity_field.name IS 'The field''s name, such as Returned at: one name in its entity, compared trimmed and in any letter case.';
COMMENT ON COLUMN entity_field.meaning IS 'What the field means.';
COMMENT ON COLUMN entity_field.type IS 'Its basic type: text, whole number, decimal, date, time, date and time or yes/no; or none when a value object or an aggregate types it.';
COMMENT ON COLUMN entity_field.type_value_object_id IS 'The value object that is its type, if one.';
COMMENT ON COLUMN entity_field.type_aggregate_id IS 'The aggregate it refers to by ID, if one. A reference within the domain is a foreign key of the entity''s table; one to another domain stays a plain ID.';
COMMENT ON COLUMN entity_field.required IS 'true: every record gives it a value; false: it may be empty.';
COMMENT ON COLUMN entity_field.column_name IS 'Its column''s name in the table, when that differs from the field''s name, such as id for the field Member ID.';
COMMENT ON COLUMN entity_field.example IS 'An example value.';

CREATE TABLE value_object_field (
  value_object_id VARCHAR NOT NULL REFERENCES value_object (id),
  position INTEGER NOT NULL CHECK (position >= 1),
  name VARCHAR NOT NULL CHECK (trim(name) <> ''),
  meaning VARCHAR NOT NULL CHECK (trim(meaning) <> ''),
  type basic_type,
  type_value_object_id VARCHAR REFERENCES value_object (id),
  type_aggregate_id VARCHAR REFERENCES aggregate (id),
  required BOOLEAN NOT NULL,
  column_name VARCHAR,
  example VARCHAR,
  PRIMARY KEY (value_object_id, position),
  UNIQUE (value_object_id, name),
  CHECK ((type IS NOT NULL)::INTEGER + (type_value_object_id IS NOT NULL)::INTEGER + (type_aggregate_id IS NOT NULL)::INTEGER = 1),
  CHECK (type_value_object_id IS NULL OR type_value_object_id <> value_object_id)
);
COMMENT ON TABLE value_object_field IS 'One field of a value object, in order. A table flattens a value object''s fields into columns.';
COMMENT ON COLUMN value_object_field.value_object_id IS 'The value object.';
COMMENT ON COLUMN value_object_field.position IS 'The field''s place in the value object, from 1.';
COMMENT ON COLUMN value_object_field.name IS 'The field''s name, such as Amount: one name in its value object, compared trimmed and in any letter case.';
COMMENT ON COLUMN value_object_field.meaning IS 'What the field means.';
COMMENT ON COLUMN value_object_field.type IS 'Its basic type: text, whole number, decimal, date, time, date and time or yes/no; or none when a value object or an aggregate types it.';
COMMENT ON COLUMN value_object_field.type_value_object_id IS 'Another value object that is its type, if one.';
COMMENT ON COLUMN value_object_field.type_aggregate_id IS 'The aggregate it refers to by ID, if one.';
COMMENT ON COLUMN value_object_field.required IS 'true: every record gives it a value; false: it may be empty.';
COMMENT ON COLUMN value_object_field.column_name IS 'Its column''s name in the table, when that differs from the field''s name, such as id for the field Member ID.';
COMMENT ON COLUMN value_object_field.example IS 'An example value.';

CREATE TABLE event_field (
  domain_event_id VARCHAR NOT NULL REFERENCES domain_event (id),
  position INTEGER NOT NULL CHECK (position >= 1),
  name VARCHAR NOT NULL CHECK (trim(name) <> ''),
  meaning VARCHAR NOT NULL CHECK (trim(meaning) <> ''),
  type basic_type,
  type_value_object_id VARCHAR REFERENCES value_object (id),
  type_aggregate_id VARCHAR REFERENCES aggregate (id),
  required BOOLEAN NOT NULL,
  column_name VARCHAR,
  example VARCHAR,
  PRIMARY KEY (domain_event_id, position),
  UNIQUE (domain_event_id, name),
  CHECK ((type IS NOT NULL)::INTEGER + (type_value_object_id IS NOT NULL)::INTEGER + (type_aggregate_id IS NOT NULL)::INTEGER = 1)
);
COMMENT ON TABLE event_field IS 'One field a domain event carries, in order. A published event''s fields are a contract with other domains.';
COMMENT ON COLUMN event_field.domain_event_id IS 'The domain event.';
COMMENT ON COLUMN event_field.position IS 'The field''s place in the event, from 1.';
COMMENT ON COLUMN event_field.name IS 'The field''s name, such as Repaired at: one name in its event, compared trimmed and in any letter case.';
COMMENT ON COLUMN event_field.meaning IS 'What the field means.';
COMMENT ON COLUMN event_field.type IS 'Its basic type: text, whole number, decimal, date, time, date and time or yes/no; or none when a value object or an aggregate types it.';
COMMENT ON COLUMN event_field.type_value_object_id IS 'The value object that is its type, if one.';
COMMENT ON COLUMN event_field.type_aggregate_id IS 'The aggregate it refers to by ID, if one.';
COMMENT ON COLUMN event_field.required IS 'true: every record gives it a value; false: it may be empty.';
COMMENT ON COLUMN event_field.column_name IS 'Its column''s name in the table, when that differs from the field''s name, such as id for the field Member ID.';
COMMENT ON COLUMN event_field.example IS 'An example value.';

CREATE TABLE read_model_field (
  read_model_id VARCHAR NOT NULL REFERENCES read_model (id),
  position INTEGER NOT NULL CHECK (position >= 1),
  name VARCHAR NOT NULL CHECK (trim(name) <> ''),
  meaning VARCHAR NOT NULL CHECK (trim(meaning) <> ''),
  type basic_type,
  type_value_object_id VARCHAR REFERENCES value_object (id),
  type_aggregate_id VARCHAR REFERENCES aggregate (id),
  required BOOLEAN NOT NULL,
  column_name VARCHAR,
  example VARCHAR,
  PRIMARY KEY (read_model_id, position),
  UNIQUE (read_model_id, name),
  CHECK ((type IS NOT NULL)::INTEGER + (type_value_object_id IS NOT NULL)::INTEGER + (type_aggregate_id IS NOT NULL)::INTEGER = 1)
);
COMMENT ON TABLE read_model_field IS 'One field of a read model, in order. Its table''s columns follow from it.';
COMMENT ON COLUMN read_model_field.read_model_id IS 'The read model.';
COMMENT ON COLUMN read_model_field.position IS 'The field''s place in the read model, from 1.';
COMMENT ON COLUMN read_model_field.name IS 'The field''s name, such as Days overdue: one name in its read model, compared trimmed and in any letter case.';
COMMENT ON COLUMN read_model_field.meaning IS 'What the field means.';
COMMENT ON COLUMN read_model_field.type IS 'Its basic type: text, whole number, decimal, date, time, date and time or yes/no; or none when a value object or an aggregate types it.';
COMMENT ON COLUMN read_model_field.type_value_object_id IS 'The value object that is its type, if one.';
COMMENT ON COLUMN read_model_field.type_aggregate_id IS 'The aggregate it refers to by ID, if one.';
COMMENT ON COLUMN read_model_field.required IS 'true: every record gives it a value; false: it may be empty.';
COMMENT ON COLUMN read_model_field.column_name IS 'Its column''s name in the table, when that differs from the field''s name, such as id for the field Member ID.';
COMMENT ON COLUMN read_model_field.example IS 'An example value.';

-- A field's name is unique in its owner as people read it: trimmed and in any letter case.
CREATE UNIQUE INDEX entity_field_name_folded ON entity_field (entity_id, lower(trim(name)));
CREATE UNIQUE INDEX value_object_field_name_folded ON value_object_field (value_object_id, lower(trim(name)));
CREATE UNIQUE INDEX event_field_name_folded ON event_field (domain_event_id, lower(trim(name)));
CREATE UNIQUE INDEX read_model_field_name_folded ON read_model_field (read_model_id, lower(trim(name)));

INSERT INTO meta_kind VALUES
  ('domain', 'Domain', 'domain-model', 3, false, '<P>-<D>', 'TL-LEND', 'parent', NULL),
  ('aggregate', 'Aggregate', 'domain-model', 4, false, '<P>-<D>-A<n>', 'TL-LEND-A1', 'domain', NULL),
  ('entity', 'Entity', 'domain-model', 5, false, '<P>-<D>-EN<nn>', 'TL-LEND-EN01', 'domain', NULL),
  ('value_object', 'Value object', 'domain-model', 6, false, '<P>-VO<nn>', 'TL-VO01', 'product', NULL),
  ('constraint', 'Constraint', 'domain-model', 7, true, '<value object>-C<nn>', 'TL-VO01-C01', 'parent', NULL),
  ('invariant', 'Invariant', 'domain-model', 8, true, '<P>-<D>-INV<nn>', 'TL-LEND-INV01', 'domain', NULL),
  ('specification', 'Specification', 'domain-model', 9, true, '<P>-<D>-SP<nn>', 'TL-LEND-SP01', 'domain', NULL),
  ('domain_event', 'Domain event', 'domain-model', 10, false, '<P>-<D>-EV<nn>', 'TL-LEND-EV01', 'domain', NULL),
  ('command', 'Command', 'domain-model', 11, false, '<P>-<D>-CMD<nn>', 'TL-LEND-CMD01', 'domain', NULL),
  ('read_model', 'Read model', 'domain-model', 12, false, '<P>-<D>-RM<nn>', 'TL-LEND-RM01', 'domain', NULL),
  ('query', 'Query', 'domain-model', 13, false, '<P>-<D>-QRY<nn>', 'TL-LEND-QRY01', 'domain', NULL),
  ('policy', 'Policy', 'domain-model', 14, true, '<P>-<D>-PO<nn>', 'TL-LEND-PO01', 'domain', NULL),
  ('domain_service', 'Domain service', 'domain-model', 15, true, '<P>-<D>-DS<nn>', 'TL-LEND-DS01', 'domain', NULL),
  ('term', 'Term', 'domain-model', 16, false, '<P>-<D>-TM<nn>', 'TL-LEND-TM01', 'domain', NULL);
INSERT INTO meta_kind_parent VALUES
  ('domain', 'product', 1, 'product_id'),
  ('aggregate', 'domain', 1, 'domain_id'),
  ('entity', 'aggregate', 1, 'aggregate_id'),
  ('constraint', 'value_object', 1, 'value_object_id'),
  ('invariant', 'aggregate', 1, 'aggregate_id'),
  ('domain_event', 'aggregate', 1, 'aggregate_id'),
  ('command', 'aggregate', 1, 'aggregate_id'),
  ('read_model', 'domain', 1, 'domain_id'),
  ('query', 'read_model', 1, 'read_model_id'),
  ('policy', 'command', 1, 'command_id'),
  ('domain_service', 'domain', 1, 'domain_id'),
  ('term', 'domain', 1, 'domain_id');
INSERT INTO meta_table VALUES
  ('domain', 'kind', NULL), ('aggregate', 'kind', NULL), ('entity', 'kind', NULL), ('entity_field', 'part', 'entity_id'),
  ('value_object', 'kind', NULL), ('value_object_field', 'part', 'value_object_id'), ('constraint', 'kind', NULL),
  ('invariant', 'kind', NULL), ('specification', 'kind', NULL), ('domain_event', 'kind', NULL),
  ('event_field', 'part', 'domain_event_id'), ('command', 'kind', NULL), ('command_change', 'part', 'command_id'), ('read_model', 'kind', NULL),
  ('read_model_field', 'part', 'read_model_id'), ('query', 'kind', NULL), ('policy', 'kind', NULL),
  ('domain_service', 'kind', NULL), ('term', 'kind', NULL);
