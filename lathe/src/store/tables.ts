// Generated from lathe/schema/ by `npm --prefix lathe run schema`; do not edit by hand.
// One interface per stored table: a row as its data file holds it, with the columns in their fixed order.

/** A product: the root of a set of specifications. */
export interface ProductRow {
  /** The product's ID, its prefix, such as TL. */
  id: string;
  /** The product's name, such as Tool Library. */
  title: string;
  /** What the product is, who it is for and what it must do, in a paragraph. */
  description?: string;
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
  description?: string;
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
  /** What is open, and the options. */
  description?: string;
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
  description?: string;
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
  /** How it works, in a sentence or two. */
  description?: string;
}

/** The consistency boundary: a cluster of entities changed together as one unit, by one command at a time. Other aggregates follow its changes through events, and refer to it by ID only. */
export interface AggregateRow {
  /** The aggregate's ID, such as TL-LEND-A1. */
  id: string;
  /** The aggregate's name, such as Loan. */
  title: string;
  /** The domain it belongs to. */
  domain_id: string;
  /** What the aggregate keeps, in a paragraph. */
  description?: string;
  /** What identifies one of its records in the business, such as Loan ID. */
  identity?: string;
  /** Longer notes on the aggregate. */
  notes?: string;
}

/** A request to change exactly one aggregate, its parent. It checks specifications, raises events and may call domain services, all of its own domain. */
export interface CommandRow {
  /** The command's ID, such as TL-LEND-CMD01. */
  id: string;
  /** What it asks for, in the imperative, such as Open a loan. */
  title: string;
  /** The aggregate it changes. */
  aggregate_id: string;
  /** What it does, in a sentence or two. */
  description?: string;
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
  description?: string;
}

/** A question asked of one read model, its parent. It changes nothing, and may select by specifications and call domain services of its own domain. */
export interface QueryRow {
  /** The query's ID: its read model's domain's ID and QRY<nn>, such as TL-LEND-QRY01. */
  id: string;
  /** What it asks, such as List a member's loans. */
  title: string;
  /** The read model it reads. */
  read_model_id: string;
  /** What it returns, in a sentence or two. */
  description?: string;
}

/** An HTTP endpoint that exposes exactly one command or query, its parent. Flow steps reach it through their command or query, never directly. */
export interface EndpointRow {
  /** The endpoint's ID, such as TL-LEND-EP01. */
  id: string;
  /** What the endpoint does, such as Borrow a tool. */
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
  description?: string;
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

/** An ordered slice of a domain that groups its use cases, such as Membership or Lending. */
export interface CapabilityRow {
  /** The capability's ID, such as TL-LEND-CAP01. */
  id: string;
  /** The capability's name, such as Membership. */
  title: string;
  /** The domain it belongs to. */
  domain_id: string;
  /** Its place in the domain, from 1. */
  position: number;
  /** What the capability covers, in a sentence or two. */
  description?: string;
}

/** A check: a query over the tables that returns a row (severity, check, record, message) for each problem it finds. An error means the workspace is broken; a warning is work still to do. */
export interface CheckRow {
  /** The check's name, in lower case with hyphens, such as value-object-unused. */
  name: string;
  /** For a product's own check, the product; none for Lathe's checks. */
  product_id?: string;
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

/** A recorded exception to one aggregate per command: another aggregate of the same domain the command changes in the same transaction, and why. Checks list every one. */
export interface CommandChangeRow {
  /** The command that also changes the aggregate. */
  command_id: string;
  /** The other aggregate it changes in the same transaction: of the command's domain, never its own. */
  aggregate_id: string;
  /** Why the change cannot follow through an event and a policy. */
  reason: string;
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
  /** How it works, in a sentence or two. */
  description?: string;
}

/** A value with no identity of its own, such as an email address or a money amount, defined by its fields and checked by its constraints when it is created. It has no owner: it exists because entities, events or read models use it as a field's type, and its product follows from its ID. */
export interface ValueObjectRow {
  /** The value object's ID: the product prefix and VO<nn>, such as TL-VO01. */
  id: string;
  /** The value object's name, such as Email address. */
  title: string;
  /** What the value is, in a sentence or two. */
  description?: string;
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
  /** The level it runs at: unit, database, api, contract, e2e-api, e2e-ui or manual. */
  level: "unit" | "database" | "api" | "contract" | "e2e-api" | "e2e-ui" | "manual";
  /** automated: its file runs it; manual: a person follows it, for the reason given; not automated yet: meant to be automated, and not proof yet. */
  state: "automated" | "manual" | "not automated yet";
  /** The file that runs it, from the product root; an automated test must name one. */
  file?: string;
  /** Why a person runs it rather than a file; a manual test must give one, and only a manual test. */
  manual_reason?: string;
  /** Values the value object accepts, such as a@b.org. */
  accepts?: string;
  /** Values it refuses, and how. */
  refuses?: string;
  /** Longer notes on the test, such as when to run it. */
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
  description?: string;
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
  /** How it works, in a sentence or two. */
  description?: string;
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
  /** What happened, in a sentence. */
  description?: string;
}

/** Proves its domain service: from the inputs given, the value or decision it returns. */
export interface DomainServiceTestRow {
  /** The test's ID: its domain service's ID and T<nn>, such as TL-LEND-DS01-T01. */
  id: string;
  /** What the test shows, in a sentence. */
  title: string;
  /** The domain service it proves. */
  domain_service_id: string;
  /** The level it runs at: unit, database, api, contract, e2e-api, e2e-ui or manual. */
  level: "unit" | "database" | "api" | "contract" | "e2e-api" | "e2e-ui" | "manual";
  /** automated: its file runs it; manual: a person follows it, for the reason given; not automated yet: meant to be automated, and not proof yet. */
  state: "automated" | "manual" | "not automated yet";
  /** The file that runs it, from the product root; an automated test must name one. */
  file?: string;
  /** Why a person runs it rather than a file; a manual test must give one, and only a manual test. */
  manual_reason?: string;
  /** The state the test starts from. */
  given?: string;
  /** What the test does. */
  when?: string;
  /** What the test expects. */
  then?: string;
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
  /** How it works, in a sentence or two. */
  description?: string;
}

/** Proves its API requirement at the endpoint: the request and the response. */
export interface EndpointTestRow {
  /** The test's ID: its API requirement's ID and T<nn>, such as TL-LEND-EP01-R01-T01. */
  id: string;
  /** What the test shows, in a sentence. */
  title: string;
  /** The API requirement it proves. */
  api_requirement_id: string;
  /** The level it runs at: unit, database, api, contract, e2e-api, e2e-ui or manual. */
  level: "unit" | "database" | "api" | "contract" | "e2e-api" | "e2e-ui" | "manual";
  /** automated: its file runs it; manual: a person follows it, for the reason given; not automated yet: meant to be automated, and not proof yet. */
  state: "automated" | "manual" | "not automated yet";
  /** The file that runs it, from the product root; an automated test must name one. */
  file?: string;
  /** Why a person runs it rather than a file; a manual test must give one, and only a manual test. */
  manual_reason?: string;
  /** The state the test starts from. */
  given?: string;
  /** What the test does. */
  when?: string;
  /** What the test expects. */
  then?: string;
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
  /** How it works, in a sentence or two. */
  description?: string;
}

/** Its domain event's shape in code; a contract with other domains when the event is published. */
export interface EventTypeRow {
  /** The event type's ID: its domain event's ID and ET, such as TL-LEND-EV01-ET. */
  id: string;
  /** Its name in code, such as LoanOpened. */
  title: string;
  /** The domain event it implements; one event type each. */
  domain_event_id: string;
  /** How the event reaches what hears it: in process, after the transaction commits; or outbox, saved in the same transaction as its aggregate and delivered reliably afterwards. An event a policy hears or another domain may hear is delivered by outbox. */
  delivery?: "in process" | "outbox";
  /** The file that holds its code, from the product root; it may not exist yet, and several records may share one file. */
  file?: string;
  /** How it works, in a sentence or two. */
  description?: string;
}

/** An actor's goal: its actors (use_case_actor rows), its UC requirements and its one flow. It changes nothing itself; its flow's steps invoke commands and queries. */
export interface UseCaseRow {
  /** The use case's ID, such as TL-LEND-UC01. */
  id: string;
  /** What the actor does, such as Borrow a tool. */
  title: string;
  /** The capability it sits in. */
  capability_id: string;
  /** What the actor wants to reach, in a sentence. */
  goal?: string;
  /** Longer notes, such as the order in which refusals are reported. */
  notes?: string;
}

/** How its use case is carried out: the steps on its main path and its alternate paths. A use case has exactly one flow, and the flow belongs only to it. */
export interface FlowRow {
  /** The flow's ID: its use case's ID and FL, such as TL-LEND-UC01-FL. */
  id: string;
  /** The flow's name, such as Borrow a tool at the desk. */
  title: string;
  /** The use case it carries out; one flow per use case. */
  use_case_id: string;
  /** The path, in a paragraph. */
  description?: string;
}

/** One step of a flow, in order on its path. It fulfills UC requirements of its own use case, invokes at most one command or query, happens in at most one view and may exchange with integrations. */
export interface FlowStepRow {
  /** The step's ID: its flow's ID and S<nn>, such as TL-LEND-UC01-FL-S01. */
  id: string;
  /** What happens, in a few words. */
  title: string;
  /** The flow it belongs to. */
  flow_id: string;
  /** The path through the flow the step is on, such as main or refused. */
  path: string;
  /** The step's place on its path, from 1. */
  position: number;
  /** What happens in the step, in a sentence or two. */
  description?: string;
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

/** A smoke test of its flow's main path, end to end. */
export interface FlowTestRow {
  /** The test's ID: its flow's ID and T, such as TL-LEND-UC01-FL-T. */
  id: string;
  /** What the test shows, in a sentence. */
  title: string;
  /** The flow it proves; it has exactly one test. */
  flow_id: string;
  /** The level it runs at: unit, database, api, contract, e2e-api, e2e-ui or manual. */
  level: "unit" | "database" | "api" | "contract" | "e2e-api" | "e2e-ui" | "manual";
  /** automated: its file runs it; manual: a person follows it, for the reason given; not automated yet: meant to be automated, and not proof yet. */
  state: "automated" | "manual" | "not automated yet";
  /** The file that runs it, from the product root; an automated test must name one. */
  file?: string;
  /** Why a person runs it rather than a file; a manual test must give one, and only a manual test. */
  manual_reason?: string;
  /** What the test does along the main path, step by step. */
  steps?: string[];
  /** What it expects at the end. */
  expected_result?: string;
  /** Longer notes on the test, such as when to run it. */
  notes?: string;
}

/** Behavior several use cases share, stated once with the settings each use case that follows it fills in. Its settings are pattern_setting rows and its rules pattern_rule records. */
export interface PatternRow {
  /** The pattern's ID, such as TL-PAT-LIBRARIAN-ACTION. */
  id: string;
  /** The pattern's name, such as Librarian action. */
  title: string;
  /** The product it belongs to. */
  product_id: string;
  /** The shared behavior, in a paragraph. */
  description?: string;
  /** Longer notes, such as how a domain or use case uses the pattern. */
  notes?: string;
}

/** The domain or use case follows the pattern, and gives a value for each of its settings in setting_value rows. */
export interface FollowsRow {
  source_id: string;
  target_id: string;
}

/** One rule a use case must follow. Steps of the use case's own flow fulfill it. */
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

/** A screen or page a person uses. It has no owner: it exists because flow steps happen in it, and its product follows from its ID. */
export interface ViewRow {
  /** The view's ID: the product prefix and V<nn>, such as TL-V01. */
  id: string;
  /** The view's name, such as Catalog. */
  title: string;
  /** The address it is shown at, such as /catalog. */
  route?: string;
  /** What the view shows and lets a person do, in a paragraph. */
  description?: string;
  /** Longer notes on the view. */
  notes?: string;
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
  /** The level it runs at: unit, database, api, contract, e2e-api, e2e-ui or manual. */
  level: "unit" | "database" | "api" | "contract" | "e2e-api" | "e2e-ui" | "manual";
  /** automated: its file runs it; manual: a person follows it, for the reason given; not automated yet: meant to be automated, and not proof yet. */
  state: "automated" | "manual" | "not automated yet";
  /** The file that runs it, from the product root; an automated test must name one. */
  file?: string;
  /** Why a person runs it rather than a file; a manual test must give one, and only a manual test. */
  manual_reason?: string;
  /** The state the test starts from. */
  given?: string;
  /** What the test does. */
  when?: string;
  /** What the test expects. */
  then?: string;
  /** Longer notes on the test, such as when to run it. */
  notes?: string;
}

/** A rule that holds for one aggregate on every change. Uniqueness across records (no two members share an email) is an invariant, enforced by a unique key of the table. */
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
  /** The level it runs at: unit, database, api, contract, e2e-api, e2e-ui or manual. */
  level: "unit" | "database" | "api" | "contract" | "e2e-api" | "e2e-ui" | "manual";
  /** automated: its file runs it; manual: a person follows it, for the reason given; not automated yet: meant to be automated, and not proof yet. */
  state: "automated" | "manual" | "not automated yet";
  /** The file that runs it, from the product root; an automated test must name one. */
  file?: string;
  /** Why a person runs it rather than a file; a manual test must give one, and only a manual test. */
  manual_reason?: string;
  /** The state the test starts from. */
  given?: string;
  /** What the test does. */
  when?: string;
  /** What the test expects. */
  then?: string;
  /** Longer notes on the test, such as when to run it. */
  notes?: string;
}

/** The flow step invokes the command or query: at most one per step. */
export interface InvokesRow {
  source_id: string;
  target_id: string;
}

/** A library of engineering rules that holds for the product's code, such as logging, error handling or naming. What follows one of its rules meets it. */
export interface StandardRow {
  /** The standard's ID, such as TL-STD-CODE. */
  id: string;
  /** The standard's name. */
  title: string;
  /** The product it belongs to. */
  product_id: string;
  /** What the standard covers, in a paragraph. */
  description?: string;
}

/** One rule of a standard. Technical records and tests that follow it link to it with meets. */
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

/** The technical record or test follows the standard rule. */
export interface MeetsRow {
  source_id: string;
  target_id: string;
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
  meaning?: string;
}

/** One rule of a pattern. Every domain that follows the pattern owes it, unless it names a setting all of that domain's followers mark Not applicable, or its applies-when condition is met by no follower there. */
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
  /** A setting of its pattern the rule depends on: in a domain whose following use cases all mark it Not applicable, the rule does not apply. */
  setting?: string;
  /** The setting of its pattern its applies-when condition reads; the rule is waived in a domain where no follower gives that setting a value that meets it. */
  applies_when_setting?: string;
  /** false: the condition is <setting> is <value>; true: <setting> is not <value>. */
  applies_when_negated?: boolean;
  /** The value the condition compares with, trimmed and in any letter case. */
  applies_when_value?: string;
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
  /** The level it runs at: unit, database, api, contract, e2e-api, e2e-ui or manual. */
  level: "unit" | "database" | "api" | "contract" | "e2e-api" | "e2e-ui" | "manual";
  /** automated: its file runs it; manual: a person follows it, for the reason given; not automated yet: meant to be automated, and not proof yet. */
  state: "automated" | "manual" | "not automated yet";
  /** The file that runs it, from the product root; an automated test must name one. */
  file?: string;
  /** Why a person runs it rather than a file; a manual test must give one, and only a manual test. */
  manual_reason?: string;
  /** The state the test starts from. */
  given?: string;
  /** What the test does. */
  when?: string;
  /** What the test expects. */
  then?: string;
  /** Longer notes on the test, such as when to run it. */
  notes?: string;
}

/** Proves its policy: when its event happens, its command is sent. */
export interface PolicyTestRow {
  /** The test's ID: its policy's ID and T, such as TL-LEND-PO01-T. */
  id: string;
  /** What the test shows, in a sentence. */
  title: string;
  /** The policy it proves; it has exactly one test. */
  policy_id: string;
  /** The level it runs at: unit, database, api, contract, e2e-api, e2e-ui or manual. */
  level: "unit" | "database" | "api" | "contract" | "e2e-api" | "e2e-ui" | "manual";
  /** automated: its file runs it; manual: a person follows it, for the reason given; not automated yet: meant to be automated, and not proof yet. */
  state: "automated" | "manual" | "not automated yet";
  /** The file that runs it, from the product root; an automated test must name one. */
  file?: string;
  /** Why a person runs it rather than a file; a manual test must give one, and only a manual test. */
  manual_reason?: string;
  /** The state the test starts from. */
  given?: string;
  /** What the test does. */
  when?: string;
  /** What the test expects. */
  then?: string;
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
  /** How it works, in a sentence or two. */
  description?: string;
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
  /** The stage its records belong to, any of the five, if one; such as technical-specification for a kind of code Lathe has no kind for. */
  stage?: "domain-model" | "use-cases" | "interaction-design" | "technical-specification" | "test-plan";
  /** Whether a record of the kind is an obligation, to be designed, built and proved. An obligation kind joins the obligation supertype. */
  obligation: boolean;
  /** How its IDs are written, its own pattern, such as <command>-CLI. */
  id_pattern?: string;
  /** An example ID. */
  id_example?: string;
}

/** One typed field of a product kind, in order: a column of its table. */
export interface ProductKindFieldRow {
  /** The product kind. */
  kind: string;
  /** The field's place among the kind's columns, from 1. */
  position: number;
  /** The column's name, in lower case with underscores; not id, title or the parent column. */
  name: string;
  /** text, integer, boolean or date (YYYY-MM-DD). */
  type: "text" | "integer" | "boolean" | "date";
  /** Whether every record of the kind must give it. */
  required: boolean;
  /** What the field holds. */
  description: string;
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
  /** design or proof, for a new relation that counts toward coverage. A new relation's links stay inside one product. */
  role?: "design" | "proof";
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
  /** How it works, in a sentence or two. */
  description?: string;
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
  /** How it works, in a sentence or two. */
  description?: string;
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

/** The specification or read model reads the aggregate, of its own domain. */
export interface ReadsRow {
  source_id: string;
  target_id: string;
}

/** A piece of the user interface that renders one or more views. It has no owner: it exists because views use it, and its product follows from its ID. */
export interface UiComponentRow {
  /** The UI component's ID: the product prefix and UI<nn>, such as TL-UI01. */
  id: string;
  /** Its name in code, such as CatalogPage. */
  title: string;
  /** The file that holds its code, from the product root; it may not exist yet. */
  file?: string;
  /** What it renders, in a sentence or two. */
  description?: string;
}

/** The UI component renders the view, or part of it. */
export interface RendersRow {
  source_id: string;
  target_id: string;
}

/** Loads and saves its aggregate, whole: the way command handlers reach the aggregate's storage. */
export interface RepositoryRow {
  /** The repository's ID: its aggregate's ID and REPO, such as TL-LEND-A1-REPO. */
  id: string;
  /** Its name in code, such as LoanRepository. */
  title: string;
  /** The aggregate it loads and saves; one repository each. */
  aggregate_id: string;
  /** The file that holds its code, from the product root; it may not exist yet, and several records may share one file. */
  file?: string;
  /** How it works, in a sentence or two. */
  description?: string;
}

/** A role the product's records name, such as Owner, Reader or Agent: a use case's actors and a question's owner. Specs name roles, never people. */
export interface RoleRow {
  /** The product. */
  product_id: string;
  /** The role's name, such as Librarian. */
  name: string;
  /** Who takes the role and what they do. */
  description?: string;
}

/** The query selects the records that satisfy the specification, of its own domain. */
export interface SelectsByRow {
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
  /** How it works, in a sentence or two. */
  description?: string;
}

/** The value a use case or domain gives one setting of a pattern it follows: a value, or Not applicable with the reason. */
export interface SettingValueRow {
  /** The use case or domain that follows the pattern. */
  follower_id: string;
  /** The pattern it follows. */
  pattern_id: string;
  /** The setting, one of the pattern's. */
  setting: string;
  /** The value it gives the setting. */
  value?: string;
  /** Why the setting does not apply to it, in place of a value. */
  not_applicable?: string;
}

/** Proves its specification: which records satisfy the predicate and which do not. */
export interface SpecificationTestRow {
  /** The test's ID: its specification's ID and T, such as TL-LEND-SP01-T. */
  id: string;
  /** What the test shows, in a sentence. */
  title: string;
  /** The specification it proves; it has exactly one test. */
  specification_id: string;
  /** The level it runs at: unit, database, api, contract, e2e-api, e2e-ui or manual. */
  level: "unit" | "database" | "api" | "contract" | "e2e-api" | "e2e-ui" | "manual";
  /** automated: its file runs it; manual: a person follows it, for the reason given; not automated yet: meant to be automated, and not proof yet. */
  state: "automated" | "manual" | "not automated yet";
  /** The file that runs it, from the product root; an automated test must name one. */
  file?: string;
  /** Why a person runs it rather than a file; a manual test must give one, and only a manual test. */
  manual_reason?: string;
  /** The state the test starts from. */
  given?: string;
  /** What the test does. */
  when?: string;
  /** What the test expects. */
  then?: string;
  /** Longer notes on the test, such as when to run it. */
  notes?: string;
}

/** Where an entity or a read model, its parent, is stored; or, under a domain, a table of the domain's own infrastructure that implements no design record, such as its outbox. Its columns follow from its parent's fields, a value object's fields flattened into columns, so it stores only what fields cannot say: its keys and indexes (table_key rows). An entity's table is always a table, normalized and the source of truth; a read model's is a projection that can be rebuilt, usually a view over its domain's entity tables. */
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
  /** Its name in the database, such as loans. */
  name: string;
  /** table: rows of its own; view: a query over other tables; materialized view: a query's result, kept. An entity's table is always table. */
  storage: "table" | "view" | "materialized view";
  /** The file that creates it, such as a migration, from the product root; it may not exist yet. */
  file?: string;
  /** Anything its keys do not say, in a sentence or two. */
  description?: string;
}

/** One key or index of a table, in order: its primary key, a unique key with the invariant it enforces, a foreign key with the table it points at, or an index. A foreign key points at a table of the same domain: a reference to another domain's aggregate stays a plain ID. */
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
  /** The level it runs at: unit, database, api, contract, e2e-api, e2e-ui or manual. */
  level: "unit" | "database" | "api" | "contract" | "e2e-api" | "e2e-ui" | "manual";
  /** automated: its file runs it; manual: a person follows it, for the reason given; not automated yet: meant to be automated, and not proof yet. */
  state: "automated" | "manual" | "not automated yet";
  /** The file that runs it, from the product root; an automated test must name one. */
  file?: string;
  /** Why a person runs it rather than a file; a manual test must give one, and only a manual test. */
  manual_reason?: string;
  /** The state the test starts from. */
  given?: string;
  /** What the test does. */
  when?: string;
  /** What the test expects. */
  then?: string;
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
  /** How it works, in a sentence or two. */
  description?: string;
}

/** One rule a view must follow, such as what it shows while loading or a field's limits. */
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

/** Proves its view requirement in the view. */
export interface ViewTestRow {
  /** The test's ID: its view requirement's ID and T<nn>, such as TL-V01-R01-T01. */
  id: string;
  /** What the test shows, in a sentence. */
  title: string;
  /** The view requirement it proves. */
  view_requirement_id: string;
  /** The level it runs at: unit, database, api, contract, e2e-api, e2e-ui or manual. */
  level: "unit" | "database" | "api" | "contract" | "e2e-api" | "e2e-ui" | "manual";
  /** automated: its file runs it; manual: a person follows it, for the reason given; not automated yet: meant to be automated, and not proof yet. */
  state: "automated" | "manual" | "not automated yet";
  /** The file that runs it, from the product root; an automated test must name one. */
  file?: string;
  /** Why a person runs it rather than a file; a manual test must give one, and only a manual test. */
  manual_reason?: string;
  /** The state the test starts from. */
  given?: string;
  /** What the test does. */
  when?: string;
  /** What the test expects. */
  then?: string;
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
  command: CommandRow;
  read_model: ReadModelRow;
  query: QueryRow;
  endpoint: EndpointRow;
  api_requirement: ApiRequirementRow;
  domain_service: DomainServiceRow;
  calls: CallsRow;
  capability: CapabilityRow;
  check: CheckRow;
  specification: SpecificationRow;
  checks: ChecksRow;
  command_change: CommandChangeRow;
  command_handler: CommandHandlerRow;
  value_object: ValueObjectRow;
  constraint: ConstraintRow;
  constraint_test: ConstraintTestRow;
  entity: EntityRow;
  data_model: DataModelRow;
  domain_event: DomainEventRow;
  domain_service_test: DomainServiceTestRow;
  endpoint_handler: EndpointHandlerRow;
  endpoint_test: EndpointTestRow;
  entity_field: EntityFieldRow;
  event_field: EventFieldRow;
  policy: PolicyRow;
  event_handler: EventHandlerRow;
  event_type: EventTypeRow;
  use_case: UseCaseRow;
  flow: FlowRow;
  flow_step: FlowStepRow;
  exchanges_with: ExchangesWithRow;
  fed_by: FedByRow;
  flow_test: FlowTestRow;
  pattern: PatternRow;
  follows: FollowsRow;
  uc_requirement: UcRequirementRow;
  fulfills: FulfillsRow;
  view: ViewRow;
  happens_in: HappensInRow;
  has_many: HasManyRow;
  has_one: HasOneRow;
  hears: HearsRow;
  integration_test: IntegrationTestRow;
  invariant: InvariantRow;
  invariant_test: InvariantTestRow;
  invokes: InvokesRow;
  standard: StandardRow;
  standard_rule: StandardRuleRow;
  meets: MeetsRow;
  pattern_setting: PatternSettingRow;
  pattern_rule: PatternRuleRow;
  pattern_rule_test: PatternRuleTestRow;
  policy_test: PolicyTestRow;
  predicate: PredicateRow;
  product_kind: ProductKindRow;
  product_kind_field: ProductKindFieldRow;
  product_relation: ProductRelationRow;
  product_setting: ProductSettingRow;
  projection: ProjectionRow;
  query_handler: QueryHandlerRow;
  raises: RaisesRow;
  read_model_field: ReadModelFieldRow;
  reads: ReadsRow;
  ui_component: UiComponentRow;
  renders: RendersRow;
  repository: RepositoryRow;
  role: RoleRow;
  selects_by: SelectsByRow;
  service: ServiceRow;
  setting_value: SettingValueRow;
  specification_test: SpecificationTestRow;
  table: TableRow;
  table_key: TableKeyRow;
  term: TermRow;
  use_case_actor: UseCaseActorRow;
  use_case_test: UseCaseTestRow;
  value_object_field: ValueObjectFieldRow;
  value_type: ValueTypeRow;
  view_requirement: ViewRequirementRow;
  view_test: ViewTestRow;
}

/** A stored table of Lathe's schema. */
export type TableName = keyof TableRows;
