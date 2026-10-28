-- The technical specification: one concrete kind implements each design kind, in place of generic components and
-- layers. The domain layer (data models, value types, predicates, event types, services) stays apart from the
-- application layer (command, query and event handlers, and projections), which alone reads and writes storage. Then
-- standards and their rules, which technical records meet.

CREATE TABLE repository (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  aggregate_id VARCHAR NOT NULL UNIQUE REFERENCES aggregate (id),
  file VARCHAR,
  description VARCHAR
);
COMMENT ON TABLE repository IS 'Loads and saves its aggregate, whole: the way command handlers reach the aggregate''s storage.';
COMMENT ON COLUMN repository.id IS 'The repository''s ID: its aggregate''s ID and REPO, such as TL-LEND-A1-REPO.';
COMMENT ON COLUMN repository.title IS 'Its name in code, such as LoanRepository.';
COMMENT ON COLUMN repository.aggregate_id IS 'The aggregate it loads and saves; one repository each.';
COMMENT ON COLUMN repository.file IS 'The file that holds its code, from the product root; it may not exist yet, and several records may share one file.';
COMMENT ON COLUMN repository.description IS 'How it works, in a sentence or two.';

CREATE TABLE data_model (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  entity_id VARCHAR NOT NULL UNIQUE REFERENCES entity (id),
  file VARCHAR,
  description VARCHAR
);
COMMENT ON TABLE data_model IS 'Its entity in code: the entity''s data, behavior and mapping to its table. A command is carried out by its handler and its aggregate root''s data model.';
COMMENT ON COLUMN data_model.id IS 'The data model''s ID: its entity''s ID and DM, such as TL-LEND-EN01-DM.';
COMMENT ON COLUMN data_model.title IS 'Its name in code, such as Loan.';
COMMENT ON COLUMN data_model.entity_id IS 'The entity it implements; one data model each.';
COMMENT ON COLUMN data_model.file IS 'The file that holds its code, from the product root; it may not exist yet, and several records may share one file.';
COMMENT ON COLUMN data_model.description IS 'How it works, in a sentence or two.';

CREATE TABLE value_type (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  value_object_id VARCHAR NOT NULL UNIQUE REFERENCES value_object (id),
  file VARCHAR,
  description VARCHAR
);
COMMENT ON TABLE value_type IS 'Its value object in code, which checks the value object''s constraints when a value is created.';
COMMENT ON COLUMN value_type.id IS 'The value type''s ID: its value object''s ID and VT, such as TL-VO01-VT.';
COMMENT ON COLUMN value_type.title IS 'Its name in code, such as EmailAddress.';
COMMENT ON COLUMN value_type.value_object_id IS 'The value object it implements; one value type each.';
COMMENT ON COLUMN value_type.file IS 'The file that holds its code, from the product root; it may not exist yet, and several records may share one file.';
COMMENT ON COLUMN value_type.description IS 'How it works, in a sentence or two.';

CREATE TABLE predicate (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  specification_id VARCHAR NOT NULL UNIQUE REFERENCES specification (id),
  file VARCHAR,
  description VARCHAR
);
COMMENT ON TABLE predicate IS 'Its specification in code: a yes-or-no test over the records it is given.';
COMMENT ON COLUMN predicate.id IS 'The predicate''s ID: its specification''s ID and PR, such as TL-LEND-SP01-PR.';
COMMENT ON COLUMN predicate.title IS 'Its name in code, such as isInGoodStanding.';
COMMENT ON COLUMN predicate.specification_id IS 'The specification it implements; one predicate each.';
COMMENT ON COLUMN predicate.file IS 'The file that holds its code, from the product root; it may not exist yet, and several records may share one file.';
COMMENT ON COLUMN predicate.description IS 'How it works, in a sentence or two.';

CREATE TYPE event_delivery AS ENUM ('in process', 'outbox');

CREATE TABLE event_type (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  domain_event_id VARCHAR NOT NULL UNIQUE REFERENCES domain_event (id),
  delivery event_delivery,
  file VARCHAR,
  description VARCHAR
);
COMMENT ON TABLE event_type IS 'Its domain event''s shape in code; a contract with other domains when the event is published.';
COMMENT ON COLUMN event_type.id IS 'The event type''s ID: its domain event''s ID and ET, such as TL-LEND-EV01-ET.';
COMMENT ON COLUMN event_type.title IS 'Its name in code, such as LoanOpened.';
COMMENT ON COLUMN event_type.domain_event_id IS 'The domain event it implements; one event type each.';
COMMENT ON COLUMN event_type.delivery IS 'How the event reaches what hears it: in process, after the transaction commits; or outbox, saved in the same transaction as its aggregate and delivered reliably afterwards. An event a policy hears is delivered by outbox, since a lost reaction is a lost change; one that only keeps read models current (fed_by), where those read models are rebuilt from the data on every load, may be delivered in process.';
COMMENT ON COLUMN event_type.file IS 'The file that holds its code, from the product root; it may not exist yet, and several records may share one file.';
COMMENT ON COLUMN event_type.description IS 'How it works, in a sentence or two.';

CREATE TABLE projection (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  read_model_id VARCHAR NOT NULL UNIQUE REFERENCES read_model (id),
  file VARCHAR,
  description VARCHAR
);
COMMENT ON TABLE projection IS 'Fills its read model''s table and keeps it current, from events or as a view''s query. It writes only its own read model''s table.';
COMMENT ON COLUMN projection.id IS 'The projection''s ID: its read model''s ID and PJ, such as TL-LEND-RM01-PJ.';
COMMENT ON COLUMN projection.title IS 'Its name in code, such as overdueLoans.';
COMMENT ON COLUMN projection.read_model_id IS 'The read model it fills; one projection each.';
COMMENT ON COLUMN projection.file IS 'The file that holds its code, from the product root; it may not exist yet, and several records may share one file.';
COMMENT ON COLUMN projection.description IS 'How it works, in a sentence or two.';

CREATE TABLE command_handler (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  command_id VARCHAR NOT NULL UNIQUE REFERENCES command (id),
  file VARCHAR,
  description VARCHAR
);
COMMENT ON TABLE command_handler IS 'Carries out its command: an application service that owns the transaction, loads the aggregate through its repository, checks specifications and raises events. What clean architecture calls a use case or interactor.';
COMMENT ON COLUMN command_handler.id IS 'The command handler''s ID: its command''s ID and H, such as TL-LEND-CMD01-H.';
COMMENT ON COLUMN command_handler.title IS 'Its name in code, such as openLoan.';
COMMENT ON COLUMN command_handler.command_id IS 'The command it handles; one command handler each.';
COMMENT ON COLUMN command_handler.file IS 'The file that holds its code, from the product root; it may not exist yet, and several records may share one file.';
COMMENT ON COLUMN command_handler.description IS 'How it works, in a sentence or two.';

CREATE TABLE query_handler (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  query_id VARCHAR NOT NULL UNIQUE REFERENCES query (id),
  file VARCHAR,
  description VARCHAR
);
COMMENT ON TABLE query_handler IS 'Answers its query from its read model''s table: an application service that changes nothing.';
COMMENT ON COLUMN query_handler.id IS 'The query handler''s ID: its query''s ID and H, such as TL-LEND-QRY01-H.';
COMMENT ON COLUMN query_handler.title IS 'Its name in code, such as listLoans.';
COMMENT ON COLUMN query_handler.query_id IS 'The query it answers; one query handler each.';
COMMENT ON COLUMN query_handler.file IS 'The file that holds its code, from the product root; it may not exist yet, and several records may share one file.';
COMMENT ON COLUMN query_handler.description IS 'How it works, in a sentence or two.';

CREATE TABLE event_handler (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  policy_id VARCHAR NOT NULL UNIQUE REFERENCES policy (id),
  file VARCHAR,
  description VARCHAR
);
COMMENT ON TABLE event_handler IS 'Carries out its policy: hears the policy''s event and sends its command.';
COMMENT ON COLUMN event_handler.id IS 'The event handler''s ID: its policy''s ID and H, such as TL-LEND-PO01-H.';
COMMENT ON COLUMN event_handler.title IS 'Its name in code, such as onToolRetired.';
COMMENT ON COLUMN event_handler.policy_id IS 'The policy it carries out; one event handler each.';
COMMENT ON COLUMN event_handler.file IS 'The file that holds its code, from the product root; it may not exist yet, and several records may share one file.';
COMMENT ON COLUMN event_handler.description IS 'How it works, in a sentence or two.';

CREATE TABLE service (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  domain_service_id VARCHAR NOT NULL UNIQUE REFERENCES domain_service (id),
  file VARCHAR,
  description VARCHAR
);
COMMENT ON TABLE service IS 'Its domain service in code. It never uses a repository or an outside system: its inputs are passed in, and it returns a value or a decision.';
COMMENT ON COLUMN service.id IS 'The service''s ID: its domain service''s ID and SV, such as TL-LEND-DS01-SV.';
COMMENT ON COLUMN service.title IS 'Its name in code, such as lateFee.';
COMMENT ON COLUMN service.domain_service_id IS 'The domain service it implements; one service each.';
COMMENT ON COLUMN service.file IS 'The file that holds its code, from the product root; it may not exist yet, and several records may share one file.';
COMMENT ON COLUMN service.description IS 'How it works, in a sentence or two.';

CREATE TABLE endpoint_handler (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  endpoint_id VARCHAR NOT NULL UNIQUE REFERENCES endpoint (id),
  file VARCHAR,
  description VARCHAR
);
COMMENT ON TABLE endpoint_handler IS 'Serves its endpoint: reads the request, calls the command or query handler and writes the response.';
COMMENT ON COLUMN endpoint_handler.id IS 'The endpoint handler''s ID: its endpoint''s ID and H, such as TL-LEND-EP01-H.';
COMMENT ON COLUMN endpoint_handler.title IS 'Its name in code, such as postLoan.';
COMMENT ON COLUMN endpoint_handler.endpoint_id IS 'The endpoint it serves; one endpoint handler each.';
COMMENT ON COLUMN endpoint_handler.file IS 'The file that holds its code, from the product root; it may not exist yet, and several records may share one file.';
COMMENT ON COLUMN endpoint_handler.description IS 'How it works, in a sentence or two.';

CREATE TABLE adapter (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  integration_id VARCHAR NOT NULL UNIQUE REFERENCES integration (id),
  file VARCHAR,
  description VARCHAR
);
COMMENT ON TABLE adapter IS 'Talks to its integration''s outside system, so the rest of the code does not.';
COMMENT ON COLUMN adapter.id IS 'The adapter''s ID: its integration''s ID and AD, such as TL-INT01-AD.';
COMMENT ON COLUMN adapter.title IS 'Its name in code, such as mailer.';
COMMENT ON COLUMN adapter.integration_id IS 'The integration it talks to; one adapter each.';
COMMENT ON COLUMN adapter.file IS 'The file that holds its code, from the product root; it may not exist yet, and several records may share one file.';
COMMENT ON COLUMN adapter.description IS 'How it works, in a sentence or two.';

CREATE TYPE table_storage AS ENUM ('table', 'view', 'materialized view', 'browser storage', 'in memory');
CREATE TYPE key_type AS ENUM ('primary', 'unique', 'foreign', 'index');

CREATE TABLE "table" (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  entity_id VARCHAR UNIQUE REFERENCES entity (id),
  read_model_id VARCHAR UNIQUE REFERENCES read_model (id),
  domain_id VARCHAR REFERENCES domain (id),
  name VARCHAR NOT NULL CHECK (trim(name) <> ''),
  storage table_storage NOT NULL,
  file VARCHAR,
  description VARCHAR,
  CHECK ((entity_id IS NOT NULL)::INTEGER + (read_model_id IS NOT NULL)::INTEGER + (domain_id IS NOT NULL)::INTEGER = 1),
  CHECK (domain_id IS NULL OR storage = 'table'),
  CHECK (entity_id IS NULL OR storage IN ('table', 'browser storage'))
);
COMMENT ON TABLE "table" IS 'Where an entity or a read model, its parent, is stored, in a database or not; or, under a domain, a table of the domain''s own infrastructure that implements no design record, such as its outbox. Its columns follow from its parent''s fields, a value object''s fields flattened into columns, so it stores only what fields cannot say: its keys and indexes (table_key rows). An entity''s table is a table, normalized and the source of truth, or the browser storage that holds it; a read model''s is a projection that can be rebuilt, usually a view over its domain''s entity tables, or computed in memory on each load.';
COMMENT ON COLUMN "table".id IS 'The table''s ID: its entity''s or read model''s ID and TB, such as TL-LEND-EN01-TB.';
COMMENT ON COLUMN "table".title IS 'The table as people read it, such as Loans.';
COMMENT ON COLUMN "table".entity_id IS 'The entity it stores; exactly one of entity, read model and domain is given. An entity has at most one table: a child entity marked in_root_table has none and is stored in its root''s.';
COMMENT ON COLUMN "table".read_model_id IS 'The read model it stores; exactly one of entity, read model and domain is given, and a read model has one table.';
COMMENT ON COLUMN "table".domain_id IS 'The domain whose own infrastructure it stores, such as its outbox, when it stores no entity or read model; its ID is the domain''s and TB with a number, such as TL-LEND-TB01, and its storage is a table.';
COMMENT ON COLUMN "table".name IS 'Its name where it is stored: in the database, such as loans, or the key it is kept under in browser storage, such as lathe:tabs.';
COMMENT ON COLUMN "table".storage IS 'table: rows of its own in a database; view: a query over other tables; materialized view: a query''s result, kept; browser storage: kept in the browser (local or session storage), under the key its name gives; in memory: computed on each load and kept only while the program runs. An entity''s table is a table or browser storage. Keys are asked only of a table in a database: browser storage and in memory have none.';
COMMENT ON COLUMN "table".file IS 'The file that creates it, such as a migration, or that reads and writes it, from the product root; it may not exist yet.';
COMMENT ON COLUMN "table".description IS 'Anything its keys do not say, in a sentence or two.';

CREATE TABLE table_key (
  table_id VARCHAR NOT NULL REFERENCES "table" (id),
  position INTEGER NOT NULL CHECK (position >= 1),
  type key_type NOT NULL,
  columns VARCHAR[] NOT NULL CHECK (len(columns) >= 1),
  name VARCHAR,
  invariant_id VARCHAR REFERENCES invariant (id),
  target_table_id VARCHAR REFERENCES "table" (id),
  condition VARCHAR,
  PRIMARY KEY (table_id, position),
  CHECK (invariant_id IS NULL OR type = 'unique'),
  CHECK (condition IS NULL OR type = 'unique'),
  CHECK ((type = 'foreign') = (target_table_id IS NOT NULL))
);
COMMENT ON TABLE table_key IS 'One key or index of a table in a database (never of browser storage or in memory), in order: its primary key, a unique key with the invariant it enforces, a foreign key with the table it points at, or an index. A foreign key points at a table of the same domain: a reference to another domain''s aggregate stays a plain ID.';
COMMENT ON COLUMN table_key.table_id IS 'The table.';
COMMENT ON COLUMN table_key.position IS 'The key''s place among the table''s keys, from 1.';
COMMENT ON COLUMN table_key.type IS 'primary (at most one per table), unique, foreign or index.';
COMMENT ON COLUMN table_key.columns IS 'Its columns, in order, by their names in the database.';
COMMENT ON COLUMN table_key.name IS 'Its name in the database, if it has one.';
COMMENT ON COLUMN table_key.invariant_id IS 'For a unique key, the invariant it enforces, such as no two members sharing an email.';
COMMENT ON COLUMN table_key.condition IS 'For a partial unique key, the rows it holds for, such as returned_at IS NULL for one active loan per tool; only a unique key has one.';
COMMENT ON COLUMN table_key.target_table_id IS 'For a foreign key, the table it points at, of the same domain; required for a foreign key and only for one.';

CREATE TABLE ui_component (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  file VARCHAR,
  description VARCHAR
);
COMMENT ON TABLE ui_component IS 'A piece of the user interface that renders one or more views. It has no owner: it exists because views use it, and its product follows from its ID.';
COMMENT ON COLUMN ui_component.id IS 'The UI component''s ID: the product prefix and UI<nn>, such as TL-UI01.';
COMMENT ON COLUMN ui_component.title IS 'Its name in code, such as CatalogPage.';
COMMENT ON COLUMN ui_component.file IS 'The file that holds its code, from the product root; it may not exist yet.';
COMMENT ON COLUMN ui_component.description IS 'What it renders, in a sentence or two.';

CREATE TABLE standard (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  product_id VARCHAR NOT NULL REFERENCES product (id),
  description VARCHAR
);
COMMENT ON TABLE standard IS 'A library of engineering rules that holds for the product''s code, such as logging, error handling or naming. What follows one of its rules meets it.';
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
COMMENT ON TABLE standard_rule IS 'One rule of a standard. Technical records that follow it link to it with meets; its standard rule tests prove it.';
COMMENT ON COLUMN standard_rule.id IS 'The rule''s ID: its standard''s ID and R<nn>, such as TL-STD-CODE-R01.';
COMMENT ON COLUMN standard_rule.title IS 'The rule in a few words.';
COMMENT ON COLUMN standard_rule.standard_id IS 'The standard it belongs to.';
COMMENT ON COLUMN standard_rule.statement IS 'The rule, stated with MUST, MUST NOT, SHOULD or MAY.';
COMMENT ON COLUMN standard_rule.group_name IS 'A short heading it is shown under among its siblings.';

INSERT INTO meta_kind VALUES
  ('repository', 'Repository', 'technical-specification', 28, false, '<aggregate>-REPO', 'TL-LEND-A1-REPO', 'parent', NULL),
  ('data_model', 'Data model', 'technical-specification', 29, false, '<entity>-DM', 'TL-LEND-EN01-DM', 'parent', NULL),
  ('value_type', 'Value type', 'technical-specification', 31, false, '<value object>-VT', 'TL-VO01-VT', 'parent', NULL),
  ('predicate', 'Predicate', 'technical-specification', 32, false, '<specification>-PR', 'TL-LEND-SP01-PR', 'parent', NULL),
  ('event_type', 'Event type', 'technical-specification', 33, false, '<domain event>-ET', 'TL-LEND-EV01-ET', 'parent', NULL),
  ('projection', 'Projection', 'technical-specification', 34, false, '<read model>-PJ', 'TL-LEND-RM01-PJ', 'parent', NULL),
  ('command_handler', 'Command handler', 'technical-specification', 35, false, '<command>-H', 'TL-LEND-CMD01-H', 'parent', NULL),
  ('query_handler', 'Query handler', 'technical-specification', 36, false, '<query>-H', 'TL-LEND-QRY01-H', 'parent', NULL),
  ('event_handler', 'Event handler', 'technical-specification', 37, false, '<policy>-H', 'TL-LEND-PO01-H', 'parent', NULL),
  ('service', 'Service', 'technical-specification', 38, false, '<domain service>-SV', 'TL-LEND-DS01-SV', 'parent', NULL),
  ('endpoint_handler', 'Endpoint handler', 'technical-specification', 40, false, '<endpoint>-H', 'TL-LEND-EP01-H', 'parent', NULL),
  ('adapter', 'Adapter', 'technical-specification', 41, false, '<integration>-AD', 'TL-INT01-AD', 'parent', NULL),
  ('table', 'Table', 'technical-specification', 30, false, '<entity or read model>-TB, or <domain>-TB<nn>', 'TL-LEND-EN01-TB', 'parent', NULL),
  ('ui_component', 'UI component', 'technical-specification', 39, false, '<P>-UI<nn>', 'TL-UI01', 'product', NULL),
  ('standard', 'Standard', 'technical-specification', 42, false, '<P>-STD-<name>', 'TL-STD-CODE', 'parent', NULL),
  ('standard_rule', 'Standard rule', 'technical-specification', 43, true, '<standard>-R<nn>', 'TL-STD-CODE-R01', 'parent', NULL);
INSERT INTO meta_kind_parent VALUES
  ('repository', 'aggregate', 1, 'aggregate_id'),
  ('data_model', 'entity', 1, 'entity_id'),
  ('value_type', 'value_object', 1, 'value_object_id'),
  ('predicate', 'specification', 1, 'specification_id'),
  ('event_type', 'domain_event', 1, 'domain_event_id'),
  ('projection', 'read_model', 1, 'read_model_id'),
  ('command_handler', 'command', 1, 'command_id'),
  ('query_handler', 'query', 1, 'query_id'),
  ('event_handler', 'policy', 1, 'policy_id'),
  ('service', 'domain_service', 1, 'domain_service_id'),
  ('endpoint_handler', 'endpoint', 1, 'endpoint_id'),
  ('adapter', 'integration', 1, 'integration_id'),
  ('table', 'entity', 1, 'entity_id'), ('table', 'read_model', 2, 'read_model_id'), ('table', 'domain', 3, 'domain_id'),
  ('standard', 'product', 1, 'product_id'),
  ('standard_rule', 'standard', 1, 'standard_id');
INSERT INTO meta_table VALUES
  ('repository', 'kind', NULL), ('data_model', 'kind', NULL), ('value_type', 'kind', NULL), ('predicate', 'kind', NULL), ('event_type', 'kind', NULL), ('projection', 'kind', NULL), ('command_handler', 'kind', NULL), ('query_handler', 'kind', NULL), ('event_handler', 'kind', NULL), ('service', 'kind', NULL), ('endpoint_handler', 'kind', NULL), ('adapter', 'kind', NULL),
  ('table', 'kind', NULL), ('table_key', 'part', 'table_id'), ('ui_component', 'kind', NULL), ('standard', 'kind', NULL), ('standard_rule', 'kind', NULL);
