-- The technical specification: one concrete kind implements each design kind, in place of generic components and
-- layers. The domain layer (data models, value types, predicates, event types, services) stays apart from the
-- application layer (command, query and event handlers, projections and readers), which alone reads and writes storage. Then
-- standards and their rules, which technical records meet.

-- The kinds of place data lives in.
CREATE TYPE data_store_kind AS ENUM ('database', 'object store', 'file folder', 'file', 'browser storage', 'memory');

CREATE TABLE data_store (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  product_id VARCHAR REFERENCES product (id),
  domain_id VARCHAR REFERENCES domain (id),
  kind data_store_kind NOT NULL,
  description VARCHAR NOT NULL CHECK (trim(description) <> ''),
  CHECK ((product_id IS NULL) <> (domain_id IS NULL))
);
COMMENT ON TABLE data_store IS 'Where data actually lives: a database, a bucket, a folder of files, browser storage or memory. Every repository, reader and table names the one it is stored in (stored_in). One that is a service someone else runs, which the user must provide, such as a managed database or a bucket, is reached through its integration (provided_by); one the product owns outright, such as a local file or browser storage, has none.';
COMMENT ON COLUMN data_store.id IS 'The data store''s ID: its product''s ID and STORE<nn>, or its domain''s ID and STORE<nn>, such as TL-STORE01.';
COMMENT ON COLUMN data_store.title IS 'Its name in code or config, such as DATABASE_URL, dataDir or localStorage.';
COMMENT ON COLUMN data_store.product_id IS 'The product it sits under, when several of its domains use it; exactly one of product and domain is given.';
COMMENT ON COLUMN data_store.domain_id IS 'The domain it sits under, when one domain alone uses it; exactly one of product and domain is given.';
COMMENT ON COLUMN data_store.kind IS 'database: a database server or file, such as PostgreSQL or SQLite; object store: a bucket of objects, such as S3; file folder: a folder of files the program reads and writes; file: one file the program reads and writes whole; browser storage: kept by the browser, such as local or session storage or its history; memory: kept only while the program runs, and rebuilt on each start.';
COMMENT ON COLUMN data_store.description IS 'Where it is and what keeps it there, in a sentence or two: its location, who runs it and how it is reached.';

CREATE TABLE repository (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  domain_id VARCHAR NOT NULL REFERENCES domain (id),
  file VARCHAR,
  description VARCHAR NOT NULL CHECK (trim(description) <> '')
);
COMMENT ON TABLE repository IS 'Loads and saves its aggregate, whole: the way command handlers reach the aggregate''s storage, in the one data store it names (stored_in). It persists exactly one aggregate, linked with persists, and sits under its domain, or, for one several domains share, under the domain that holds what they share.';
COMMENT ON COLUMN repository.id IS 'The repository''s ID: its domain''s ID and REPO<nn>, such as TL-LEND-REPO01.';
COMMENT ON COLUMN repository.title IS 'Its name in code, such as LoanRepository.';
COMMENT ON COLUMN repository.domain_id IS 'The domain it sits under: that of the aggregate it persists, or, for one several domains share, the domain that holds what they share.';
COMMENT ON COLUMN repository.file IS 'The file that holds its code, from the product root; it may not exist yet, and several records may share one file.';
COMMENT ON COLUMN repository.description IS 'How it keeps its aggregate: where, in what form, and when it loads and saves, in a sentence or two.';

CREATE TABLE data_model (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  entity_id VARCHAR NOT NULL UNIQUE REFERENCES entity (id),
  file VARCHAR
);
COMMENT ON TABLE data_model IS 'Its entity in code: the entity''s data, behavior and mapping to its table. A command is carried out by its handler and its aggregate root''s data model.';
COMMENT ON COLUMN data_model.id IS 'The data model''s ID: its entity''s ID and DM, such as TL-LEND-EN01-DM.';
COMMENT ON COLUMN data_model.title IS 'Its name in code, such as Loan.';
COMMENT ON COLUMN data_model.entity_id IS 'The entity it implements; one data model each.';
COMMENT ON COLUMN data_model.file IS 'The file that holds its code, from the product root; it may not exist yet, and several records may share one file.';

CREATE TABLE value_type (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  value_object_id VARCHAR NOT NULL UNIQUE REFERENCES value_object (id),
  file VARCHAR
);
COMMENT ON TABLE value_type IS 'Its value object in code, which checks the value object''s constraints when a value is created.';
COMMENT ON COLUMN value_type.id IS 'The value type''s ID: its value object''s ID and VT, such as TL-VO01-VT.';
COMMENT ON COLUMN value_type.title IS 'Its name in code, such as EmailAddress.';
COMMENT ON COLUMN value_type.value_object_id IS 'The value object it implements; one value type each.';
COMMENT ON COLUMN value_type.file IS 'The file that holds its code, from the product root; it may not exist yet, and several records may share one file.';

CREATE TABLE rule (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  invariant_id VARCHAR NOT NULL UNIQUE REFERENCES invariant (id),
  file VARCHAR
);
COMMENT ON TABLE rule IS 'Enforces its invariant: the rule in its aggregate''s code, run by the aggregate''s commands before saving, which refuses a change that would break it. Lathe''s own rules sit in each aggregate''s rules.ts and also run over all data on every load. An invariant is built only through its rule.';
COMMENT ON COLUMN rule.id IS 'The rule''s ID: its invariant''s ID and RL, such as TL-LEND-INV01-RL.';
COMMENT ON COLUMN rule.title IS 'Its name in code, the name its refusal carries, such as step-fulfills-own-use-case or email_taken. Two rules share a title only when they share a file: one function that enforces two invariants, each keeping its own rule.';
COMMENT ON COLUMN rule.invariant_id IS 'The invariant it enforces; one rule each.';
COMMENT ON COLUMN rule.file IS 'The file that holds its code, from the product root, such as its aggregate''s rules.ts; it may not exist yet, and several records may share one file.';

CREATE TABLE predicate (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  specification_id VARCHAR NOT NULL UNIQUE REFERENCES specification (id),
  file VARCHAR
);
COMMENT ON TABLE predicate IS 'Its specification in code: a yes-or-no test over the records it is given.';
COMMENT ON COLUMN predicate.id IS 'The predicate''s ID: its specification''s ID and PR, such as TL-LEND-SP01-PR.';
COMMENT ON COLUMN predicate.title IS 'Its name in code, such as isInGoodStanding.';
COMMENT ON COLUMN predicate.specification_id IS 'The specification it implements; one predicate each.';
COMMENT ON COLUMN predicate.file IS 'The file that holds its code, from the product root; it may not exist yet, and several records may share one file.';

CREATE TYPE event_delivery AS ENUM ('in process', 'outbox');

CREATE TABLE event_type (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  domain_event_id VARCHAR NOT NULL UNIQUE REFERENCES domain_event (id),
  delivery event_delivery,
  file VARCHAR
);
COMMENT ON TABLE event_type IS 'Its domain event''s shape in code; a contract with other domains when the event is published.';
COMMENT ON COLUMN event_type.id IS 'The event type''s ID: its domain event''s ID and ET, such as TL-LEND-EV01-ET.';
COMMENT ON COLUMN event_type.title IS 'Its name in code, such as LoanOpened.';
COMMENT ON COLUMN event_type.domain_event_id IS 'The domain event it implements; one event type each.';
COMMENT ON COLUMN event_type.delivery IS 'How the event reaches what hears it: in process, after the transaction commits; or outbox, saved in the same transaction as its aggregate and delivered reliably afterwards. An event a policy hears is delivered by outbox, since a lost reaction is a lost change; one that only keeps read models current (fed_by), where those read models are rebuilt from the data on every load, may be delivered in process.';
COMMENT ON COLUMN event_type.file IS 'The file that holds its code, from the product root; it may not exist yet, and several records may share one file.';

CREATE TABLE projection (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  read_model_id VARCHAR NOT NULL UNIQUE REFERENCES read_model (id),
  file VARCHAR,
  description VARCHAR NOT NULL CHECK (trim(description) <> '')
);
COMMENT ON TABLE projection IS 'Fills its read model''s table and keeps it current, from events or as a view''s query. It writes only its own read model''s table.';
COMMENT ON COLUMN projection.id IS 'The projection''s ID: its read model''s ID and PJ, such as TL-LEND-RM01-PJ.';
COMMENT ON COLUMN projection.title IS 'Its name in code, such as overdueLoans.';
COMMENT ON COLUMN projection.read_model_id IS 'The read model it fills; one projection each.';
COMMENT ON COLUMN projection.file IS 'The file that holds its code, from the product root; it may not exist yet, and several records may share one file.';
COMMENT ON COLUMN projection.description IS 'How it fills its read model and when it is rebuilt, in a sentence or two.';

CREATE TABLE reader (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  read_model_id VARCHAR NOT NULL UNIQUE REFERENCES read_model (id),
  file VARCHAR,
  description VARCHAR NOT NULL CHECK (trim(description) <> '')
);
COMMENT ON TABLE reader IS 'Reads its read model''s table for its query handlers: the way query handlers reach a read model''s storage, in the one data store it names (stored_in). It reads exactly one read model, its parent, and nothing else; a query handler reads only through its own read model''s reader, and the projection alone fills the table it reads.';
COMMENT ON COLUMN reader.id IS 'The reader''s ID: its read model''s ID and RD, such as TL-LEND-RM01-RD.';
COMMENT ON COLUMN reader.title IS 'Its name in code, such as OverdueLoansReader.';
COMMENT ON COLUMN reader.read_model_id IS 'The read model it reads; one reader each.';
COMMENT ON COLUMN reader.file IS 'The file that holds its code, from the product root; it may not exist yet, and several records may share one file.';
COMMENT ON COLUMN reader.description IS 'How it reads its read model''s table: where the table is kept and how a query handler is given the reader, in a sentence or two.';

CREATE TABLE command_handler (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  command_id VARCHAR NOT NULL UNIQUE REFERENCES command (id),
  file VARCHAR,
  description VARCHAR NOT NULL CHECK (trim(description) <> '')
);
COMMENT ON TABLE command_handler IS 'Carries out its command: an application service that owns the transaction, loads the aggregate through its repository, checks specifications and raises events. What clean architecture calls a use case or interactor.';
COMMENT ON COLUMN command_handler.id IS 'The command handler''s ID: its command''s ID and H, such as TL-LEND-CMD01-H.';
COMMENT ON COLUMN command_handler.title IS 'Its name in code, such as openLoan.';
COMMENT ON COLUMN command_handler.command_id IS 'The command it handles; one command handler each.';
COMMENT ON COLUMN command_handler.file IS 'The file that holds its code, from the product root; it may not exist yet, and several records may share one file.';
COMMENT ON COLUMN command_handler.description IS 'How it carries out its command (transaction, checks, what it writes), in a sentence or two; never what the command already says.';

CREATE TABLE query_handler (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  query_id VARCHAR NOT NULL UNIQUE REFERENCES query (id),
  file VARCHAR,
  description VARCHAR NOT NULL CHECK (trim(description) <> '')
);
COMMENT ON TABLE query_handler IS 'Answers its query from its read model''s table: an application service that changes nothing.';
COMMENT ON COLUMN query_handler.id IS 'The query handler''s ID: its query''s ID and H, such as TL-LEND-QRY01-H.';
COMMENT ON COLUMN query_handler.title IS 'Its name in code, such as listLoans.';
COMMENT ON COLUMN query_handler.query_id IS 'The query it answers; one query handler each.';
COMMENT ON COLUMN query_handler.file IS 'The file that holds its code, from the product root; it may not exist yet, and several records may share one file.';
COMMENT ON COLUMN query_handler.description IS 'How it answers its query (from what, kept or computed on each call), in a sentence or two.';

CREATE TABLE event_handler (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  policy_id VARCHAR NOT NULL UNIQUE REFERENCES policy (id),
  file VARCHAR,
  description VARCHAR NOT NULL CHECK (trim(description) <> '')
);
COMMENT ON TABLE event_handler IS 'Carries out its policy: hears the policy''s event and sends its command.';
COMMENT ON COLUMN event_handler.id IS 'The event handler''s ID: its policy''s ID and H, such as TL-LEND-PO01-H.';
COMMENT ON COLUMN event_handler.title IS 'Its name in code, such as onToolRetired.';
COMMENT ON COLUMN event_handler.policy_id IS 'The policy it carries out; one event handler each.';
COMMENT ON COLUMN event_handler.file IS 'The file that holds its code, from the product root; it may not exist yet, and several records may share one file.';
COMMENT ON COLUMN event_handler.description IS 'Where it hears its event and how it sends its command, in a sentence or two.';

CREATE TABLE service (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  domain_service_id VARCHAR NOT NULL UNIQUE REFERENCES domain_service (id),
  file VARCHAR
);
COMMENT ON TABLE service IS 'Its domain service in code. It never uses a repository or an outside system: its inputs are passed in, and it returns a value or a decision.';
COMMENT ON COLUMN service.id IS 'The service''s ID: its domain service''s ID and SV, such as TL-LEND-DS01-SV.';
COMMENT ON COLUMN service.title IS 'Its name in code, such as lateFee.';
COMMENT ON COLUMN service.domain_service_id IS 'The domain service it implements; one service each.';
COMMENT ON COLUMN service.file IS 'The file that holds its code, from the product root; it may not exist yet, and several records may share one file.';

CREATE TABLE endpoint_handler (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  endpoint_id VARCHAR NOT NULL UNIQUE REFERENCES endpoint (id),
  file VARCHAR,
  description VARCHAR NOT NULL CHECK (trim(description) <> '')
);
COMMENT ON TABLE endpoint_handler IS 'Serves its endpoint: reads the request, calls the command or query handler and writes the response.';
COMMENT ON COLUMN endpoint_handler.id IS 'The endpoint handler''s ID: its endpoint''s ID and H, such as TL-LEND-EP01-H.';
COMMENT ON COLUMN endpoint_handler.title IS 'Its name in code, such as postLoan.';
COMMENT ON COLUMN endpoint_handler.endpoint_id IS 'The endpoint it serves; one endpoint handler each.';
COMMENT ON COLUMN endpoint_handler.file IS 'The file that holds its code, from the product root; it may not exist yet, and several records may share one file.';
COMMENT ON COLUMN endpoint_handler.description IS 'How it reads the request, calls its handler and answers or refuses, in a sentence or two; the request and response shapes belong to the endpoint.';

CREATE TABLE adapter (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  integration_id VARCHAR NOT NULL UNIQUE REFERENCES integration (id),
  file VARCHAR,
  description VARCHAR NOT NULL CHECK (trim(description) <> '')
);
COMMENT ON TABLE adapter IS 'Talks to its integration''s outside system, so the rest of the code does not.';
COMMENT ON COLUMN adapter.id IS 'The adapter''s ID: its integration''s ID and AD, such as TL-INT01-AD.';
COMMENT ON COLUMN adapter.title IS 'Its name in code, such as mailer.';
COMMENT ON COLUMN adapter.integration_id IS 'The integration it talks to; one adapter each.';
COMMENT ON COLUMN adapter.file IS 'The file that holds its code, from the product root; it may not exist yet, and several records may share one file.';
COMMENT ON COLUMN adapter.description IS 'How it talks to its outside system, in a sentence or two.';

CREATE TYPE table_storage AS ENUM ('table', 'view', 'materialized view', 'browser storage', 'file', 'in memory');
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
  CHECK ((entity_id IS NOT NULL)::INTEGER + (read_model_id IS NOT NULL)::INTEGER + (domain_id IS NOT NULL)::INTEGER = 1),
  CHECK (domain_id IS NULL OR storage = 'table'),
  CHECK (entity_id IS NULL OR storage NOT IN ('view', 'materialized view'))
);
COMMENT ON TABLE "table" IS 'Where an entity or a read model, its parent, is stored, in a database or not; or, under a domain, a table of the domain''s own infrastructure that implements no design record, such as its outbox. It is kept in the one data store it names (stored_in). Its columns follow from its parent''s fields, a value object''s fields flattened into columns, so it stores only what fields cannot say: its keys and indexes (table_key rows). An entity''s table holds its rows, the source of truth: a table, normalized, or the browser storage, file or memory that keeps them; a read model''s is a projection that can be rebuilt, usually a view over its domain''s entity tables, or computed in memory on each load.';
COMMENT ON COLUMN "table".id IS 'The table''s ID: its entity''s or read model''s ID and TB, such as TL-LEND-EN01-TB.';
COMMENT ON COLUMN "table".title IS 'The table as people read it, such as Loans.';
COMMENT ON COLUMN "table".entity_id IS 'The entity it stores; exactly one of entity, read model and domain is given. An entity has at most one table: a child entity marked in_root_table has none and is stored in its root''s.';
COMMENT ON COLUMN "table".read_model_id IS 'The read model it stores; exactly one of entity, read model and domain is given, and a read model has one table.';
COMMENT ON COLUMN "table".domain_id IS 'The domain whose own infrastructure it stores, such as its outbox, when it stores no entity or read model; its ID is the domain''s and TB with a number, such as TL-LEND-TB01, and its storage is a table.';
COMMENT ON COLUMN "table".name IS 'Its name where it is stored: in the database, such as loans, the key it is kept under in browser storage, such as lathe:tabs, or the file''s name, such as window-state.json.';
COMMENT ON COLUMN "table".storage IS 'table: rows of its own in a database; view: a query over other tables; materialized view: a query''s result, kept; browser storage: kept by the browser (local or session storage, or its history), under the key its name gives; file: kept in a file of its own that the program reads and writes whole, such as a JSON file, named by its name; in memory: kept only while the program runs, or computed on each load. An entity''s table holds rows of its own, so it is never a view or a materialized view. Keys are asked only of a table in a database: browser storage, a file and in memory have none.';
COMMENT ON COLUMN "table".file IS 'The file that creates it, such as a migration, or that reads and writes it, from the product root; it may not exist yet.';

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
COMMENT ON TABLE table_key IS 'One key or index of a table in a database (never of browser storage, a file or in memory), in order: its primary key, a unique key with the invariant it enforces, a foreign key with the table it points at, or an index. A foreign key points at a table of the same domain: a reference to another domain''s aggregate stays a plain ID.';
COMMENT ON COLUMN table_key.table_id IS 'The table.';
COMMENT ON COLUMN table_key.position IS 'The key''s place among the table''s keys, from 1.';
COMMENT ON COLUMN table_key.type IS 'primary (at most one per table), unique, foreign or index.';
COMMENT ON COLUMN table_key.columns IS 'Its columns, in order, by their names in the database.';
COMMENT ON COLUMN table_key.name IS 'Its name in the database, if it has one.';
COMMENT ON COLUMN table_key.invariant_id IS 'For a unique key, the invariant it enforces, such as no two members sharing an email.';
COMMENT ON COLUMN table_key.condition IS 'For a partial unique key, the rows it holds for, such as returned_at IS NULL for one active loan per tool; only a unique key has one.';
COMMENT ON COLUMN table_key.target_table_id IS 'For a foreign key, the table it points at, of the same domain; required for a foreign key and only for one.';

CREATE TABLE entry_point (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  domain_id VARCHAR NOT NULL REFERENCES domain (id),
  file VARCHAR,
  description VARCHAR NOT NULL CHECK (trim(description) <> '')
);
COMMENT ON TABLE entry_point IS 'A start-up file: what runs first and wires the rest together, such as a server''s main file or a desktop app''s main process. No design record is implemented by it alone, so it sits under the domain it starts.';
COMMENT ON COLUMN entry_point.id IS 'The entry point''s ID: its domain''s ID and ENTRY<nn>, such as TL-LEND-ENTRY01.';
COMMENT ON COLUMN entry_point.title IS 'Its file''s name, or its name in code, such as server.ts.';
COMMENT ON COLUMN entry_point.domain_id IS 'The domain it starts.';
COMMENT ON COLUMN entry_point.file IS 'The start-up file, from the product root; it may not exist yet.';
COMMENT ON COLUMN entry_point.description IS 'What it does at start-up, in a sentence or two: what it reads, opens and serves.';

CREATE TABLE tooling (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  domain_id VARCHAR NOT NULL REFERENCES domain (id),
  file VARCHAR
);
COMMENT ON TABLE tooling IS 'A dev script or config file outside the running product: a build, a generator, a watcher, or a config of the tools it is checked and tested with, such as a type checker''s or a test runner''s. Its title and file say what it is.';
COMMENT ON COLUMN tooling.id IS 'The tooling record''s ID: its domain''s ID and TOOL<nn>, such as TL-LEND-TOOL01.';
COMMENT ON COLUMN tooling.title IS 'Its file''s name, such as vitest.config.ts.';
COMMENT ON COLUMN tooling.domain_id IS 'The domain whose code it builds, checks or tests.';
COMMENT ON COLUMN tooling.file IS 'The script or config file, or the folder of them, from the product root; it may not exist yet.';

CREATE TABLE ui_component (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  file VARCHAR,
  description VARCHAR NOT NULL CHECK (trim(description) <> '')
);
COMMENT ON TABLE ui_component IS 'A piece of the user interface that renders one or more views and builds the view requirements its code does (builds). It has no owner: it exists because views use it, and its product follows from its ID.';
COMMENT ON COLUMN ui_component.id IS 'The UI component''s ID: the product prefix and UI<nn>, such as TL-UI01.';
COMMENT ON COLUMN ui_component.title IS 'Its name in code, such as CatalogPage.';
COMMENT ON COLUMN ui_component.file IS 'The file that holds its code, from the product root; it may not exist yet.';
COMMENT ON COLUMN ui_component.description IS 'What it renders, in a sentence or two.';

-- A standard's type: a quality is essential, an engineering standard accidental.
CREATE TYPE standard_type AS ENUM ('quality', 'engineering');

CREATE TABLE standard (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  product_id VARCHAR NOT NULL REFERENCES product (id),
  type standard_type NOT NULL,
  description VARCHAR NOT NULL CHECK (trim(description) <> '')
);
COMMENT ON TABLE standard IS 'A library of rules that holds across the product, such as exact money, a latency budget, logging, error handling or naming. Its type says whether its rules are essential (a quality) or accidental (engineering). What follows one of its rules meets it. A standard is the rules that code follows, not code, so it fills no slot: an engineering standard is accounted for through the records that meet its rules.';
COMMENT ON COLUMN standard.id IS 'The standard''s ID, such as TL-STD-CODE.';
COMMENT ON COLUMN standard.title IS 'The standard''s name.';
COMMENT ON COLUMN standard.product_id IS 'The product it belongs to.';
COMMENT ON COLUMN standard.type IS 'quality: what the product''s people need of it whatever it is built with, such as exact money, auditability or a latency budget (essential); engineering: how it is built, such as logging, naming or how code is laid out (accidental).';
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
  ('data_store', 'Data store', 'technical-specification', 33, false, '<P>-STORE<nn> or <P>-<D>-STORE<nn>', 'TL-STORE01', 'parent', NULL, 'accidental'),
  ('repository', 'Repository', 'technical-specification', 34, false, '<domain>-REPO<nn>', 'TL-LEND-REPO01', 'parent', NULL, 'accidental'),
  ('data_model', 'Data model', 'technical-specification', 35, false, '<entity>-DM', 'TL-LEND-EN01-DM', 'parent', NULL, 'accidental'),
  ('value_type', 'Value type', 'technical-specification', 37, false, '<value object>-VT', 'TL-VO01-VT', 'parent', NULL, 'accidental'),
  ('rule', 'Rule', 'technical-specification', 38, false, '<invariant>-RL', 'TL-LEND-INV01-RL', 'parent', NULL, 'accidental'),
  ('predicate', 'Predicate', 'technical-specification', 39, false, '<specification>-PR', 'TL-LEND-SP01-PR', 'parent', NULL, 'accidental'),
  ('event_type', 'Event type', 'technical-specification', 40, false, '<domain event>-ET', 'TL-LEND-EV01-ET', 'parent', NULL, 'accidental'),
  ('projection', 'Projection', 'technical-specification', 41, false, '<read model>-PJ', 'TL-LEND-RM01-PJ', 'parent', NULL, 'accidental'),
  ('reader', 'Reader', 'technical-specification', 42, false, '<read model>-RD', 'TL-LEND-RM01-RD', 'parent', NULL, 'accidental'),
  ('command_handler', 'Command handler', 'technical-specification', 43, false, '<command>-H', 'TL-LEND-CMD01-H', 'parent', NULL, 'accidental'),
  ('query_handler', 'Query handler', 'technical-specification', 44, false, '<query>-H', 'TL-LEND-QRY01-H', 'parent', NULL, 'accidental'),
  ('event_handler', 'Event handler', 'technical-specification', 45, false, '<policy>-H', 'TL-LEND-PO01-H', 'parent', NULL, 'accidental'),
  ('service', 'Service', 'technical-specification', 46, false, '<domain service>-SV', 'TL-LEND-DS01-SV', 'parent', NULL, 'accidental'),
  ('endpoint_handler', 'Endpoint handler', 'technical-specification', 48, false, '<endpoint>-H', 'TL-LEND-EP01-H', 'parent', NULL, 'accidental'),
  ('adapter', 'Adapter', 'technical-specification', 49, false, '<integration>-AD', 'TL-INT01-AD', 'parent', NULL, 'accidental'),
  ('entry_point', 'Entry point', 'technical-specification', 50, false, '<domain>-ENTRY<nn>', 'TL-LEND-ENTRY01', 'parent', NULL, 'accidental'),
  ('tooling', 'Tooling', 'technical-specification', 51, false, '<domain>-TOOL<nn>', 'TL-LEND-TOOL01', 'parent', NULL, 'accidental'),
  ('table', 'Table', 'technical-specification', 36, false, '<entity or read model>-TB, or <domain>-TB<nn>', 'TL-LEND-EN01-TB', 'parent', NULL, 'accidental'),
  ('ui_component', 'UI component', 'technical-specification', 47, false, '<P>-UI<nn>', 'TL-UI01', 'product', NULL, 'accidental'),
  ('standard', 'Standard', 'technical-specification', 52, false, '<P>-STD-<name>', 'TL-STD-CODE', 'parent', NULL, 'by-type'),
  ('standard_rule', 'Standard rule', 'technical-specification', 53, true, '<standard>-R<nn>', 'TL-STD-CODE-R01', 'parent', NULL, 'as-parent');
INSERT INTO meta_kind_parent VALUES
  ('data_store', 'product', 1, 'product_id'),
  ('data_store', 'domain', 2, 'domain_id'),
  ('repository', 'domain', 1, 'domain_id'),
  ('data_model', 'entity', 1, 'entity_id'),
  ('value_type', 'value_object', 1, 'value_object_id'),
  ('rule', 'invariant', 1, 'invariant_id'),
  ('predicate', 'specification', 1, 'specification_id'),
  ('event_type', 'domain_event', 1, 'domain_event_id'),
  ('projection', 'read_model', 1, 'read_model_id'),
  ('reader', 'read_model', 1, 'read_model_id'),
  ('command_handler', 'command', 1, 'command_id'),
  ('query_handler', 'query', 1, 'query_id'),
  ('event_handler', 'policy', 1, 'policy_id'),
  ('service', 'domain_service', 1, 'domain_service_id'),
  ('endpoint_handler', 'endpoint', 1, 'endpoint_id'),
  ('adapter', 'integration', 1, 'integration_id'),
  ('entry_point', 'domain', 1, 'domain_id'),
  ('tooling', 'domain', 1, 'domain_id'),
  ('table', 'entity', 1, 'entity_id'), ('table', 'read_model', 2, 'read_model_id'), ('table', 'domain', 3, 'domain_id'),
  ('standard', 'product', 1, 'product_id'),
  ('standard_rule', 'standard', 1, 'standard_id');
INSERT INTO meta_kind_title VALUES
  ('data_store', 'identifier'), ('repository', 'identifier'), ('data_model', 'identifier'), ('value_type', 'identifier'), ('rule', 'identifier'), ('predicate', 'identifier'),
  ('event_type', 'identifier'), ('projection', 'identifier'), ('reader', 'identifier'), ('command_handler', 'identifier'), ('query_handler', 'identifier'),
  ('event_handler', 'identifier'), ('service', 'identifier'), ('endpoint_handler', 'identifier'), ('adapter', 'identifier'),
  ('entry_point', 'identifier'), ('tooling', 'identifier'), ('table', 'identifier');
INSERT INTO meta_table VALUES
  ('data_store', 'kind', NULL), ('repository', 'kind', NULL), ('data_model', 'kind', NULL), ('value_type', 'kind', NULL), ('rule', 'kind', NULL), ('predicate', 'kind', NULL), ('event_type', 'kind', NULL), ('projection', 'kind', NULL), ('reader', 'kind', NULL), ('command_handler', 'kind', NULL), ('query_handler', 'kind', NULL), ('event_handler', 'kind', NULL), ('service', 'kind', NULL), ('endpoint_handler', 'kind', NULL), ('adapter', 'kind', NULL),
  ('entry_point', 'kind', NULL), ('tooling', 'kind', NULL),
  ('table', 'kind', NULL), ('table_key', 'part', 'table_id'), ('ui_component', 'kind', NULL), ('standard', 'kind', NULL), ('standard_rule', 'kind', NULL);

-- The packages technical records use: every package a product's package.json files list is named by a record, so each
-- dependency is accounted for by what it serves.
CREATE TABLE package_use (
  record_id VARCHAR NOT NULL REFERENCES technical_record (id),
  package VARCHAR NOT NULL CHECK (regexp_full_match(package, '(@[a-z0-9~-][a-z0-9._~-]*/)?[a-z0-9~-][a-z0-9._~-]*')),
  PRIMARY KEY (record_id, package)
);
COMMENT ON TABLE package_use IS 'A package a technical record uses: a dependency one of the product''s package.json files lists, which the record accounts for, such as the package an adapter calls or a tooling record runs. Only a technical record names one: its record_id is one (technical_record).';
COMMENT ON COLUMN package_use.record_id IS 'The technical record that uses the package: an adapter, a UI component, an entry point, a tooling record, or a record of a product''s own technical kind.';
COMMENT ON COLUMN package_use.package IS 'The package''s name as package.json lists it, such as @duckdb/node-api.';
INSERT INTO meta_table VALUES ('package_use', 'part', 'record_id');

-- The helper files technical records name beside their file: the other files a record's code is split across, such as
-- helpers and build-tag variants, so each traces to the one record it serves.
CREATE TABLE helper_file (
  record_id VARCHAR NOT NULL REFERENCES technical_record (id),
  file VARCHAR NOT NULL CHECK (trim(file) <> '' AND NOT regexp_matches(file, '^\.?/|/$|\\')),
  PRIMARY KEY (record_id, file),
  UNIQUE (file)
);
COMMENT ON TABLE helper_file IS 'A helper file of a technical record: one more file its code is split across beside the record''s file, such as a helper or a build-tag variant of it. The file traces to the record, as its own file does, and the record is built only when its file and every helper file exist. Only a technical record names one (technical_record), one record names each, and a helper file is never the file of a technical record (helper-file-is-a-file).';
COMMENT ON COLUMN helper_file.record_id IS 'The technical record whose code the file holds part of: any technical record, a record of a product''s own technical kind included.';
COMMENT ON COLUMN helper_file.file IS 'The helper file, from the product root with forward slashes, such as internal/compiler/lock_unix.go; it may not exist yet. It does not start with ./ or /, and it is a file, not a folder.';
INSERT INTO meta_table VALUES ('helper_file', 'part', 'record_id');
