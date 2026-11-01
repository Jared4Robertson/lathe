// Generated from lathe/schema/ by `npm --prefix lathe run schema`; do not edit by hand.
// One interface per stored table: a row as its data file holds it, with the columns in their fixed order.

/** A product: the root of a set of specifications. */
export interface ProductRow {
  /** The product's ID, its prefix, such as TL. */
  id: string;
  /** The product's name, such as Tool Library. */
  title: string;
  /** What the product is, who it is for and what it must do, in a paragraph. */
  description: string;
  /** An emoji or short text shown for the product in the app's space rail. */
  icon?: string;
  /** A CSS color for the product in the app's space rail. */
  color?: string;
  /** Longer notes on the product, such as how it is delivered. */
  notes?: string;
}

/** A part of the product with its own model, language and owner, for one business capability: what DDD calls a bounded context. Domains meet only through published events. */
export interface DomainRow {
  /** The domain's ID: the product prefix and the domain code, such as TL-LEND. */
  id: string;
  /** The domain's name, such as Lending. */
  title: string;
  /** The product it belongs to. */
  product_id: string;
  /** core: the product's edge; supporting: needed for the core but not its edge; generic: solved the same way everywhere. It guides how much modeling the domain deserves. */
  subdomain_type: "core" | "supporting" | "generic";
  /** What the domain covers, in a paragraph. */
  description: string;
  /** Longer notes on the domain. */
  notes?: string;
}

/** Something undecided, with the role that decides it. It sits under its product or one of its domains, and may be about any record (the about link). A decided question is removed and its answer written into the records it affects. */
export interface QuestionRow {
  /** The question's ID: its product's or domain's ID and Q<nn>, such as TL-LEND-Q01 or TL-Q01. */
  id: string;
  /** The question. */
  title: string;
  /** The product it sits under, for a question of the whole product; exactly one of product and domain is given. */
  product_id?: string;
  /** The domain it sits under; exactly one of product and domain is given. */
  domain_id?: string;
  /** The role that decides it, one of the product's roles, such as Owner. */
  owner: string;
  /** What is open and the options, in a paragraph. */
  description: string;
}

/** The open question concerns the record. */
export interface AboutRow {
  source_id: string;
  target_id: string;
}

/** An outside system the product exchanges with, such as a payment provider or a mail service. It has no owner: it exists because flow steps exchange with it, and its product follows from its ID. */
export interface IntegrationRow {
  /** The integration's ID: the product prefix and INT<nn>, such as TL-INT01. */
  id: string;
  /** The integration's name. */
  title: string;
  /** The outside system, such as Stripe. */
  system?: string;
  /** What the product exchanges with it, in a sentence or two. */
  description: string;
}

/** Talks to its integration's outside system, so the rest of the code does not. */
export interface AdapterRow {
  /** The adapter's ID: its integration's ID and AD, such as TL-INT01-AD. */
  id: string;
  /** Its name in code, such as mailer. */
  title: string;
  /** The integration it talks to; one adapter each. */
  integration_id: string;
  /** The file that holds its code, from the product root; it may not exist yet, and several records may share one file. */
  file?: string;
  /** How it talks to its outside system, in a sentence or two. */
  description: string;
}

/** The consistency boundary: a cluster of entities changed together as one unit, by one command at a time. Other aggregates follow its changes through events, and refer to it by ID only. */
export interface AggregateRow {
  /** The aggregate's ID, such as TL-LEND-A1. */
  id: string;
  /** The aggregate's name, such as Loan. */
  title: string;
  /** The domain it belongs to. */
  domain_id: string;
  /** What the aggregate keeps and why its entities change together, in a paragraph. */
  description: string;
  /** What identifies one of its records in the business, such as Loan ID. */
  identity: string;
  /** Longer notes on the aggregate. */
  notes?: string;
}

/** A record the domain keeps, with an identity: its aggregate's root or one of its children. Its fields are entity_field rows; the value objects it has are the ones its fields are typed with. */
export interface EntityRow {
  /** The entity's ID, such as TL-LEND-EN01. */
  id: string;
  /** The entity's name, such as Return. */
  title: string;
  /** The aggregate it belongs to. */
  aggregate_id: string;
  /** root: the record the aggregate is named for, at most one per aggregate; child: one of its parts. */
  role: "root" | "child";
  /** true: a child entity with no table of its own, stored in its aggregate root's table (which then holds its fields as columns); left out otherwise. An entity has at most one table. */
  in_root_table?: boolean;
  /** What the entity is, in a sentence or two. */
  description: string;
}

/** A request to change exactly one aggregate: the one its entity belongs to. It sits under the entity it changes, and checks specifications, raises events and may call domain services, all of its own domain. */
export interface CommandRow {
  /** The command's ID, such as TL-LEND-CMD01. */
  id: string;
  /** What it asks for, in the imperative, such as Open a loan. */
  title: string;
  /** The entity it changes, the root or a child; its aggregate is the one the command changes. */
  entity_id: string;
  /** What it changes and when it is refused, in a sentence or two; how its handler does it belongs to the handler. */
  description: string;
}

/** A view of its domain's data shaped for reading, which reads one or more of the domain's aggregates. Its fields are read_model_field rows, and it is stored in a table of its own. */
export interface ReadModelRow {
  /** The read model's ID, such as TL-LEND-RM01. */
  id: string;
  /** The read model's name, such as Overdue loans. */
  title: string;
  /** The domain it belongs to. */
  domain_id: string;
  /** What it shows, in a sentence or two. */
  description: string;
}

/** A question asked of one read model, its parent. It changes nothing, and may select by specifications and call domain services of its own domain. */
export interface QueryRow {
  /** The query's ID: its read model's domain's ID and QRY<nn>, such as TL-LEND-QRY01. */
  id: string;
  /** What it asks, such as List a member's loans. */
  title: string;
  /** The read model it reads. */
  read_model_id: string;
  /** What it returns, in a sentence or two; the code that answers it belongs to its handler. */
  description: string;
}

/** An HTTP endpoint that exposes exactly one command or query, its parent. Flow steps reach it through their command or query, never directly. */
export interface EndpointRow {
  /** The endpoint's ID, such as TL-LEND-EP01. */
  id: string;
  /** Its method and route, one space apart, such as POST /loans: refused otherwise. */
  title: string;
  /** The command it exposes; exactly one of command and query is given. */
  command_id?: string;
  /** The query it exposes; exactly one of command and query is given. */
  query_id?: string;
  /** The HTTP method. */
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
  /** The route, such as /loans or /tools/{toolId}/damage. */
  route: string;
  /** Its request and responses, in a sentence or two. */
  description: string;
  /** Longer notes on the endpoint. */
  notes?: string;
}

/** One rule an endpoint must follow, such as an error's response or a limit on its request. */
export interface ApiRequirementRow {
  /** The requirement's ID: its endpoint's ID and R<nn>, such as TL-LEND-EP01-R01. */
  id: string;
  /** The requirement in a few words. */
  title: string;
  /** The endpoint it belongs to. */
  endpoint_id: string;
  /** The requirement, stated with MUST, MUST NOT, SHOULD or MAY. */
  statement: string;
  /** A short heading it is shown under among its siblings. */
  group_name?: string;
}

/** A piece of the user interface that renders one or more views and builds the view requirements its code does (builds). It has no owner: it exists because views use it, and its product follows from its ID. */
export interface UiComponentRow {
  /** The UI component's ID: the product prefix and UI<nn>, such as TL-UI01. */
  id: string;
  /** Its name in code, such as CatalogPage. */
  title: string;
  /** The file that holds its code, from the product root; it may not exist yet. */
  file?: string;
  /** What it renders, in a sentence or two. */
  description: string;
}

/** A screen or page a person uses. It has no owner: it exists because flow steps happen in it, and its product follows from its ID. */
export interface ViewRow {
  /** The view's ID: the product prefix and V<nn>, such as TL-V01. */
  id: string;
  /** The view's name, such as Catalog. */
  title: string;
  /** The address it is shown at, such as /catalog. */
  route?: string;
  /** What the view shows and lets a person do, in a paragraph. */
  description: string;
  /** Longer notes on the view. */
  notes?: string;
}

/** One rule a view must follow, such as what it shows while loading or a field's limits. The UI components whose code does what it says build it (builds). */
export interface ViewRequirementRow {
  /** The requirement's ID: its view's ID and R<nn>, such as TL-V01-R01. */
  id: string;
  /** The requirement in a few words. */
  title: string;
  /** The view it belongs to. */
  view_id: string;
  /** The requirement, stated with MUST, MUST NOT, SHOULD or MAY. */
  statement: string;
  /** A short heading it is shown under among its siblings. */
  group_name?: string;
}

/** The UI component builds the view requirement: its code does what the requirement says. A view requirement is built only through the components that build it, never through any component that renders its view. */
export interface BuildsRow {
  source_id: string;
  target_id: string;
}

/** A word of the domain's glossary and what it means there, so specs, code and conversation use one language. */
export interface TermRow {
  /** The term's ID, such as TL-LEND-TM01. */
  id: string;
  /** The term, such as Loan. */
  title: string;
  /** The domain whose language it belongs to. */
  domain_id: string;
  /** What it means in that domain. */
  meaning: string;
  /** A short heading it is shown under among its domain's terms, such as Records or Writing. */
  group_name?: string;
}

/** The term is defined with the other term: its meaning uses it, so the other term is defined first and never builds on it in turn, through any chain. */
export interface BuildsOnRow {
  source_id: string;
  target_id: string;
}

/** A business outcome: a measurable change the product exists to bring about, which its capabilities serve and its tests or records measure (measured_by). The trace runs from it to a capability, a use case, the code and the tests. */
export interface BusinessOutcomeRow {
  /** The outcome's ID: its product's ID and BO<nn>, such as TL-BO01. */
  id: string;
  /** The outcome in a few words, such as More tools in use. */
  title: string;
  /** The product it belongs to. */
  product_id: string;
  /** The outcome, stated so it can be measured, in one sentence. */
  statement: string;
  /** What is measured to know whether it is reached, and how. */
  measure: string;
  /** The value of the measure that counts as reached, and by when. */
  target: string;
  /** How the outcome is measured outside the code, when no test or record of the product can measure it (adoption by other repos, sales): who counts what, from where. Give it only then; an outcome the code can measure links what measures it with measured_by. */
  measured_outside?: string;
  /** Longer notes, such as where the measure comes from. */
  notes?: string;
}

/** Domain logic that belongs to no single entity and is not a yes-or-no check, such as calculating a late fee. Commands and queries of its domain call it; it uses no storage and no outside system. */
export interface DomainServiceRow {
  /** The domain service's ID, such as TL-LEND-DS01. */
  id: string;
  /** What it works out, such as Late fee. */
  title: string;
  /** The domain it belongs to. */
  domain_id: string;
  /** What it must work out, from what, stated with MUST, SHOULD or MAY. */
  statement: string;
}

/** The command, query or read model uses the domain service, of its own domain. */
export interface CallsRow {
  source_id: string;
  target_id: string;
}

/** An ordered slice of a domain that groups its use cases, such as Catalog or Lending. */
export interface CapabilityRow {
  /** The capability's ID, such as TL-LEND-CAP01. */
  id: string;
  /** The capability's name, such as Catalog. */
  title: string;
  /** The domain it belongs to. */
  domain_id: string;
  /** Its place in the domain, from 1. */
  position: number;
  /** What the capability covers, in a sentence or two. */
  description: string;
}

/** A check: a query over the tables that returns a row (severity, check, record, message) for each problem it finds. An error means the workspace is broken; a warning is work still to do. */
export interface CheckRow {
  /** The check's name, in lower case with hyphens, such as value-object-unused. */
  name: string;
  /** For a product's own check, the product; none for Lathe's checks. */
  product_id?: string;
  /** The domain whose rules it reports: a domain of Lathe's own spec for Lathe's checks, of the product for its own. Not a foreign key, because Lathe's checks load into every product. */
  domain_id: string;
  /** Its place in the run order, from 1: Lathe's checks run first, then the product's own. */
  position: number;
  /** What its rows report: error, warning, or error_or_warning when its rows say which. */
  severity: "error" | "warning" | "error_or_warning";
  /** What it reports, in one sentence. */
  summary: string;
  /** Why it matters, ending with how to fix what it reports. */
  explanation: string;
  /** The SELECT that finds the problems. */
  query: string;
  /** The kinds it concerns. */
  kinds?: string[];
}

/** A named predicate over one or more aggregates of one domain (Evans), such as Member in good standing. Commands check it before acting, and queries may select by it. It has no owner: it reads its aggregates, and its domain follows from its ID. */
export interface SpecificationRow {
  /** The specification's ID: its domain's ID and SP<nn>, such as TL-LEND-SP01. */
  id: string;
  /** The predicate's name, such as Member in good standing. */
  title: string;
  /** When a record satisfies it, in a sentence. */
  statement: string;
}

/** The command checks the specification, of its own domain, before it acts. */
export interface ChecksRow {
  source_id: string;
  target_id: string;
}

/** Carries out its command: an application service that owns the transaction, loads the aggregate through its repository, checks specifications and raises events. What clean architecture calls a use case or interactor. */
export interface CommandHandlerRow {
  /** The command handler's ID: its command's ID and H, such as TL-LEND-CMD01-H. */
  id: string;
  /** Its name in code, such as openLoan. */
  title: string;
  /** The command it handles; one command handler each. */
  command_id: string;
  /** The file that holds its code, from the product root; it may not exist yet, and several records may share one file. */
  file?: string;
  /** How it carries out its command (transaction, checks, what it writes), in a sentence or two; never what the command already says. */
  description: string;
}

/** A value with no identity of its own, such as an email address or a money amount, defined by its fields and checked by its constraints when it is created. It has no owner: it exists because entities, events or read models use it as a field's type, and its product follows from its ID. */
export interface ValueObjectRow {
  /** The value object's ID: the product prefix and VO<nn>, such as TL-VO01. */
  id: string;
  /** The value object's name, such as Email address. */
  title: string;
  /** What the value is, in a sentence or two. */
  description: string;
}

/** A value object's own rule, checked when the value is created, such as an email address having one @. */
export interface ConstraintRow {
  /** The constraint's ID: its value object's ID and C<nn>, such as TL-VO01-C01. */
  id: string;
  /** The rule in a few words. */
  title: string;
  /** The value object it belongs to. */
  value_object_id: string;
  /** The rule, stated with MUST, MUST NOT, SHOULD or MAY. */
  statement: string;
}

/** Proves its constraint: the values its value object accepts and refuses. */
export interface ConstraintTestRow {
  /** The test's ID: its constraint's ID and T, such as TL-VO01-C01-T. */
  id: string;
  /** What the test shows, in a sentence. */
  title: string;
  /** The constraint it proves; it has exactly one test. */
  constraint_id: string;
  /** How it runs: unit, integration, service, system or browser, the lowest that can observe its result; a manual test names the level a person exercises. */
  level: "unit" | "integration" | "service" | "system" | "browser";
  /** automated: its file runs it; manual: a person follows it, for the reason given; not automated yet: meant to be automated, and not proof yet. */
  state: "automated" | "manual" | "not automated yet";
  /** The file that runs it, from the product root; an automated test must name one. */
  file?: string;
  /** Why a person runs it rather than a file; a manual test must give one, and only a manual test. */
  manual_reason?: string;
  /** How much it exercises: none for small (a few records, the usual case), volume (many records, to show it holds at scale) or worst case (the slowest or largest input it must still handle). */
  size?: "volume" | "worst case";
  /** Yes when it is a smoke test: one of the few run first, after a build or a deploy, to show the product works at all. Left out otherwise. */
  smoke?: boolean;
  /** Yes when it reaches a system outside the product, such as a third-party service, so it needs that system and its access to run. Left out otherwise. */
  external?: boolean;
  /** Values the value object accepts, such as a@b.org. */
  accepts: string;
  /** Values it refuses, and how. */
  refuses: string;
  /** Longer notes on the test, such as when to run it. */
  notes?: string;
}

/** Its entity in code: the entity's data, behavior and mapping to its table. A command is carried out by its handler and its aggregate root's data model. */
export interface DataModelRow {
  /** The data model's ID: its entity's ID and DM, such as TL-LEND-EN01-DM. */
  id: string;
  /** Its name in code, such as Loan. */
  title: string;
  /** The entity it implements; one data model each. */
  entity_id: string;
  /** The file that holds its code, from the product root; it may not exist yet, and several records may share one file. */
  file?: string;
}

/** Where data actually lives: a database, a bucket, a folder of files, browser storage or memory. Every repository, reader and table names the one it is stored in (stored_in). One that is a service someone else runs, which the user must provide, such as a managed database or a bucket, is reached through its integration (provided_by); one the product owns outright, such as a local file or browser storage, has none. */
export interface DataStoreRow {
  /** The data store's ID: its product's ID and STORE<nn>, or its domain's ID and STORE<nn>, such as TL-STORE01. */
  id: string;
  /** Its name in code or config, such as DATABASE_URL, dataDir or localStorage. */
  title: string;
  /** The product it sits under, when several of its domains use it; exactly one of product and domain is given. */
  product_id?: string;
  /** The domain it sits under, when one domain alone uses it; exactly one of product and domain is given. */
  domain_id?: string;
  /** database: a database server or file, such as PostgreSQL or SQLite; object store: a bucket of objects, such as S3; file folder: a folder of files the program reads and writes; file: one file the program reads and writes whole; browser storage: kept by the browser, such as local or session storage or its history; memory: kept only while the program runs, and rebuilt on each start. */
  kind: "database" | "object store" | "file folder" | "file" | "browser storage" | "memory";
  /** Where it is and what keeps it there, in a sentence or two: its location, who runs it and how it is reached. */
  description: string;
}

/** An unchangeable record that something happened to an aggregate, named in the past tense (Loan opened), raised by its commands. What it carries are event_field rows. */
export interface DomainEventRow {
  /** The event's ID, such as TL-LEND-EV01. */
  id: string;
  /** The event's name, in the past tense, such as Tool repaired. */
  title: string;
  /** The aggregate it happens to. */
  aggregate_id: string;
  /** true: its shape is a promise to other domains, whose policies may hear it; false: only its own domain hears it. */
  published: boolean;
  /** What happened and what brings it about, in a sentence. */
  description: string;
}

/** Proves its domain service: from the inputs given, the value or decision it returns. */
export interface DomainServiceTestRow {
  /** The test's ID: its domain service's ID and T<nn>, such as TL-LEND-DS01-T01. */
  id: string;
  /** What the test shows, in a sentence. */
  title: string;
  /** The domain service it proves. */
  domain_service_id: string;
  /** How it runs: unit, integration, service, system or browser, the lowest that can observe its result; a manual test names the level a person exercises. */
  level: "unit" | "integration" | "service" | "system" | "browser";
  /** automated: its file runs it; manual: a person follows it, for the reason given; not automated yet: meant to be automated, and not proof yet. */
  state: "automated" | "manual" | "not automated yet";
  /** The file that runs it, from the product root; an automated test must name one. */
  file?: string;
  /** Why a person runs it rather than a file; a manual test must give one, and only a manual test. */
  manual_reason?: string;
  /** How much it exercises: none for small (a few records, the usual case), volume (many records, to show it holds at scale) or worst case (the slowest or largest input it must still handle). */
  size?: "volume" | "worst case";
  /** Yes when it is a smoke test: one of the few run first, after a build or a deploy, to show the product works at all. Left out otherwise. */
  smoke?: boolean;
  /** Yes when it reaches a system outside the product, such as a third-party service, so it needs that system and its access to run. Left out otherwise. */
  external?: boolean;
  /** What the test does, in a sentence, opening with any state it sets up beyond the test data sets it starts from (starts_from). */
  when: string;
  /** What the test expects. */
  then: string;
  /** Longer notes on the test, such as when to run it. */
  notes?: string;
}

/** Serves its endpoint: reads the request, calls the command or query handler and writes the response. */
export interface EndpointHandlerRow {
  /** The endpoint handler's ID: its endpoint's ID and H, such as TL-LEND-EP01-H. */
  id: string;
  /** Its name in code, such as postLoan. */
  title: string;
  /** The endpoint it serves; one endpoint handler each. */
  endpoint_id: string;
  /** The file that holds its code, from the product root; it may not exist yet, and several records may share one file. */
  file?: string;
  /** How it reads the request, calls its handler and answers or refuses, in a sentence or two; the request and response shapes belong to the endpoint. */
  description: string;
}

/** Proves its API requirement at the endpoint: the request and the response. */
export interface EndpointTestRow {
  /** The test's ID: its API requirement's ID and T<nn>, such as TL-LEND-EP01-R01-T01. */
  id: string;
  /** What the test shows, in a sentence. */
  title: string;
  /** The API requirement it proves. */
  api_requirement_id: string;
  /** How it runs: unit, integration, service, system or browser, the lowest that can observe its result; a manual test names the level a person exercises. */
  level: "unit" | "integration" | "service" | "system" | "browser";
  /** automated: its file runs it; manual: a person follows it, for the reason given; not automated yet: meant to be automated, and not proof yet. */
  state: "automated" | "manual" | "not automated yet";
  /** The file that runs it, from the product root; an automated test must name one. */
  file?: string;
  /** Why a person runs it rather than a file; a manual test must give one, and only a manual test. */
  manual_reason?: string;
  /** How much it exercises: none for small (a few records, the usual case), volume (many records, to show it holds at scale) or worst case (the slowest or largest input it must still handle). */
  size?: "volume" | "worst case";
  /** Yes when it is a smoke test: one of the few run first, after a build or a deploy, to show the product works at all. Left out otherwise. */
  smoke?: boolean;
  /** Yes when it reaches a system outside the product, such as a third-party service, so it needs that system and its access to run. Left out otherwise. */
  external?: boolean;
  /** What the test does, in a sentence, opening with any state it sets up beyond the test data sets it starts from (starts_from). */
  when: string;
  /** What the test expects. */
  then: string;
  /** Longer notes on the test, such as when to run it. */
  notes?: string;
}

/** One field of an entity, in order. Its table's columns follow from it. */
export interface EntityFieldRow {
  /** The entity. */
  entity_id: string;
  /** The field's place in the entity, from 1. */
  position: number;
  /** The field's name, such as Returned at: one name in its entity, compared trimmed and in any letter case. */
  name: string;
  /** What the field means. */
  meaning: string;
  /** Its basic type: text, whole number, decimal, date, time, date and time or yes/no; or none when a value object or an aggregate types it. */
  type?: "text" | "whole number" | "decimal" | "date" | "time" | "date and time" | "yes/no";
  /** The value object that is its type, if one. */
  type_value_object_id?: string;
  /** The aggregate it refers to by ID, if one. A reference within the domain is a foreign key of the entity's table; one to another domain stays a plain ID. */
  type_aggregate_id?: string;
  /** true: every record gives it a value; false: it may be empty. */
  required: boolean;
  /** Its column's name in the table, when that differs from the field's name, such as id for the field Member ID. */
  column_name?: string;
  /** An example value. */
  example?: string;
}

/** A start-up file: what runs first and wires the rest together, such as a server's main file or a desktop app's main process. No design record is implemented by it alone, so it sits under the domain it starts. */
export interface EntryPointRow {
  /** The entry point's ID: its domain's ID and ENTRY<nn>, such as TL-LEND-ENTRY01. */
  id: string;
  /** Its file's name, or its name in code, such as server.ts. */
  title: string;
  /** The domain it starts. */
  domain_id: string;
  /** The start-up file, from the product root; it may not exist yet. */
  file?: string;
  /** What it does at start-up, in a sentence or two: what it reads, opens and serves. */
  description: string;
}

/** One field a domain event carries, in order. A published event's fields are a contract with other domains. */
export interface EventFieldRow {
  /** The domain event. */
  domain_event_id: string;
  /** The field's place in the event, from 1. */
  position: number;
  /** The field's name, such as Repaired at: one name in its event, compared trimmed and in any letter case. */
  name: string;
  /** What the field means. */
  meaning: string;
  /** Its basic type: text, whole number, decimal, date, time, date and time or yes/no; or none when a value object or an aggregate types it. */
  type?: "text" | "whole number" | "decimal" | "date" | "time" | "date and time" | "yes/no";
  /** The value object that is its type, if one. */
  type_value_object_id?: string;
  /** The aggregate it refers to by ID, if one. */
  type_aggregate_id?: string;
  /** true: every record gives it a value; false: it may be empty. */
  required: boolean;
  /** Its column's name in the table, when that differs from the field's name, such as id for the field Member ID. */
  column_name?: string;
  /** An example value. */
  example?: string;
}

/** Whenever an event, then a command (event storming). It belongs to the command it invokes and hears one event: its own domain's, or another domain's published one. */
export interface PolicyRow {
  /** The policy's ID, such as TL-LEND-PO01. */
  id: string;
  /** The reaction in a few words, such as Close loans of a retired tool. */
  title: string;
  /** The command it invokes. */
  command_id: string;
  /** The reaction: whenever the event, then the command, stated with MUST, SHOULD or MAY. */
  statement: string;
}

/** Carries out its policy: hears the policy's event and sends its command. */
export interface EventHandlerRow {
  /** The event handler's ID: its policy's ID and H, such as TL-LEND-PO01-H. */
  id: string;
  /** Its name in code, such as onToolRetired. */
  title: string;
  /** The policy it carries out; one event handler each. */
  policy_id: string;
  /** The file that holds its code, from the product root; it may not exist yet, and several records may share one file. */
  file?: string;
  /** Where it hears its event and how it sends its command, in a sentence or two. */
  description: string;
}

/** Its domain event's shape in code; a contract with other domains when the event is published. */
export interface EventTypeRow {
  /** The event type's ID: its domain event's ID and ET, such as TL-LEND-EV01-ET. */
  id: string;
  /** Its name in code, such as LoanOpened. */
  title: string;
  /** The domain event it implements; one event type each. */
  domain_event_id: string;
  /** How the event reaches what hears it: in process, after the transaction commits; or outbox, saved in the same transaction as its aggregate and delivered reliably afterwards. An event a policy hears is delivered by outbox, since a lost reaction is a lost change; one that only keeps read models current (fed_by), where those read models are rebuilt from the data on every load, may be delivered in process. */
  delivery?: "in process" | "outbox";
  /** The file that holds its code, from the product root; it may not exist yet, and several records may share one file. */
  file?: string;
}

/** An actor's goal: its actors (use_case_actor rows), its UC requirements and its flows, one per interface it happens through. It changes nothing itself; its flows' steps invoke commands and queries. */
export interface UseCaseRow {
  /** The use case's ID, such as TL-LEND-UC01. */
  id: string;
  /** What the actor does, such as Borrow a tool. */
  title: string;
  /** The capability it sits in. */
  capability_id: string;
  /** What the actor wants to reach and from where they start, in a sentence or a short paragraph. */
  goal: string;
  /** Longer notes, such as the order in which refusals are reported. */
  notes?: string;
}

/** A way people or programs use the product, such as its web app, its HTTP API or its command line. A use case happens through one or more interfaces, with one flow for each, and the kind says what that flow's steps go through. */
export interface InterfaceRow {
  /** The interface's ID: its product's ID and IF<nn>, such as TL-IF01. Its number ends the ID of every flow through it. */
  id: string;
  /** The interface's name, such as Web app, HTTP API, CLI, MCP tools or Desktop app. */
  title: string;
  /** The product it belongs to. */
  product_id: string;
  /** What it is: web app or desktop (a flow's steps happen in views), API (they call endpoints, through the command or query each exposes), CLI or agent tools (they run commands and queries), or other. A step of an API, CLI or agent tools flow happens in no view. */
  kind: "web app" | "API" | "CLI" | "agent tools" | "desktop" | "other";
  /** Who uses it and how, in a sentence or two. */
  description: string;
  /** Whether people or programs outside the product build on it, so its contract is the product's own commitment: a public API's requirements are essential complexity, an internal one's (such as the API only the product's own app calls) accidental. */
  public: boolean;
}

/** How its use case is carried out through one interface: the steps on its main path and its alternate paths. A use case has one flow per interface it happens through, and each flow belongs only to it. */
export interface FlowRow {
  /** The flow's ID: its use case's ID, FL and its interface's number, such as TL-LEND-UC01-FL01 for the flow through TL-IF01. */
  id: string;
  /** The flow's name, such as Borrow a tool at the desk. */
  title: string;
  /** The use case it carries out. */
  use_case_id: string;
  /** The interface it goes through, of the same product; at most one flow per use case and interface. */
  interface_id: string;
}

/** One step of a flow, in order on its path. It fulfills UC requirements of its own use case, invokes at most one command or query, happens in at most one view (only on a web app, desktop or other interface) and may exchange with integrations. */
export interface FlowStepRow {
  /** The step's ID: its flow's ID and S<nn>, such as TL-LEND-UC01-FL01-S01. */
  id: string;
  /** What happens, in a few words. */
  title: string;
  /** The flow it belongs to. */
  flow_id: string;
  /** The path through the flow the step is on, such as main or refused. */
  path: string;
  /** The step's place on its path, from 1. */
  position: number;
}

/** The flow step exchanges with the integration's outside system. */
export interface ExchangesWithRow {
  source_id: string;
  target_id: string;
}

/** The read model is kept current from the event: of its own domain, or another domain's published one, which is how a read model shows another domain's data. */
export interface FedByRow {
  source_id: string;
  target_id: string;
}

/** Behavior several use cases share, stated once: a fixed part, the settings each use case that follows it fills in (its configuration, the known ways it varies) and its slots (the open-ended variation, filled with code against a contract). Its settings are pattern_setting rows, its rules pattern_rule records and its slots slot records. */
export interface PatternRow {
  /** The pattern's ID, such as TL-PAT-LIBRARIAN-ACTION. */
  id: string;
  /** The pattern's name, such as Librarian action. */
  title: string;
  /** The product it belongs to. */
  product_id: string;
  /** The shared behavior, in a paragraph. */
  description: string;
  /** Longer notes, such as how a domain or use case uses the pattern. */
  notes?: string;
}

/** An open-ended part of a pattern, which neither its fixed part nor its settings can express: code fills it against its contract. A technical record that fills it, written by hand, is a fill (fills): accidental complexity recorded where it is owed, and debt until the pattern can derive it. */
export interface SlotRow {
  /** The slot's ID: its pattern's ID and SL<nn>, such as TL-PAT-LIBRARIAN-ACTION-SL01. */
  id: string;
  /** What fills it, in a few words, such as Refusal message. */
  title: string;
  /** The pattern it belongs to. */
  pattern_id: string;
  /** Its contract: what every fill MUST do, in one sentence. */
  statement: string;
}

/** The accidental record (a technical record or an endpoint), written by hand, fills the pattern's slot against its contract: it is a fill, accidental complexity recorded where it is owed and counted as debt until the pattern can derive it. A record of a product's own accidental kind, such as a shared module, fills a slot the same way, with no declaration. */
export interface FillsRow {
  source_id: string;
  target_id: string;
}

/** A smoke test of its flow's main path, end to end, at the level that fits its interface: browser for a web app or desktop, system for an API, a CLI or agent tools. */
export interface FlowTestRow {
  /** The test's ID: its flow's ID and T, such as TL-LEND-UC01-FL01-T. */
  id: string;
  /** What the test shows, in a sentence. */
  title: string;
  /** The flow it proves; it has exactly one test. */
  flow_id: string;
  /** How it runs: unit, integration, service, system or browser, the lowest that can observe its result; a manual test names the level a person exercises. */
  level: "unit" | "integration" | "service" | "system" | "browser";
  /** automated: its file runs it; manual: a person follows it, for the reason given; not automated yet: meant to be automated, and not proof yet. */
  state: "automated" | "manual" | "not automated yet";
  /** The file that runs it, from the product root; an automated test must name one. */
  file?: string;
  /** Why a person runs it rather than a file; a manual test must give one, and only a manual test. */
  manual_reason?: string;
  /** How much it exercises: none for small (a few records, the usual case), volume (many records, to show it holds at scale) or worst case (the slowest or largest input it must still handle). */
  size?: "volume" | "worst case";
  /** Yes when it is a smoke test: one of the few run first, after a build or a deploy, to show the product works at all. Left out otherwise. */
  smoke?: boolean;
  /** Yes when it reaches a system outside the product, such as a third-party service, so it needs that system and its access to run. Left out otherwise. */
  external?: boolean;
  /** What the test does along the main path, step by step. */
  steps: string[];
  /** What it expects at the end. */
  expected_result: string;
  /** Longer notes on the test, such as when to run it. */
  notes?: string;
}

/** The domain or use case follows the pattern, and gives a value for each of its settings in setting_value rows. */
export interface FollowsRow {
  source_id: string;
  target_id: string;
}

/** One rule a use case must follow, whatever the interface: a step of each of the use case's own flows fulfills it. A rule only one interface can meet is a view or API requirement instead. */
export interface UcRequirementRow {
  /** The requirement's ID: its use case's ID and R<nn>, such as TL-LEND-UC01-R01. */
  id: string;
  /** The requirement in a few words. */
  title: string;
  /** The use case it belongs to. */
  use_case_id: string;
  /** The requirement, stated with MUST, MUST NOT, SHOULD or MAY, in one sentence. */
  statement: string;
  /** A short heading it is shown under among its siblings, such as Validation or Paging. */
  group_name?: string;
}

/** The flow step fulfills the UC requirement, of its own use case; this designs the requirement. */
export interface FulfillsRow {
  source_id: string;
  target_id: string;
}

/** A dev script or config file outside the running product: a build, a generator, a watcher, or a config of the tools it is checked and tested with, such as a type checker's or a test runner's. Its title and file say what it is. */
export interface ToolingRow {
  /** The tooling record's ID: its domain's ID and TOOL<nn>, such as TL-LEND-TOOL01. */
  id: string;
  /** Its file's name, such as vitest.config.ts. */
  title: string;
  /** The domain whose code it builds, checks or tests. */
  domain_id: string;
  /** The script or config file, or the folder of them, from the product root; it may not exist yet. */
  file?: string;
}

/** The tooling record (a generator) writes the accidental record (a technical record's code, or an endpoint's route) from the spec: the record is derived, never written by hand. A record of a product's own accidental kind, such as a shared module, is generated the same way, with no declaration. */
export interface GeneratesRow {
  source_id: string;
  target_id: string;
}

/** The flow step happens in the view: at most one per step. */
export interface HappensInRow {
  source_id: string;
  target_id: string;
}

/** The entity holds any number of the other entity, as parts of it (one to many). */
export interface HasManyRow {
  source_id: string;
  target_id: string;
}

/** The entity holds exactly one of the other entity, as a part of it (one to one). */
export interface HasOneRow {
  source_id: string;
  target_id: string;
}

/** The policy hears the event: one event per policy, of its own domain or another domain's published one. */
export interface HearsRow {
  source_id: string;
  target_id: string;
}

/** Proves an exchange with its integration's outside system. */
export interface IntegrationTestRow {
  /** The test's ID: its integration's ID and T<nn>, such as TL-INT01-T01. */
  id: string;
  /** What the test shows, in a sentence. */
  title: string;
  /** The integration it proves. */
  integration_id: string;
  /** How it runs: unit, integration, service, system or browser, the lowest that can observe its result; a manual test names the level a person exercises. */
  level: "unit" | "integration" | "service" | "system" | "browser";
  /** automated: its file runs it; manual: a person follows it, for the reason given; not automated yet: meant to be automated, and not proof yet. */
  state: "automated" | "manual" | "not automated yet";
  /** The file that runs it, from the product root; an automated test must name one. */
  file?: string;
  /** Why a person runs it rather than a file; a manual test must give one, and only a manual test. */
  manual_reason?: string;
  /** How much it exercises: none for small (a few records, the usual case), volume (many records, to show it holds at scale) or worst case (the slowest or largest input it must still handle). */
  size?: "volume" | "worst case";
  /** Yes when it is a smoke test: one of the few run first, after a build or a deploy, to show the product works at all. Left out otherwise. */
  smoke?: boolean;
  /** Yes when it reaches a system outside the product, such as a third-party service, so it needs that system and its access to run. Left out otherwise. */
  external?: boolean;
  /** What the test does, in a sentence, opening with any state it sets up beyond the test data sets it starts from (starts_from). */
  when: string;
  /** What the test expects. */
  then: string;
  /** Longer notes on the test, such as when to run it. */
  notes?: string;
}

/** A rule that holds for one aggregate on every change, enforced by its rule (rule) in the aggregate's code. Uniqueness across records (no two members share an email) is an invariant too, which a unique key of the table may back up. */
export interface InvariantRow {
  /** The invariant's ID, such as TL-LEND-INV01. */
  id: string;
  /** The rule in a few words. */
  title: string;
  /** The aggregate it holds for. */
  aggregate_id: string;
  /** The rule, stated with MUST, MUST NOT, SHOULD or MAY. */
  statement: string;
}

/** Proves its invariant: a change that would break it is refused, and the aggregate stays as it was. */
export interface InvariantTestRow {
  /** The test's ID: its invariant's ID and T, such as TL-LEND-INV01-T. */
  id: string;
  /** What the test shows, in a sentence. */
  title: string;
  /** The invariant it proves; it has exactly one test. */
  invariant_id: string;
  /** How it runs: unit, integration, service, system or browser, the lowest that can observe its result; a manual test names the level a person exercises. */
  level: "unit" | "integration" | "service" | "system" | "browser";
  /** automated: its file runs it; manual: a person follows it, for the reason given; not automated yet: meant to be automated, and not proof yet. */
  state: "automated" | "manual" | "not automated yet";
  /** The file that runs it, from the product root; an automated test must name one. */
  file?: string;
  /** Why a person runs it rather than a file; a manual test must give one, and only a manual test. */
  manual_reason?: string;
  /** How much it exercises: none for small (a few records, the usual case), volume (many records, to show it holds at scale) or worst case (the slowest or largest input it must still handle). */
  size?: "volume" | "worst case";
  /** Yes when it is a smoke test: one of the few run first, after a build or a deploy, to show the product works at all. Left out otherwise. */
  smoke?: boolean;
  /** Yes when it reaches a system outside the product, such as a third-party service, so it needs that system and its access to run. Left out otherwise. */
  external?: boolean;
  /** What the test does, in a sentence, opening with any state it sets up beyond the test data sets it starts from (starts_from). */
  when: string;
  /** What the test expects. */
  then: string;
  /** Longer notes on the test, such as when to run it. */
  notes?: string;
}

/** The flow step invokes the command or query: at most one per step. */
export interface InvokesRow {
  source_id: string;
  target_id: string;
}

/** The business outcome is measured by the test or record: a test of any kind, or a record of a product's own kind (a report, a script, a check row) once the product adds that pair with a product_relation named measured_by. An outcome may be measured by several, and one test or record measure several outcomes. */
export interface MeasuredByRow {
  source_id: string;
  target_id: string;
}

/** A library of rules that holds across the product, such as exact money, a latency budget, logging, error handling or naming. Its type says whether its rules are essential (a quality) or accidental (engineering). What follows one of its rules meets it. */
export interface StandardRow {
  /** The standard's ID, such as TL-STD-CODE. */
  id: string;
  /** The standard's name. */
  title: string;
  /** The product it belongs to. */
  product_id: string;
  /** quality: what the product's people need of it whatever it is built with, such as exact money, auditability or a latency budget (essential); engineering: how it is built, such as logging, naming or how code is laid out (accidental). */
  type: "quality" | "engineering";
  /** What the standard covers, in a paragraph. */
  description: string;
}

/** One rule of a standard. Technical records that follow it link to it with meets; its standard rule tests prove it. */
export interface StandardRuleRow {
  /** The rule's ID: its standard's ID and R<nn>, such as TL-STD-CODE-R01. */
  id: string;
  /** The rule in a few words. */
  title: string;
  /** The standard it belongs to. */
  standard_id: string;
  /** The rule, stated with MUST, MUST NOT, SHOULD or MAY. */
  statement: string;
  /** A short heading it is shown under among its siblings. */
  group_name?: string;
}

/** The technical record follows the standard rule: it shows where the rule is applied, and designs it. */
export interface MeetsRow {
  source_id: string;
  target_id: string;
}

/** A package a technical record uses: a dependency one of the product's package.json files lists, which the record accounts for, such as the package an adapter calls or a tooling record runs. Only a technical record names one: its record_id is one (technical_record). */
export interface PackageUseRow {
  /** The technical record that uses the package: an adapter, a UI component, an entry point, a tooling record, or a record of a product's own technical kind. */
  record_id: string;
  /** The package's name as package.json lists it, such as @duckdb/node-api. */
  package: string;
}

/** One rule of a pattern. Every domain that follows the pattern owes it, with no exception: a rule that holds for only some followers belongs to their use cases, not to the pattern. */
export interface PatternRuleRow {
  /** The rule's ID: its pattern's ID and R<nn>, such as TL-PAT-LIBRARIAN-ACTION-R01. */
  id: string;
  /** The rule in a few words. */
  title: string;
  /** The pattern it belongs to. */
  pattern_id: string;
  /** The rule, stated with MUST, MUST NOT, SHOULD or MAY. */
  statement: string;
  /** A short heading it is shown under among its siblings, such as Validation or Paging. */
  group_name?: string;
  /** Longer notes on how the rule applies. */
  notes?: string;
}

/** Proves its pattern rule in one domain that adopts the pattern: one test per pattern rule and adopting domain. */
export interface PatternRuleTestRow {
  /** The test's ID: its pattern rule's ID and T<nn>, such as TL-PAT-ACT-R01-T01. */
  id: string;
  /** What the test shows, in a sentence. */
  title: string;
  /** The pattern rule it proves. */
  pattern_rule_id: string;
  /** The domain it proves the rule in, one that follows the pattern itself or through a use case; one test per pattern rule and domain. */
  domain_id: string;
  /** How it runs: unit, integration, service, system or browser, the lowest that can observe its result; a manual test names the level a person exercises. */
  level: "unit" | "integration" | "service" | "system" | "browser";
  /** automated: its file runs it; manual: a person follows it, for the reason given; not automated yet: meant to be automated, and not proof yet. */
  state: "automated" | "manual" | "not automated yet";
  /** The file that runs it, from the product root; an automated test must name one. */
  file?: string;
  /** Why a person runs it rather than a file; a manual test must give one, and only a manual test. */
  manual_reason?: string;
  /** How much it exercises: none for small (a few records, the usual case), volume (many records, to show it holds at scale) or worst case (the slowest or largest input it must still handle). */
  size?: "volume" | "worst case";
  /** Yes when it is a smoke test: one of the few run first, after a build or a deploy, to show the product works at all. Left out otherwise. */
  smoke?: boolean;
  /** Yes when it reaches a system outside the product, such as a third-party service, so it needs that system and its access to run. Left out otherwise. */
  external?: boolean;
  /** What the test does, in a sentence, opening with any state it sets up beyond the test data sets it starts from (starts_from). */
  when: string;
  /** What the test expects. */
  then: string;
  /** Longer notes on the test, such as when to run it. */
  notes?: string;
}

/** One setting of a pattern, in order: what each follower decides. */
export interface PatternSettingRow {
  /** The pattern. */
  pattern_id: string;
  /** The setting's place in the pattern, from 1. */
  position: number;
  /** The setting's name, in lower case with underscores, such as required_input. */
  name: string;
  /** What a follower decides in it. */
  meaning: string;
}

/** Loads and saves its aggregate, whole: the way command handlers reach the aggregate's storage, in the one data store it names (stored_in). It persists exactly one aggregate, linked with persists, and sits under its domain, or, for one several domains share, under the domain that holds what they share. */
export interface RepositoryRow {
  /** The repository's ID: its domain's ID and REPO<nn>, such as TL-LEND-REPO01. */
  id: string;
  /** Its name in code, such as LoanRepository. */
  title: string;
  /** The domain it sits under: that of the aggregate it persists, or, for one several domains share, the domain that holds what they share. */
  domain_id: string;
  /** The file that holds its code, from the product root; it may not exist yet, and several records may share one file. */
  file?: string;
  /** How it keeps its aggregate: where, in what form, and when it loads and saves, in a sentence or two. */
  description: string;
}

/** The repository loads and saves the aggregate, whole: one repository per aggregate, and one aggregate per repository. */
export interface PersistsRow {
  source_id: string;
  target_id: string;
}

/** Proves its policy: when its event happens, its command is sent. */
export interface PolicyTestRow {
  /** The test's ID: its policy's ID and T, such as TL-LEND-PO01-T. */
  id: string;
  /** What the test shows, in a sentence. */
  title: string;
  /** The policy it proves; it has exactly one test. */
  policy_id: string;
  /** How it runs: unit, integration, service, system or browser, the lowest that can observe its result; a manual test names the level a person exercises. */
  level: "unit" | "integration" | "service" | "system" | "browser";
  /** automated: its file runs it; manual: a person follows it, for the reason given; not automated yet: meant to be automated, and not proof yet. */
  state: "automated" | "manual" | "not automated yet";
  /** The file that runs it, from the product root; an automated test must name one. */
  file?: string;
  /** Why a person runs it rather than a file; a manual test must give one, and only a manual test. */
  manual_reason?: string;
  /** How much it exercises: none for small (a few records, the usual case), volume (many records, to show it holds at scale) or worst case (the slowest or largest input it must still handle). */
  size?: "volume" | "worst case";
  /** Yes when it is a smoke test: one of the few run first, after a build or a deploy, to show the product works at all. Left out otherwise. */
  smoke?: boolean;
  /** Yes when it reaches a system outside the product, such as a third-party service, so it needs that system and its access to run. Left out otherwise. */
  external?: boolean;
  /** What the test does, in a sentence, opening with any state it sets up beyond the test data sets it starts from (starts_from). */
  when: string;
  /** What the test expects. */
  then: string;
  /** Longer notes on the test, such as when to run it. */
  notes?: string;
}

/** Its specification in code: a yes-or-no test over the records it is given. */
export interface PredicateRow {
  /** The predicate's ID: its specification's ID and PR, such as TL-LEND-SP01-PR. */
  id: string;
  /** Its name in code, such as isInGoodStanding. */
  title: string;
  /** The specification it implements; one predicate each. */
  specification_id: string;
  /** The file that holds its code, from the product root; it may not exist yet, and several records may share one file. */
  file?: string;
}

/** A kind a product adds to Lathe's, such as a report or a CLI command. Its records sit under one parent kind, and its fields are product_kind_field rows. */
export interface ProductKindRow {
  /** The kind's name, in lower case with underscores, which is also its table's name; it must not be a table Lathe already has. */
  name: string;
  /** The product that declares it; only that product's records may be of the kind. */
  product_id: string;
  /** The kind's name as people read it, such as Report. */
  label: string;
  /** What a record of the kind is. */
  description: string;
  /** The kind its records sit under, their one parent: one of Lathe's or another product kind. Its table gets a required <parent_kind>_id column. */
  parent_kind: string;
  /** The stage its records belong to, any of the six, if one; such as technical-specification for a kind of code Lathe has no kind for. */
  stage?: "discovery" | "domain-model" | "use-cases" | "interaction-design" | "technical-specification" | "test-plan";
  /** Whether a record of the kind is an obligation, to be designed, built and proved. An obligation kind joins the obligation supertype, and the records something outside the product may provide (provided_by_source). */
  obligation: boolean;
  /** How its IDs are written, its own pattern, such as <command>-CLI. */
  id_pattern?: string;
  /** An example ID. */
  id_example?: string;
  /** For a code-bound kind, how its titles are written (meta_kind_title): identifier, invocation or kebab-case; none for a kind titled in words. */
  title_form?: "identifier" | "invocation" | "kebab-case";
  /** Whether its records are essential complexity (what the problem itself demands, such as a report the product's people read), accidental (what comes from the means of building it, such as a kind of code), or as-parent: as the record they sit under. Never mixed: a kind that would hold both is two kinds. */
  complexity: "essential" | "accidental" | "as-parent" | "by-type" | "by-interface";
}

/** One typed field of a product kind, in order: a column of its table. */
export interface ProductKindFieldRow {
  /** The product kind. */
  kind: string;
  /** The field's place among the kind's columns, from 1. */
  position: number;
  /** The column's name, in lower case with underscores; not id, title or the parent column. A field named statement, goal, meaning or description is the kind's lead text, shown first on its records' pages: a kind has at most one, and it must be required. */
  name: string;
  /** text, integer, boolean or date (YYYY-MM-DD). */
  type: "text" | "integer" | "boolean" | "date";
  /** Whether every record of the kind must give it. */
  required: boolean;
  /** What the field holds. */
  description: string;
  /** Whether the field's value is also the record's title, such as a module's file: every write sets the title from it, and a title that differs is refused. Only a required text field titles its kind, and at most one does. */
  titles?: boolean;
}

/** A pair of kinds a product lets a relation link. A new relation name gets its own link table; a name Lathe already has adds the pair to that relation, when its link table's ends accept the two kinds. */
export interface ProductRelationRow {
  /** The relation's name, in lower case with underscores. */
  name: string;
  /** The kind a link starts from. */
  source_kind: string;
  /** The kind a link points at, or * for any record. */
  target_kind: string;
  /** The product that declares it. */
  product_id: string;
  /** design, build or proof, for a new relation that counts toward coverage: a design or build link's source builds its target once it names a file that exists, and a proof link's source proves it. A new relation's links stay inside one product. */
  role?: "design" | "build" | "proof";
  /** The link read from its source. */
  forward_label: string;
  /** The link read from its target. */
  reverse_label: string;
  /** What a link between these kinds means. */
  description: string;
}

/** A product's typed settings for its checks. A product without a row takes the defaults. */
export interface ProductSettingRow {
  /** The product. */
  product_id: string;
  /** The most children of one kind a record should have before too-many-children warns; the default is 15. */
  max_children: number;
  /** The most entities an aggregate should have before aggregate-too-large warns; the default is 7. */
  max_entities_per_aggregate: number;
  /** The words, besides Lathe's own, that name technology in this product's essential records, which accidental-in-essential warns of, such as the name of a framework the product is built with; none by default. */
  technology_words: string[];
}

/** Fills its read model's table and keeps it current, from events or as a view's query. It writes only its own read model's table. */
export interface ProjectionRow {
  /** The projection's ID: its read model's ID and PJ, such as TL-LEND-RM01-PJ. */
  id: string;
  /** Its name in code, such as overdueLoans. */
  title: string;
  /** The read model it fills; one projection each. */
  read_model_id: string;
  /** The file that holds its code, from the product root; it may not exist yet, and several records may share one file. */
  file?: string;
  /** How it fills its read model and when it is rebuilt, in a sentence or two. */
  description: string;
}

/** The record is provided by something outside the product, which decides it once for everyone who uses it: a dependency, a platform or a generic subdomain, reached through an integration or named by a record of a product's own kind (a component of a design system), once the product adds that pair with a product_relation named provided_by. A data store someone else runs, such as a managed database or a bucket, is provided by the integration that reaches it; a store the product owns outright, such as a local file, has none. A provided record counts as accounted for, and a provided obligation as built and proved, through its provider. One provider per record. */
export interface ProvidedByRow {
  source_id: string;
  target_id: string;
}

/** Answers its query from its read model's table: an application service that changes nothing. */
export interface QueryHandlerRow {
  /** The query handler's ID: its query's ID and H, such as TL-LEND-QRY01-H. */
  id: string;
  /** Its name in code, such as listLoans. */
  title: string;
  /** The query it answers; one query handler each. */
  query_id: string;
  /** The file that holds its code, from the product root; it may not exist yet, and several records may share one file. */
  file?: string;
  /** How it answers its query (from what, kept or computed on each call), in a sentence or two. */
  description: string;
}

/** The command raises the event, of the aggregate it changes. */
export interface RaisesRow {
  source_id: string;
  target_id: string;
}

/** One field of a read model, in order. Its table's columns follow from it. */
export interface ReadModelFieldRow {
  /** The read model. */
  read_model_id: string;
  /** The field's place in the read model, from 1. */
  position: number;
  /** The field's name, such as Days overdue: one name in its read model, compared trimmed and in any letter case. */
  name: string;
  /** What the field means. */
  meaning: string;
  /** Its basic type: text, whole number, decimal, date, time, date and time or yes/no; or none when a value object or an aggregate types it. */
  type?: "text" | "whole number" | "decimal" | "date" | "time" | "date and time" | "yes/no";
  /** The value object that is its type, if one. */
  type_value_object_id?: string;
  /** The aggregate it refers to by ID, if one. */
  type_aggregate_id?: string;
  /** true: every record gives it a value; false: it may be empty. */
  required: boolean;
  /** Its column's name in the table, when that differs from the field's name, such as id for the field Member ID. */
  column_name?: string;
  /** An example value. */
  example?: string;
}

/** Reads its read model's table for its query handlers: the way query handlers reach a read model's storage, in the one data store it names (stored_in). It reads exactly one read model, its parent, and nothing else; a query handler reads only through its own read model's reader, and the projection alone fills the table it reads. */
export interface ReaderRow {
  /** The reader's ID: its read model's ID and RD, such as TL-LEND-RM01-RD. */
  id: string;
  /** Its name in code, such as OverdueLoansReader. */
  title: string;
  /** The read model it reads; one reader each. */
  read_model_id: string;
  /** The file that holds its code, from the product root; it may not exist yet, and several records may share one file. */
  file?: string;
  /** How it reads its read model's table: where the table is kept and how a query handler is given the reader, in a sentence or two. */
  description: string;
}

/** The specification or read model reads the aggregate, of its own domain. */
export interface ReadsRow {
  source_id: string;
  target_id: string;
}

/** The UI component renders the view, or part of it. */
export interface RendersRow {
  source_id: string;
  target_id: string;
}

/** A role the product's records name, such as Owner, Reader or Agent: a use case's actors and a question's owner. Specs name roles, never people. */
export interface RoleRow {
  /** The product. */
  product_id: string;
  /** The role's name, such as Librarian. */
  name: string;
  /** Who takes the role and what they do in the product, in a sentence. */
  description: string;
}

/** Enforces its invariant: the rule in its aggregate's code, run by the aggregate's commands before saving, which refuses a change that would break it. Lathe's own rules sit in each aggregate's rules.ts and also run over all data on every load. An invariant is built only through its rule. */
export interface RuleRow {
  /** The rule's ID: its invariant's ID and RL, such as TL-LEND-INV01-RL. */
  id: string;
  /** Its name in code, the name its refusal carries, such as step-fulfills-own-use-case or email_taken. */
  title: string;
  /** The invariant it enforces; one rule each. */
  invariant_id: string;
  /** The file that holds its code, from the product root, such as its aggregate's rules.ts; it may not exist yet, and several records may share one file. */
  file?: string;
}

/** The query selects the records that satisfy the specification, of its own domain. */
export interface SelectsByRow {
  source_id: string;
  target_id: string;
}

/** The capability serves the business outcome: what it is for. A capability may serve several outcomes, and an outcome be served by several capabilities. */
export interface ServesRow {
  source_id: string;
  target_id: string;
}

/** Its domain service in code. It never uses a repository or an outside system: its inputs are passed in, and it returns a value or a decision. */
export interface ServiceRow {
  /** The service's ID: its domain service's ID and SV, such as TL-LEND-DS01-SV. */
  id: string;
  /** Its name in code, such as lateFee. */
  title: string;
  /** The domain service it implements; one service each. */
  domain_service_id: string;
  /** The file that holds its code, from the product root; it may not exist yet, and several records may share one file. */
  file?: string;
}

/** The value a use case or domain gives one setting of a pattern it follows. A follower owes every rule of the pattern; a value such as No input is a value like any other, never a way out of a rule. */
export interface SettingValueRow {
  /** The use case or domain that follows the pattern. */
  follower_id: string;
  /** The pattern it follows. */
  pattern_id: string;
  /** The setting, one of the pattern's. */
  setting: string;
  /** The value it gives the setting. */
  value: string;
}

/** Proves its specification: which records satisfy the predicate and which do not. */
export interface SpecificationTestRow {
  /** The test's ID: its specification's ID and T, such as TL-LEND-SP01-T. */
  id: string;
  /** What the test shows, in a sentence. */
  title: string;
  /** The specification it proves; it has exactly one test. */
  specification_id: string;
  /** How it runs: unit, integration, service, system or browser, the lowest that can observe its result; a manual test names the level a person exercises. */
  level: "unit" | "integration" | "service" | "system" | "browser";
  /** automated: its file runs it; manual: a person follows it, for the reason given; not automated yet: meant to be automated, and not proof yet. */
  state: "automated" | "manual" | "not automated yet";
  /** The file that runs it, from the product root; an automated test must name one. */
  file?: string;
  /** Why a person runs it rather than a file; a manual test must give one, and only a manual test. */
  manual_reason?: string;
  /** How much it exercises: none for small (a few records, the usual case), volume (many records, to show it holds at scale) or worst case (the slowest or largest input it must still handle). */
  size?: "volume" | "worst case";
  /** Yes when it is a smoke test: one of the few run first, after a build or a deploy, to show the product works at all. Left out otherwise. */
  smoke?: boolean;
  /** Yes when it reaches a system outside the product, such as a third-party service, so it needs that system and its access to run. Left out otherwise. */
  external?: boolean;
  /** What the test does, in a sentence, opening with any state it sets up beyond the test data sets it starts from (starts_from). */
  when: string;
  /** What the test expects. */
  then: string;
  /** Longer notes on the test, such as when to run it. */
  notes?: string;
}

/** Proves its standard rule in the product's code, such as a scan of the code for what the rule forbids or a test of a place that follows it. */
export interface StandardRuleTestRow {
  /** The test's ID: its standard rule's ID and T<nn>, such as TL-STD-CODE-R01-T01. */
  id: string;
  /** What the test shows, in a sentence. */
  title: string;
  /** The standard rule it proves. */
  standard_rule_id: string;
  /** How it runs: unit, integration, service, system or browser, the lowest that can observe its result; a manual test names the level a person exercises. */
  level: "unit" | "integration" | "service" | "system" | "browser";
  /** automated: its file runs it; manual: a person follows it, for the reason given; not automated yet: meant to be automated, and not proof yet. */
  state: "automated" | "manual" | "not automated yet";
  /** The file that runs it, from the product root; an automated test must name one. */
  file?: string;
  /** Why a person runs it rather than a file; a manual test must give one, and only a manual test. */
  manual_reason?: string;
  /** How much it exercises: none for small (a few records, the usual case), volume (many records, to show it holds at scale) or worst case (the slowest or largest input it must still handle). */
  size?: "volume" | "worst case";
  /** Yes when it is a smoke test: one of the few run first, after a build or a deploy, to show the product works at all. Left out otherwise. */
  smoke?: boolean;
  /** Yes when it reaches a system outside the product, such as a third-party service, so it needs that system and its access to run. Left out otherwise. */
  external?: boolean;
  /** What the test does, in a sentence, opening with any state it sets up beyond the test data sets it starts from (starts_from). */
  when: string;
  /** What the test expects. */
  then: string;
  /** Longer notes on the test, such as when to run it. */
  notes?: string;
}

/** What some tests start from: the environment, the accounts and the starting records, how to prepare and reset them, and the file that builds them. Tests link to it with starts_from. */
export interface TestDataSetRow {
  /** The data set's ID: its domain's ID and TD<nn>, such as TL-LEND-TD01. */
  id: string;
  /** The data set in a few words, such as Two members, one tool on loan. */
  title: string;
  /** The domain whose tests it serves. */
  domain_id: string;
  /** Where it runs: the database, server or browser storage it is built in. */
  environment: string;
  /** The accounts and roles it signs in as. */
  accounts?: string;
  /** The records it starts with. */
  records: string;
  /** How to prepare it before a test. */
  prepare: string;
  /** How to reset it after a test, so the next starts clean. */
  reset: string;
  /** The seed or fixture that builds it, from the product root. */
  file?: string;
  /** What it is for, in a sentence or two. */
  description: string;
}

/** The test starts from the test data set: it is prepared before the test and reset after. */
export interface StartsFromRow {
  source_id: string;
  target_id: string;
}

/** What the business needs kept of one aggregate or read model, its parent, and how well: whichever apply of durability (it survives a restart or a crash), atomicity (saved whole or not at all, such as a loan with its outbox event), retention and deletion (how long it is kept, and deleted on request), recovery (backups, and how much may be lost) and capacity (how much, how fast). It is built by its aggregate's repository, or its read model's reader, naming a file that exists and the data store it is stored in, and proved by its storage requirement tests. */
export interface StorageRequirementRow {
  /** The requirement's ID: its aggregate's or read model's ID and SR<nn>, such as TL-LEND-A1-SR01. */
  id: string;
  /** The requirement in a few words, such as A loan is saved with its outbox event. */
  title: string;
  /** The aggregate whose data it is about; exactly one of aggregate and read model is given. */
  aggregate_id?: string;
  /** The read model whose data it is about; exactly one of aggregate and read model is given. */
  read_model_id?: string;
  /** What must be kept and how well, stated with MUST, MUST NOT, SHOULD or MAY. */
  statement: string;
}

/** Proves its storage requirement at the level that can observe it: a round trip, a restart, a failed save that leaves nothing behind, a deletion, a restore. */
export interface StorageRequirementTestRow {
  /** The test's ID: its storage requirement's ID and T<nn>, such as TL-LEND-A1-SR01-T01. */
  id: string;
  /** What the test shows, in a sentence. */
  title: string;
  /** The storage requirement it proves. */
  storage_requirement_id: string;
  /** How it runs: unit, integration, service, system or browser, the lowest that can observe its result; a manual test names the level a person exercises. */
  level: "unit" | "integration" | "service" | "system" | "browser";
  /** automated: its file runs it; manual: a person follows it, for the reason given; not automated yet: meant to be automated, and not proof yet. */
  state: "automated" | "manual" | "not automated yet";
  /** The file that runs it, from the product root; an automated test must name one. */
  file?: string;
  /** Why a person runs it rather than a file; a manual test must give one, and only a manual test. */
  manual_reason?: string;
  /** How much it exercises: none for small (a few records, the usual case), volume (many records, to show it holds at scale) or worst case (the slowest or largest input it must still handle). */
  size?: "volume" | "worst case";
  /** Yes when it is a smoke test: one of the few run first, after a build or a deploy, to show the product works at all. Left out otherwise. */
  smoke?: boolean;
  /** Yes when it reaches a system outside the product, such as a third-party service, so it needs that system and its access to run. Left out otherwise. */
  external?: boolean;
  /** What the test does, in a sentence, opening with any state it sets up beyond the test data sets it starts from (starts_from). */
  when: string;
  /** What the test expects. */
  then: string;
  /** Longer notes on the test, such as when to run it. */
  notes?: string;
}

/** The repository, reader or table is kept in the data store: each names exactly one, where its data actually lives. */
export interface StoredInRow {
  source_id: string;
  target_id: string;
}

/** Where an entity or a read model, its parent, is stored, in a database or not; or, under a domain, a table of the domain's own infrastructure that implements no design record, such as its outbox. It is kept in the one data store it names (stored_in). Its columns follow from its parent's fields, a value object's fields flattened into columns, so it stores only what fields cannot say: its keys and indexes (table_key rows). An entity's table holds its rows, the source of truth: a table, normalized, or the browser storage, file or memory that keeps them; a read model's is a projection that can be rebuilt, usually a view over its domain's entity tables, or computed in memory on each load. */
export interface TableRow {
  /** The table's ID: its entity's or read model's ID and TB, such as TL-LEND-EN01-TB. */
  id: string;
  /** The table as people read it, such as Loans. */
  title: string;
  /** The entity it stores; exactly one of entity, read model and domain is given. An entity has at most one table: a child entity marked in_root_table has none and is stored in its root's. */
  entity_id?: string;
  /** The read model it stores; exactly one of entity, read model and domain is given, and a read model has one table. */
  read_model_id?: string;
  /** The domain whose own infrastructure it stores, such as its outbox, when it stores no entity or read model; its ID is the domain's and TB with a number, such as TL-LEND-TB01, and its storage is a table. */
  domain_id?: string;
  /** Its name where it is stored: in the database, such as loans, the key it is kept under in browser storage, such as lathe:tabs, or the file's name, such as window-state.json. */
  name: string;
  /** table: rows of its own in a database; view: a query over other tables; materialized view: a query's result, kept; browser storage: kept by the browser (local or session storage, or its history), under the key its name gives; file: kept in a file of its own that the program reads and writes whole, such as a JSON file, named by its name; in memory: kept only while the program runs, or computed on each load. An entity's table holds rows of its own, so it is never a view or a materialized view. Keys are asked only of a table in a database: browser storage, a file and in memory have none. */
  storage: "table" | "view" | "materialized view" | "browser storage" | "file" | "in memory";
  /** The file that creates it, such as a migration, or that reads and writes it, from the product root; it may not exist yet. */
  file?: string;
}

/** One key or index of a table in a database (never of browser storage, a file or in memory), in order: its primary key, a unique key with the invariant it enforces, a foreign key with the table it points at, or an index. A foreign key points at a table of the same domain: a reference to another domain's aggregate stays a plain ID. */
export interface TableKeyRow {
  /** The table. */
  table_id: string;
  /** The key's place among the table's keys, from 1. */
  position: number;
  /** primary (at most one per table), unique, foreign or index. */
  type: "primary" | "unique" | "foreign" | "index";
  /** Its columns, in order, by their names in the database. */
  columns: string[];
  /** Its name in the database, if it has one. */
  name?: string;
  /** For a unique key, the invariant it enforces, such as no two members sharing an email. */
  invariant_id?: string;
  /** For a foreign key, the table it points at, of the same domain; required for a foreign key and only for one. */
  target_table_id?: string;
  /** For a partial unique key, the rows it holds for, such as returned_at IS NULL for one active loan per tool; only a unique key has one. */
  condition?: string;
}

/** One actor of a use case, in order: a role of the use case's product. */
export interface UseCaseActorRow {
  /** The use case. */
  use_case_id: string;
  /** The actor's place among the use case's actors, from 1; the first is the main actor. */
  position: number;
  /** The role, which the product names in its role rows. */
  role_name: string;
}

/** Proves its UC requirement, at the level the use case is stated: what the actor does and what the product does in answer. */
export interface UseCaseTestRow {
  /** The test's ID: its UC requirement's ID and T<nn>, such as TL-LEND-UC01-R01-T01. */
  id: string;
  /** What the test shows, in a sentence. */
  title: string;
  /** The UC requirement it proves. */
  uc_requirement_id: string;
  /** How it runs: unit, integration, service, system or browser, the lowest that can observe its result; a manual test names the level a person exercises. */
  level: "unit" | "integration" | "service" | "system" | "browser";
  /** automated: its file runs it; manual: a person follows it, for the reason given; not automated yet: meant to be automated, and not proof yet. */
  state: "automated" | "manual" | "not automated yet";
  /** The file that runs it, from the product root; an automated test must name one. */
  file?: string;
  /** Why a person runs it rather than a file; a manual test must give one, and only a manual test. */
  manual_reason?: string;
  /** How much it exercises: none for small (a few records, the usual case), volume (many records, to show it holds at scale) or worst case (the slowest or largest input it must still handle). */
  size?: "volume" | "worst case";
  /** Yes when it is a smoke test: one of the few run first, after a build or a deploy, to show the product works at all. Left out otherwise. */
  smoke?: boolean;
  /** Yes when it reaches a system outside the product, such as a third-party service, so it needs that system and its access to run. Left out otherwise. */
  external?: boolean;
  /** What the test does, in a sentence, opening with any state it sets up beyond the test data sets it starts from (starts_from). */
  when: string;
  /** What the test expects. */
  then: string;
  /** Longer notes on the test, such as when to run it. */
  notes?: string;
}

/** One field of a value object, in order. A table flattens a value object's fields into columns. */
export interface ValueObjectFieldRow {
  /** The value object. */
  value_object_id: string;
  /** The field's place in the value object, from 1. */
  position: number;
  /** The field's name, such as Amount: one name in its value object, compared trimmed and in any letter case. */
  name: string;
  /** What the field means. */
  meaning: string;
  /** Its basic type: text, whole number, decimal, date, time, date and time or yes/no; or none when a value object or an aggregate types it. */
  type?: "text" | "whole number" | "decimal" | "date" | "time" | "date and time" | "yes/no";
  /** Another value object that is its type, if one. */
  type_value_object_id?: string;
  /** The aggregate it refers to by ID, if one. */
  type_aggregate_id?: string;
  /** true: every record gives it a value; false: it may be empty. */
  required: boolean;
  /** Its column's name in the table, when that differs from the field's name, such as id for the field Member ID. */
  column_name?: string;
  /** An example value. */
  example?: string;
}

/** Its value object in code, which checks the value object's constraints when a value is created. */
export interface ValueTypeRow {
  /** The value type's ID: its value object's ID and VT, such as TL-VO01-VT. */
  id: string;
  /** Its name in code, such as EmailAddress. */
  title: string;
  /** The value object it implements; one value type each. */
  value_object_id: string;
  /** The file that holds its code, from the product root; it may not exist yet, and several records may share one file. */
  file?: string;
}

/** Proves its view requirement in the view. */
export interface ViewTestRow {
  /** The test's ID: its view requirement's ID and T<nn>, such as TL-V01-R01-T01. */
  id: string;
  /** What the test shows, in a sentence. */
  title: string;
  /** The view requirement it proves. */
  view_requirement_id: string;
  /** How it runs: unit, integration, service, system or browser, the lowest that can observe its result; a manual test names the level a person exercises. */
  level: "unit" | "integration" | "service" | "system" | "browser";
  /** automated: its file runs it; manual: a person follows it, for the reason given; not automated yet: meant to be automated, and not proof yet. */
  state: "automated" | "manual" | "not automated yet";
  /** The file that runs it, from the product root; an automated test must name one. */
  file?: string;
  /** Why a person runs it rather than a file; a manual test must give one, and only a manual test. */
  manual_reason?: string;
  /** How much it exercises: none for small (a few records, the usual case), volume (many records, to show it holds at scale) or worst case (the slowest or largest input it must still handle). */
  size?: "volume" | "worst case";
  /** Yes when it is a smoke test: one of the few run first, after a build or a deploy, to show the product works at all. Left out otherwise. */
  smoke?: boolean;
  /** Yes when it reaches a system outside the product, such as a third-party service, so it needs that system and its access to run. Left out otherwise. */
  external?: boolean;
  /** What the test does, in a sentence, opening with any state it sets up beyond the test data sets it starts from (starts_from). */
  when: string;
  /** What the test expects. */
  then: string;
  /** Longer notes on the test, such as when to run it. */
  notes?: string;
}

/** Each stored table's row type, by table name. */
export interface TableRows {
  product: ProductRow;
  domain: DomainRow;
  question: QuestionRow;
  about: AboutRow;
  integration: IntegrationRow;
  adapter: AdapterRow;
  aggregate: AggregateRow;
  entity: EntityRow;
  command: CommandRow;
  read_model: ReadModelRow;
  query: QueryRow;
  endpoint: EndpointRow;
  api_requirement: ApiRequirementRow;
  ui_component: UiComponentRow;
  view: ViewRow;
  view_requirement: ViewRequirementRow;
  builds: BuildsRow;
  term: TermRow;
  builds_on: BuildsOnRow;
  business_outcome: BusinessOutcomeRow;
  domain_service: DomainServiceRow;
  calls: CallsRow;
  capability: CapabilityRow;
  check: CheckRow;
  specification: SpecificationRow;
  checks: ChecksRow;
  command_handler: CommandHandlerRow;
  value_object: ValueObjectRow;
  constraint: ConstraintRow;
  constraint_test: ConstraintTestRow;
  data_model: DataModelRow;
  data_store: DataStoreRow;
  domain_event: DomainEventRow;
  domain_service_test: DomainServiceTestRow;
  endpoint_handler: EndpointHandlerRow;
  endpoint_test: EndpointTestRow;
  entity_field: EntityFieldRow;
  entry_point: EntryPointRow;
  event_field: EventFieldRow;
  policy: PolicyRow;
  event_handler: EventHandlerRow;
  event_type: EventTypeRow;
  use_case: UseCaseRow;
  interface: InterfaceRow;
  flow: FlowRow;
  flow_step: FlowStepRow;
  exchanges_with: ExchangesWithRow;
  fed_by: FedByRow;
  pattern: PatternRow;
  slot: SlotRow;
  fills: FillsRow;
  flow_test: FlowTestRow;
  follows: FollowsRow;
  uc_requirement: UcRequirementRow;
  fulfills: FulfillsRow;
  tooling: ToolingRow;
  generates: GeneratesRow;
  happens_in: HappensInRow;
  has_many: HasManyRow;
  has_one: HasOneRow;
  hears: HearsRow;
  integration_test: IntegrationTestRow;
  invariant: InvariantRow;
  invariant_test: InvariantTestRow;
  invokes: InvokesRow;
  measured_by: MeasuredByRow;
  standard: StandardRow;
  standard_rule: StandardRuleRow;
  meets: MeetsRow;
  package_use: PackageUseRow;
  pattern_rule: PatternRuleRow;
  pattern_rule_test: PatternRuleTestRow;
  pattern_setting: PatternSettingRow;
  repository: RepositoryRow;
  persists: PersistsRow;
  policy_test: PolicyTestRow;
  predicate: PredicateRow;
  product_kind: ProductKindRow;
  product_kind_field: ProductKindFieldRow;
  product_relation: ProductRelationRow;
  product_setting: ProductSettingRow;
  projection: ProjectionRow;
  provided_by: ProvidedByRow;
  query_handler: QueryHandlerRow;
  raises: RaisesRow;
  read_model_field: ReadModelFieldRow;
  reader: ReaderRow;
  reads: ReadsRow;
  renders: RendersRow;
  role: RoleRow;
  rule: RuleRow;
  selects_by: SelectsByRow;
  serves: ServesRow;
  service: ServiceRow;
  setting_value: SettingValueRow;
  specification_test: SpecificationTestRow;
  standard_rule_test: StandardRuleTestRow;
  test_data_set: TestDataSetRow;
  starts_from: StartsFromRow;
  storage_requirement: StorageRequirementRow;
  storage_requirement_test: StorageRequirementTestRow;
  stored_in: StoredInRow;
  table: TableRow;
  table_key: TableKeyRow;
  use_case_actor: UseCaseActorRow;
  use_case_test: UseCaseTestRow;
  value_object_field: ValueObjectFieldRow;
  value_type: ValueTypeRow;
  view_test: ViewTestRow;
}

/** A stored table of Lathe's schema. */
export type TableName = keyof TableRows;
