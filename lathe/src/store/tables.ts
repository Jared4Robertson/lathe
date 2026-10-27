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

/** A part of the product with its own model, language and owner: one business capability, never a technology layer. */
export interface DomainRow {
  /** The domain's ID: the product prefix and the domain code, such as TL-LEND. */
  id: string;
  /** The domain's name, such as Lending. */
  title: string;
  /** The product it belongs to. */
  product_id: string;
  /** What the domain covers, in a paragraph. */
  description?: string;
  /** Longer notes, such as its language or the example values it decides. */
  notes?: string;
}

/** A cluster of records changed together as one unit, with its own identity and rules. */
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

/** An ordered slice of a domain that groups its use cases, flows and tests, such as Membership or Lending. */
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

/** Something an actor does with the product to reach a goal. Its actors are use_case_actor rows and its steps use_case_step rows. */
export interface UseCaseRow {
  /** The use case's ID, such as TL-LEND-UC01. */
  id: string;
  /** What the actor does, such as Borrow a tool. */
  title: string;
  /** The domain it belongs to. */
  domain_id: string;
  /** The capability of that domain it sits in, if one. */
  capability_id?: string;
  /** What the actor wants to reach, in a sentence. */
  goal?: string;
  /** Longer notes, such as the order in which refusals are reported. */
  notes?: string;
}

/** An ordered part of a domain's technical specification that groups its components by what they are, such as Models, Services or Web app. It sits in the domain, or in another layer of it as a sub-layer. */
export interface LayerRow {
  /** The layer's ID, such as TL-LEND-LAY01. */
  id: string;
  /** The layer's name, such as Services. */
  title: string;
  /** The domain it belongs to. */
  domain_id: string;
  /** The layer of that domain it sits in as a sub-layer, if one. */
  parent_layer_id?: string;
  /** Its place among the layers beside it, from 1. */
  position: number;
  /** What the layer holds, in a sentence or two. */
  description?: string;
}

/** A unit of code in the target design, such as a model, service or router. It sits in a layer of its domain, or in the domain when the domain has no layers. */
export interface ComponentRow {
  /** The component's ID, such as TL-LEND-C01. */
  id: string;
  /** The component's name, often its file name. */
  title: string;
  /** The domain it belongs to. */
  domain_id: string;
  /** The layer of that domain it sits in, if one. */
  layer_id?: string;
  /** What kind of code it is, in lower case, such as service or module. */
  component_type: string;
  /** The file that holds its code, from the product root; it may not exist yet. */
  file: string;
  /** What the code does, in a paragraph. */
  description?: string;
}

/** Something undecided, with the role that decides it. A decided question is removed and its answer written into the records it affects. */
export interface QuestionRow {
  /** The question's ID, such as TL-LEND-Q01 or TL-Q01. */
  id: string;
  /** The question. */
  title: string;
  /** The product it belongs to. */
  product_id: string;
  /** The domain of that product it sits in, if one. */
  domain_id?: string;
  /** The aggregate of that domain it sits under, if one. */
  aggregate_id?: string;
  /** The use case of that domain it sits under, if one. */
  use_case_id?: string;
  /** The component of that domain it sits under, if one. */
  component_id?: string;
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

/** A group of endpoints for one resource, such as Loans: it holds the resource's endpoints and the interaction requirements that hold for every endpoint in it. The shapes its endpoints share are api_shape rows. */
export interface ApiRow {
  /** The API's ID, such as TL-LEND-API01. */
  id: string;
  /** The resource's name, such as Loans. */
  title: string;
  /** The domain it belongs to. */
  domain_id: string;
  /** The resource and where it is served, in a sentence or two. */
  description?: string;
}

/** One request or response shape an API's endpoints share, in order. */
export interface ApiShapeRow {
  /** The API. */
  api_id: string;
  /** The shape's place in the API, from 1. */
  position: number;
  /** The shape's name, such as Loan. */
  name: string;
  /** What the shape stands for. */
  meaning: string;
  /** Its fields, such as id, memberId, toolId. */
  fields: string;
}

/** A record the domain keeps, as one box of an aggregate's ERD: the aggregate's root or one of its children. Its fields are entity_field rows. */
export interface EntityRow {
  /** The entity's ID, such as TL-LEND-EN01. */
  id: string;
  /** The entity's name, such as Return. */
  title: string;
  /** The aggregate it belongs to. */
  aggregate_id: string;
  /** root: the record the aggregate is named for; child: one of its parts. */
  role: "root" | "child";
  /** What the entity is, in a sentence or two. */
  description?: string;
}

/** A fact that must always hold for an aggregate's records, whatever use case changes them. It names its domain, and its aggregate unless it holds across aggregates, when it names them with involves. */
export interface DomainRuleRow {
  /** The rule's ID, such as TL-LEND-DR01. */
  id: string;
  /** The rule in a few words. */
  title: string;
  /** The domain it belongs to. */
  domain_id: string;
  /** The aggregate it holds for, of the same domain; none for a rule across aggregates. */
  aggregate_id?: string;
  /** The entity of that aggregate it is about, if one. */
  entity_id?: string;
  /** The rule, stated with MUST, MUST NOT, SHOULD or MAY. */
  statement: string;
}

/** The use case relies on the domain rule. */
export interface AppliesRow {
  source_id: string;
  target_id: string;
}

/** An end-to-end path through views and endpoints that carries out one or more use cases. Its steps are flow_step records. */
export interface FlowRow {
  /** The flow's ID, such as TL-LEND-F01. */
  id: string;
  /** The flow's name, such as Borrow and return a tool. */
  title: string;
  /** The domain it belongs to. */
  domain_id: string;
  /** The capability of that domain it sits in, if one. */
  capability_id?: string;
  /** The path, in a paragraph. */
  description?: string;
}

/** The flow carries out the use case. */
export interface CarriesOutRow {
  source_id: string;
  target_id: string;
}

/** A check: a query over the tables that returns a row (severity, check, record, message) for each problem it finds. An error means the workspace is broken; a warning is work still to do. */
export interface CheckRow {
  /** The check's name, in lower case with hyphens, such as test-proves-nothing. */
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

/** A test that proves obligations, or supports them without proving them. An automated test names the file that runs it; a manual test describes its procedure; a planned test is not proof. */
export interface TestRow {
  /** The test's ID, such as TL-LEND-T01. */
  id: string;
  /** What the test shows, in a sentence. */
  title: string;
  /** The domain it belongs to. */
  domain_id: string;
  /** The capability of that domain it sits in, if one. */
  capability_id?: string;
  /** What kind of test it is, in lower case, such as unit, acceptance or domain_rule. */
  test_type: string;
  /** automated: a file runs it; manual: a person follows its procedure; planned: meant to prove its obligations, but not proof yet. */
  state: "automated" | "manual" | "planned";
  /** The file that runs it, from the product root; an automated test must name one. */
  file?: string;
  /** Text its file contains in place of IDs. */
  key?: string;
  /** The file that holds the key (or the IDs), when the test runs from a shared class in another file; that file is read in place of file, which must still exist. */
  key_file?: string;
  /** The state the test starts from. */
  given?: string;
  /** What the test does. */
  when?: string;
  /** What the test expects. */
  then?: string;
  /** Longer notes on the test, such as why it is manual, when to run it or how its code is keyed. */
  notes?: string;
}

/** The test exercises the component. */
export interface CoversRow {
  source_id: string;
  target_id: string;
}

/** A technical flow: how the system carries out a flow. It deepens the flow, and its design_step records say, in order, which component does each part and what it designs. */
export interface DesignFlowRow {
  /** The technical flow's ID, such as TL-LEND-DF01. */
  id: string;
  /** What the system carries out, such as Load and check a workspace. */
  title: string;
  /** The domain it belongs to. */
  domain_id: string;
  /** The layer of that domain it sits in, if one. */
  layer_id?: string;
  /** How the system carries it out, in a paragraph. */
  description?: string;
  /** Its failures, limits and signals. */
  notes?: string;
}

/** The technical flow says how the system carries out the flow. */
export interface DeepensRow {
  source_id: string;
  target_id: string;
}

/** The component calls or imports the other. */
export interface DependsOnRow {
  source_id: string;
  target_id: string;
}

/** One step of a technical flow, in order on its path: what the system does, the component that does it (uses) and the obligations it designs (satisfies). */
export interface DesignStepRow {
  /** The step's ID: its technical flow's ID and S<nn>, such as TL-LEND-DF01-S01. */
  id: string;
  /** What the system does, in a few words. */
  title: string;
  /** The technical flow it belongs to. */
  design_flow_id: string;
  /** The path through the flow the step is on, such as main. */
  path: string;
  /** The step's place on its path, from 1. */
  position: number;
  /** What the system does in the step, in a sentence or two. */
  description?: string;
  /** The transaction the step runs in. */
  transaction_name?: string;
  /** What the step locks. */
  locks?: string;
  /** How many statements the step runs, such as one SELECT per check file. */
  statements?: string;
}

/** An unchangeable record that something happened in the domain, raised by its aggregate and named in the past tense (Loan opened). What it carries are event_field rows. */
export interface DomainEventRow {
  /** The event's ID, such as TL-LEND-EV01. */
  id: string;
  /** The event's name, in the past tense, such as Tool repaired. */
  title: string;
  /** The aggregate that raises it. */
  aggregate_id: string;
  /** What happened, in a sentence. */
  description?: string;
}

/** An HTTP endpoint: its method, route, request and responses. It sits in the API for its resource, or in the domain. */
export interface EndpointRow {
  /** The endpoint's ID, such as TL-LEND-E01. */
  id: string;
  /** What the endpoint does, such as Borrow a tool. */
  title: string;
  /** The domain it belongs to. */
  domain_id: string;
  /** The API of that domain it sits in, if one. */
  api_id?: string;
  /** The HTTP method. */
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
  /** The route, such as /loans or /tools/{toolId}/damage. */
  route: string;
  /** Its request and responses, in a sentence or two. */
  description?: string;
  /** Longer notes on the endpoint. */
  notes?: string;
}

/** One field of an entity, in order. */
export interface EntityFieldRow {
  /** The entity. */
  entity_id: string;
  /** The field's place in the entity, from 1. */
  position: number;
  /** The field's name, such as Returned at. */
  name: string;
  /** What the field means. */
  meaning: string;
  /** The kind of value it holds, such as Date and time. */
  type: string;
  /** An example value. */
  example?: string;
}

/** One field a domain event carries, in order. */
export interface EventFieldRow {
  /** The domain event. */
  domain_event_id: string;
  /** The field's place in the event, from 1. */
  position: number;
  /** The field's name, such as Repaired at. */
  name: string;
  /** What the field means. */
  meaning: string;
  /** The kind of value it holds. */
  type: string;
  /** An example value. */
  example?: string;
}

/** One step of a flow, in order on its path: what happens, through which view, endpoint or component, and what the step carries out. */
export interface FlowStepRow {
  /** The step's ID: its flow's ID and S<nn>, such as TL-LEND-F01-S01. */
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

/** The use case or domain follows the pattern, and gives a value for each of its settings in setting_value rows. */
export interface FollowsRow {
  source_id: string;
  target_id: string;
}

/** The flow, flow step, view, endpoint or interaction requirement carries out the obligation. */
export interface FulfillsRow {
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

/** The component serves the endpoint or renders the view. */
export interface ImplementsRow {
  source_id: string;
  target_id: string;
}

/** An outside system the domain exchanges with, such as a payment provider or a mail service. It holds one interaction requirement per exchange. */
export interface IntegrationRow {
  /** The integration's ID, such as TL-LEND-INT01. */
  id: string;
  /** The integration's name. */
  title: string;
  /** The domain it belongs to. */
  domain_id: string;
  /** The outside system, such as Stripe. */
  system?: string;
  /** What the domain exchanges with it, in a sentence or two. */
  description?: string;
}

/** A screen or page a person uses. */
export interface ViewRow {
  /** The view's ID, such as TL-LEND-V01. */
  id: string;
  /** The view's name, such as Catalog. */
  title: string;
  /** The domain it belongs to. */
  domain_id: string;
  /** The address it is shown at, such as /<domain-id>. */
  route?: string;
  /** What the view shows and lets a person do, in a paragraph. */
  description?: string;
  /** Longer notes on the view. */
  notes?: string;
}

/** One rule a view, endpoint, flow, API or integration must follow, such as a field's limits, an error's response or one exchange with an outside system. One under an API holds for every endpoint in it; one with none of them holds across the domain's interaction design. */
export interface InteractionRequirementRow {
  /** The requirement's ID: its parent's ID and R<nn>, such as TL-LEND-E03-R01, or <P>-<D>-IR<nn> under the domain. */
  id: string;
  /** The requirement in a few words. */
  title: string;
  /** The domain it belongs to. */
  domain_id: string;
  /** The view of that domain it holds for, if one. */
  view_id?: string;
  /** The endpoint of that domain it holds for, if one. */
  endpoint_id?: string;
  /** The flow of that domain it holds for, if one. */
  flow_id?: string;
  /** The API of that domain it holds for, for every endpoint in it, if one. */
  api_id?: string;
  /** The integration of that domain whose exchange it states, if one. */
  integration_id?: string;
  /** The requirement, stated with MUST, MUST NOT, SHOULD or MAY. */
  statement: string;
  /** A short heading it is shown under among its siblings, such as Validation or Paging. */
  group_name?: string;
}

/** The domain rule, under its domain, holds across this aggregate and the others it names. */
export interface InvolvesRow {
  source_id: string;
  target_id: string;
}

/** A library of engineering rules that holds for the product's code, such as logging, error handling or naming. What follows one of its rules meets it; a standard asks nothing of a domain. */
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

/** One rule of a standard. It is not an obligation: what follows it links to it with meets. */
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

/** The component, test or technical step follows the standard rule. */
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

/** One rule of a pattern. Every domain that follows the pattern proves it, unless it names a setting all of that domain's followers mark Not applicable, or its applies-when condition is met by no follower there. */
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

/** A kind a product adds to Lathe's, such as an invariant or a report. Its records sit under one parent kind, and its fields are product_kind_field rows. */
export interface ProductKindRow {
  /** The kind's name, in lower case with underscores, which is also its table's name; it must not be a table Lathe already has. */
  name: string;
  /** The product that declares it; only that product's records may be of the kind. */
  product_id: string;
  /** The kind's name as people read it, such as Invariant. */
  label: string;
  /** What a record of the kind is. */
  description: string;
  /** The kind its records sit under: one of Lathe's or another product kind. Its table gets a <parent_kind>_id column. */
  parent_kind: string;
  /** The stage its records belong to, if one. */
  stage?: "define" | "design";
  /** The folder its records are read in, if one. */
  section?: string;
  /** What a record of the kind asks: full, proof or none. An obligation kind joins the obligation supertype, so it can be designed, proved and carried out. */
  obligation: "none" | "full" | "proof";
  /** How its IDs are written. */
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
  /** design or proof, for a new relation that counts toward coverage. */
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
}

/** The test proves the obligation; this counts as proof. */
export interface ProvesRow {
  source_id: string;
  target_id: string;
}

/** The event is raised when that entity of its aggregate changes. */
export interface RaisedByRow {
  source_id: string;
  target_id: string;
}

/** The aggregate changes, the use case starts or the component handles the event, which may come from another aggregate or domain. */
export interface ReactsToRow {
  source_id: string;
  target_id: string;
}

/** The entity holds a reference to one of the other entity, which may sit in another aggregate or domain (many to one). */
export interface RefersToRow {
  source_id: string;
  target_id: string;
}

/** One aggregate refers to another by ID. */
export interface RelatesToRow {
  source_id: string;
  target_id: string;
}

/** One rule a use case must follow. Shown as a UC (use case) requirement, to tell it apart from interaction requirements and pattern rules. */
export interface RequirementRow {
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

/** A role the product's records name, such as Owner, Reader or Agent: a use case's actors and a question's owner. Specs name roles, never people. */
export interface RoleRow {
  /** The product. */
  product_id: string;
  /** The role's name, such as Librarian. */
  name: string;
  /** Who takes the role and what they do. */
  description?: string;
}

/** The test runs the flow end to end. */
export interface RunsRow {
  source_id: string;
  target_id: string;
}

/** The component or technical step designs the obligation; this counts as design. */
export interface SatisfiesRow {
  source_id: string;
  target_id: string;
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

/** The test checks a mechanism that backs the obligation, such as a lock or a budget, without proving it; it never counts as proof. */
export interface SupportsRow {
  source_id: string;
  target_id: string;
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

/** One step of a use case's main course, in order. */
export interface UseCaseStepRow {
  /** The use case. */
  use_case_id: string;
  /** The step's place, from 1. */
  position: number;
  /** What happens in the step, in a sentence. */
  description: string;
}

/** The flow, step or view passes through, calls or is carried out by the view, endpoint or component. */
export interface UsesRow {
  source_id: string;
  target_id: string;
}

/** Each stored table's row type, by table name. */
export interface TableRows {
  product: ProductRow;
  domain: DomainRow;
  aggregate: AggregateRow;
  capability: CapabilityRow;
  use_case: UseCaseRow;
  layer: LayerRow;
  component: ComponentRow;
  question: QuestionRow;
  about: AboutRow;
  api: ApiRow;
  api_shape: ApiShapeRow;
  entity: EntityRow;
  domain_rule: DomainRuleRow;
  applies: AppliesRow;
  flow: FlowRow;
  carries_out: CarriesOutRow;
  check: CheckRow;
  test: TestRow;
  covers: CoversRow;
  design_flow: DesignFlowRow;
  deepens: DeepensRow;
  depends_on: DependsOnRow;
  design_step: DesignStepRow;
  domain_event: DomainEventRow;
  endpoint: EndpointRow;
  entity_field: EntityFieldRow;
  event_field: EventFieldRow;
  flow_step: FlowStepRow;
  pattern: PatternRow;
  follows: FollowsRow;
  fulfills: FulfillsRow;
  has_many: HasManyRow;
  has_one: HasOneRow;
  implements: ImplementsRow;
  integration: IntegrationRow;
  view: ViewRow;
  interaction_requirement: InteractionRequirementRow;
  involves: InvolvesRow;
  standard: StandardRow;
  standard_rule: StandardRuleRow;
  meets: MeetsRow;
  pattern_setting: PatternSettingRow;
  pattern_rule: PatternRuleRow;
  product_kind: ProductKindRow;
  product_kind_field: ProductKindFieldRow;
  product_relation: ProductRelationRow;
  product_setting: ProductSettingRow;
  proves: ProvesRow;
  raised_by: RaisedByRow;
  reacts_to: ReactsToRow;
  refers_to: RefersToRow;
  relates_to: RelatesToRow;
  requirement: RequirementRow;
  role: RoleRow;
  runs: RunsRow;
  satisfies: SatisfiesRow;
  setting_value: SettingValueRow;
  supports: SupportsRow;
  use_case_actor: UseCaseActorRow;
  use_case_step: UseCaseStepRow;
  uses: UsesRow;
}

/** A stored table of Lathe's schema. */
export type TableName = keyof TableRows;
