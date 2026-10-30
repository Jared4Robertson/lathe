import type { ComponentType, ReactNode } from 'react';
import type { AggregateKind } from '../../../lathe/src/authoring/aggregate/model';
import type { CommandKind } from '../../../lathe/src/authoring/command/model';
import type { MetaIndex } from '../platform/meta-model/reads';
import type { StorageRequirementKind } from '../../../lathe/src/authoring/storage-requirement/model';
import { AddStorageRequirementForm } from '../authoring/storage-requirement/StorageRequirementEditor';
import { StorageRequirementPage } from '../authoring/storage-requirement/StorageRequirementPage';
import { AddDataStoreForm } from '../authoring/data-store/DataStoreEditor';
import { DataStorePage } from '../authoring/data-store/DataStorePage';
import type { UseCaseKind } from '../../../lathe/src/authoring/use-case/model';
import { AddBusinessOutcomeForm } from '../authoring/business-outcome/BusinessOutcomeEditor';
import { BusinessOutcomePage } from '../authoring/business-outcome/BusinessOutcomePage';
import { AddEntryPointForm } from '../authoring/entry-point/EntryPointEditor';
import { EntryPointPage } from '../authoring/entry-point/EntryPointPage';
import { AddExtensionRecordForm } from '../authoring/extension-record/ExtensionRecordEditor';
import { ExtensionRecordPage } from '../authoring/extension-record/ExtensionRecordPage';
import { AddQuestionForm } from '../authoring/product/ProductEditor';
import { ProductPage } from '../authoring/product/ProductPage';
import { AddToolingForm } from '../authoring/tooling/ToolingEditor';
import { ToolingPage } from '../authoring/tooling/ToolingPage';
import type { DomainKind } from '../../../lathe/src/authoring/domain/model';
import type { DomainEventKind } from '../../../lathe/src/authoring/domain-event/model';
import type { PatternKind } from '../../../lathe/src/authoring/pattern/model';
import type { StandardKind } from '../../../lathe/src/authoring/standard/model';
import { AddAggregateForm } from '../authoring/aggregate/AggregateEditor';
import { AggregatePage } from '../authoring/aggregate/AggregatePage';
import { AddCommandForm } from '../authoring/command/CommandEditor';
import { CommandPage } from '../authoring/command/CommandPage';
import { AddDomainForm } from '../authoring/domain/DomainEditor';
import { DomainPage } from '../authoring/domain/DomainPage';
import { AddDomainEventForm } from '../authoring/domain-event/DomainEventEditor';
import { DomainEventPage } from '../authoring/domain-event/DomainEventPage';
import { AddPatternForm } from '../authoring/pattern/PatternEditor';
import { PatternPage } from '../authoring/pattern/PatternPage';
import { AddStandardForm } from '../authoring/standard/StandardEditor';
import { StandardPage } from '../authoring/standard/StandardPage';
import { AddTestDataSetForm } from '../authoring/test-data-set/TestDataSetEditor';
import { TestDataSetPage } from '../authoring/test-data-set/TestDataSetPage';
import { AddUseCaseForm } from '../authoring/use-case/UseCaseEditor';
import { UseCasePage } from '../authoring/use-case/UseCasePage';
import type { ViewKind } from '../../../lathe/src/authoring/view/model';
import { AddViewForm } from '../authoring/view/ViewEditor';
import { ViewPage } from '../authoring/view/ViewPage';
import { AddUiComponentForm } from '../authoring/ui-component/UiComponentEditor';
import { UiComponentPage } from '../authoring/ui-component/UiComponentPage';
import type { EndpointKind } from '../../../lathe/src/authoring/endpoint/model';
import { AddEndpointForm } from '../authoring/endpoint/EndpointEditor';
import { EndpointPage } from '../authoring/endpoint/EndpointPage';
import type { IntegrationKind } from '../../../lathe/src/authoring/integration/model';
import { AddIntegrationForm } from '../authoring/integration/IntegrationEditor';
import { IntegrationPage } from '../authoring/integration/IntegrationPage';
import type { ReadModelKind } from '../../../lathe/src/authoring/read-model/model';
import type { SpecificationKind } from '../../../lathe/src/authoring/specification/model';
import type { ValueObjectKind } from '../../../lathe/src/authoring/value-object/model';
import { AddReadModelForm } from '../authoring/read-model/ReadModelEditor';
import { ReadModelPage } from '../authoring/read-model/ReadModelPage';
import { AddSpecificationForm } from '../authoring/specification/SpecificationEditor';
import { SpecificationPage } from '../authoring/specification/SpecificationPage';
import { AddTableForm } from '../authoring/table/TableEditor';
import { TablePage } from '../authoring/table/TablePage';
import { AddValueObjectForm } from '../authoring/value-object/ValueObjectEditor';
import { ValueObjectPage } from '../authoring/value-object/ValueObjectPage';
import { type RecordIndex } from '../exploring/record-summaries/record-index';

// The Record page's typed list of aggregate pages: each of Lathe's kinds names its aggregate's page (app/src/<domain>/
// <aggregate>/), which reads the aggregate whole and changes it only through the aggregate's own commands. The list is
// total over Lathe's kinds: a test holds it to the schema's kinds, so a kind with no page fails. The Record page shell (the wiki card) finds a
// kind's page here. Adding an aggregate's root from the page it sits under (a use
// case from its capability's page) goes through its aggregate's own Add form, listed in ADDERS. A kind a product declares
// as its own is the Extension record aggregate's, whatever its name: its page and Add form are that aggregate's, found
// by the schema's declaration rather than by name.

export interface AggregatePageProps {
  index: RecordIndex;
  /** The record the page is at: the aggregate's root or any record inside it. */
  id: string;
  /** The wiki card's summary (its lead and key facts) in place of the whole page. */
  summary?: boolean;
  /** What follows the page's content: the card's changes and history. */
  after?: ReactNode;
}

/** The kinds with an aggregate page. */
type PagedKind = UseCaseKind | DomainKind | 'test_data_set' | PatternKind | StandardKind | 'product' | 'question' | 'interface' | 'business_outcome' | 'entry_point' | 'tooling' | SpecificationKind | ValueObjectKind | ReadModelKind | 'table' | AggregateKind | DomainEventKind | CommandKind | ViewKind | 'ui_component' | EndpointKind | IntegrationKind | StorageRequirementKind | 'data_store';

/** Each kind with its aggregate's page. */
const PAGES: { readonly [K in PagedKind]: ComponentType<AggregatePageProps> } = {
  use_case: UseCasePage,
  uc_requirement: UseCasePage,
  use_case_test: UseCasePage,
  flow: UseCasePage,
  flow_step: UseCasePage,
  flow_test: UseCasePage,
  domain: DomainPage,
  capability: DomainPage,
  term: DomainPage,
  domain_service: DomainPage,
  service: DomainPage,
  domain_service_test: DomainPage,
  repository: DomainPage,
  test_data_set: TestDataSetPage,
  pattern: PatternPage,
  pattern_rule: PatternPage,
  pattern_rule_test: PatternPage,
  standard: StandardPage,
  standard_rule: StandardPage,
  standard_rule_test: StandardPage,
  aggregate: AggregatePage,
  entity: AggregatePage,
  invariant: AggregatePage,
  data_model: AggregatePage,
  rule: AggregatePage,
  invariant_test: AggregatePage,
  domain_event: DomainEventPage,
  event_type: DomainEventPage,
  command: CommandPage,
  command_handler: CommandPage,
  policy: CommandPage,
  event_handler: CommandPage,
  policy_test: CommandPage,
  product: ProductPage,
  question: ProductPage,
  interface: ProductPage,
  business_outcome: BusinessOutcomePage,
  entry_point: EntryPointPage,
  tooling: ToolingPage,
  view: ViewPage,
  view_requirement: ViewPage,
  view_test: ViewPage,
  ui_component: UiComponentPage,
  endpoint: EndpointPage,
  api_requirement: EndpointPage,
  endpoint_handler: EndpointPage,
  endpoint_test: EndpointPage,
  integration: IntegrationPage,
  adapter: IntegrationPage,
  integration_test: IntegrationPage,
  specification: SpecificationPage,
  predicate: SpecificationPage,
  specification_test: SpecificationPage,
  value_object: ValueObjectPage,
  constraint: ValueObjectPage,
  value_type: ValueObjectPage,
  constraint_test: ValueObjectPage,
  read_model: ReadModelPage,
  query: ReadModelPage,
  projection: ReadModelPage,
  reader: ReadModelPage,
  query_handler: ReadModelPage,
  table: TablePage,
  storage_requirement: StorageRequirementPage,
  storage_requirement_test: StorageRequirementPage,
  data_store: DataStorePage,
};

/** Whether the kind is one a product declares as its own: a kind of the Extension record aggregate. */
const declared = (meta: MetaIndex, kind: string) => (meta.kinds.get(kind)?.declared_by ?? null) !== null;

/** The page of the kind's aggregate, or undefined for a kind the meta model does not know (a kind gone from the schema while its rows remain). */
export function pageOf(meta: MetaIndex, kind: string): ComponentType<AggregatePageProps> | undefined {
  if (declared(meta, kind)) return ExtensionRecordPage;
  return Object.hasOwn(PAGES, kind) ? PAGES[kind as PagedKind] : undefined;
}

export interface AggregateAdderProps {
  index: RecordIndex;
  /** The record it is added under, from whose page. */
  parent: string;
  onDone: () => void;
}

/** Each aggregate root added from the page of what it sits under, with its aggregate's Add form. */
const ADDERS: { readonly [K in 'use_case' | 'domain' | 'test_data_set' | 'pattern' | 'standard' | 'business_outcome' | 'question' | 'entry_point' | 'tooling' | 'specification' | 'value_object' | 'read_model' | 'table' | 'aggregate' | 'domain_event' | 'command' | 'view' | 'ui_component' | 'endpoint' | 'integration' | 'storage_requirement' | 'data_store']: ComponentType<AggregateAdderProps> } = {
  use_case: AddUseCaseForm,
  domain: AddDomainForm,
  test_data_set: AddTestDataSetForm,
  pattern: AddPatternForm,
  standard: AddStandardForm,
  aggregate: AddAggregateForm,
  domain_event: AddDomainEventForm,
  command: AddCommandForm,
  business_outcome: AddBusinessOutcomeForm,
  question: AddQuestionForm,
  entry_point: AddEntryPointForm,
  tooling: AddToolingForm,
  view: AddViewForm,
  ui_component: AddUiComponentForm,
  endpoint: AddEndpointForm,
  integration: AddIntegrationForm,
  specification: AddSpecificationForm,
  value_object: AddValueObjectForm,
  read_model: AddReadModelForm,
  table: AddTableForm,
  storage_requirement: AddStorageRequirementForm,
  data_store: AddDataStoreForm,
};

/** The Extension record aggregate's Add form for each declared kind, made once per kind so a form keeps its draft. */
const declaredAdders = new Map<string, ComponentType<AggregateAdderProps>>();

/**
 * The roots of other aggregates a record of this kind adds under it through their own Add form, in reading order: the
 * kinds whose parents include it, and for a product or a domain the kinds with no owner whose IDs it scopes.
 */
export function othersAddedUnder(meta: MetaIndex, kind: string): string[] {
  const scope = kind === 'product' ? 'product' : kind === 'domain' ? 'domain' : null;
  return meta.kindList
    .filter((k) => k.parent_kinds.includes(kind) || (scope !== null && k.parent_kinds.length === 0 && k.id_scope === scope))
    .map((k) => k.kind)
    .filter((k) => adderOf(meta, k) !== undefined);
}

/** Adds a record of the kind under the parent from another aggregate's page (such as a view from its product's page), through its aggregate's Add form. */
export function AddUnder({ index, parent, kind, onDone }: AggregateAdderProps & { kind: string }) {
  const Adder = adderOf(index.meta, kind);
  return Adder ? <Adder index={index} parent={parent} onDone={onDone} /> : null;
}

/** The Add form of the kind's aggregate, or undefined for a kind no aggregate adds from another's page. */
export function adderOf(meta: MetaIndex, kind: string): ComponentType<AggregateAdderProps> | undefined {
  if (declared(meta, kind)) {
    if (!declaredAdders.has(kind)) declaredAdders.set(kind, (props: AggregateAdderProps) => <AddExtensionRecordForm {...props} kind={kind} />);
    return declaredAdders.get(kind);
  }
  return Object.hasOwn(ADDERS, kind) ? ADDERS[kind as keyof typeof ADDERS] : undefined;
}
