// Generated from data/ by `npm run generate`. Do not edit.
// Every command and query, as the CLI (`lathe <slice> <name>`), the MCP server (one tool each) and the HTTP API
// (`POST /api/<slice>/<name>`, or GET for a query) register them.
import type { AnyCommand, AnyQuery, InputsByRoute } from './platform/commands/definition.ts';
import { AGGREGATE_COMMANDS } from './domain-modeling/aggregate/commands/index.ts';
import { BUSINESS_OUTCOME_COMMANDS } from './product/business-outcome/commands/index.ts';
import { CHECK_COMMANDS } from './checking/check/commands/index.ts';
import { COMMAND_COMMANDS } from './domain-modeling/command/commands/index.ts';
import { DATA_STORE_COMMANDS } from './technical-specification/data-store/commands/index.ts';
import { DOMAIN_COMMANDS } from './domain-modeling/domain/commands/index.ts';
import { DOMAIN_EVENT_COMMANDS } from './domain-modeling/domain-event/commands/index.ts';
import { ENDPOINT_COMMANDS } from './interaction-design/endpoint/commands/index.ts';
import { ENTRY_POINT_COMMANDS } from './technical-specification/entry-point/commands/index.ts';
import { EXTENSION_RECORD_COMMANDS } from './product/extension-record/commands/index.ts';
import { INTEGRATION_COMMANDS } from './interaction-design/integration/commands/index.ts';
import { INTERFACE_COMMANDS } from './product/interface/commands/index.ts';
import { JOURNEY_COMMANDS } from './product/journey/commands/index.ts';
import { PATTERN_COMMANDS } from './use-cases/pattern/commands/index.ts';
import { PATTERN_FOLLOWING_COMMANDS } from './traceability/pattern-following/commands/index.ts';
import { PRODUCT_COMMANDS } from './product/product/commands/index.ts';
import { PRODUCT_SETTING_COMMANDS } from './checking/product-setting/commands/index.ts';
import { PROVISION_COMMANDS } from './traceability/provision/commands/index.ts';
import { READ_MODEL_COMMANDS } from './domain-modeling/read-model/commands/index.ts';
import { SLOT_FILLING_COMMANDS } from './traceability/slot-filling/commands/index.ts';
import { SPECIFICATION_COMMANDS } from './domain-modeling/specification/commands/index.ts';
import { STANDARD_COMMANDS } from './technical-specification/standard/commands/index.ts';
import { STORAGE_REQUIREMENT_COMMANDS } from './domain-modeling/storage-requirement/commands/index.ts';
import { TABLE_COMMANDS } from './technical-specification/table/commands/index.ts';
import { TEST_DATA_SET_COMMANDS } from './test-planning/test-data-set/commands/index.ts';
import { TOOLING_COMMANDS } from './technical-specification/tooling/commands/index.ts';
import { UI_COMPONENT_COMMANDS } from './interaction-design/ui-component/commands/index.ts';
import { USE_CASE_COMMANDS } from './use-cases/use-case/commands/index.ts';
import { VALUE_OBJECT_COMMANDS } from './domain-modeling/value-object/commands/index.ts';
import { VIEW_COMMANDS } from './interaction-design/view/commands/index.ts';
import { GET_AGGREGATE, LIST_AGGREGATES, NEXT_AGGREGATE_ID } from './domain-modeling/aggregate/queries.ts';
import { GET_BUSINESS_OUTCOME, LIST_BUSINESS_OUTCOMES, NEXT_BUSINESS_OUTCOME_ID } from './product/business-outcome/queries.ts';
import { GET_REACH } from './traceability/change-reach/queries.ts';
import { GET_CHECK, LIST_CHECKS } from './checking/check/queries.ts';
import { GET_COMMAND, LIST_COMMANDS, NEXT_COMMAND_ID } from './domain-modeling/command/queries.ts';
import { GET_COVERAGE } from './traceability/coverage/queries.ts';
import { LIST_COVERAGE_GAPS, FIND_UNUSED_PACKAGES } from './traceability/coverage-gaps/queries.ts';
import { GET_DATA_STORE, LIST_DATA_STORES, NEXT_DATA_STORE_ID } from './technical-specification/data-store/queries.ts';
import { GET_DOMAIN, LIST_DOMAINS, NEXT_DOMAIN_ID } from './domain-modeling/domain/queries.ts';
import { GET_DOMAIN_EVENT, LIST_DOMAIN_EVENTS, NEXT_DOMAIN_EVENT_ID } from './domain-modeling/domain-event/queries.ts';
import { GET_ENDPOINT, LIST_ENDPOINTS, NEXT_ENDPOINT_ID } from './interaction-design/endpoint/queries.ts';
import { GET_ENTRY_POINT, LIST_ENTRY_POINTS, NEXT_ENTRY_POINT_ID } from './technical-specification/entry-point/queries.ts';
import { GET_ERD } from './exploring/erd/queries.ts';
import { LIST_ESSENTIAL_RECORDS } from './checking/essential-review/queries.ts';
import { GET_EXTENSION_RECORD, LIST_EXTENSION_RECORDS, NEXT_EXTENSION_RECORD_ID } from './product/extension-record/queries.ts';
import { LIST_TRACED_ADDRESSES } from './traceability/file-facts/queries.ts';
import { GET_FOLDER_TREE } from './exploring/folder-tree/queries.ts';
import { GET_INTEGRATION, LIST_INTEGRATIONS, NEXT_INTEGRATION_ID } from './interaction-design/integration/queries.ts';
import { GET_JOURNEY, LIST_JOURNEYS, NEXT_JOURNEY_ID } from './product/journey/queries.ts';
import { GET_META_MODEL } from './platform/meta-model/queries.ts';
import { GET_PATTERN, LIST_PATTERNS, NEXT_PATTERN_ID } from './use-cases/pattern/queries.ts';
import { GET_FOLLOWING, LIST_FOLLOWINGS, LIST_FOLLOWERS } from './traceability/pattern-following/queries.ts';
import { LIST_PROBLEMS } from './checking/problems/queries.ts';
import { GET_PRODUCT, LIST_INTERFACES, NEXT_PRODUCT_ID, LIST_PRODUCTS } from './product/product/queries.ts';
import { GET_LIMITS } from './checking/product-setting/queries.ts';
import { GET_READ_MODEL, LIST_READ_MODELS, NEXT_READ_MODEL_ID } from './domain-modeling/read-model/queries.ts';
import { LIST_RECORD_CHANGES } from './exploring/record-changes/queries.ts';
import { FIND_RECORD_DATA_FILE } from './product/record-data-file/queries.ts';
import { LIST_RECORD_SUMMARIES } from './exploring/record-summaries/queries.ts';
import { GET_RECORD_TRACE } from './traceability/record-trace/queries.ts';
import { GET_SERVES, LIST_SERVES } from './traceability/serves/queries.ts';
import { GET_SPECIFICATION, LIST_SPECIFICATIONS, NEXT_SPECIFICATION_ID } from './domain-modeling/specification/queries.ts';
import { GET_STANDARD, LIST_STANDARDS, NEXT_STANDARD_ID } from './technical-specification/standard/queries.ts';
import { GET_STORAGE_REQUIREMENT, LIST_STORAGE_REQUIREMENTS, NEXT_STORAGE_REQUIREMENT_ID } from './domain-modeling/storage-requirement/queries.ts';
import { FIND_UNDEFINED_STORED_KINDS } from './traceability/stored-record-facts/queries.ts';
import { GET_TABLE, LIST_TABLES, NEXT_TABLE_ID } from './technical-specification/table/queries.ts';
import { GET_TEST_DATA_SET, LIST_TEST_DATA_SETS, NEXT_TEST_DATA_SET_ID } from './test-planning/test-data-set/queries.ts';
import { GET_TEST_COUNTS } from './traceability/tests-by-state/queries.ts';
import { GET_TOOLING, LIST_TOOLING, NEXT_TOOLING_ID } from './technical-specification/tooling/queries.ts';
import { LIST_TRACED_USE_CASES, GET_JOURNEY_PROOF } from './traceability/trace/queries.ts';
import { GET_UI_COMPONENT, LIST_UI_COMPONENTS, NEXT_UI_COMPONENT_ID } from './interaction-design/ui-component/queries.ts';
import { GET_USE_CASE, LIST_USE_CASES, NEXT_USE_CASE_ID } from './use-cases/use-case/queries.ts';
import { GET_VALUE_OBJECT, LIST_VALUE_OBJECTS, NEXT_VALUE_OBJECT_ID } from './domain-modeling/value-object/queries.ts';
import { GET_VIEW, LIST_VIEWS, NEXT_VIEW_ID } from './interaction-design/view/queries.ts';

const COMMANDS = [
  ...AGGREGATE_COMMANDS,
  ...BUSINESS_OUTCOME_COMMANDS,
  ...CHECK_COMMANDS,
  ...COMMAND_COMMANDS,
  ...DATA_STORE_COMMANDS,
  ...DOMAIN_COMMANDS,
  ...DOMAIN_EVENT_COMMANDS,
  ...ENDPOINT_COMMANDS,
  ...ENTRY_POINT_COMMANDS,
  ...EXTENSION_RECORD_COMMANDS,
  ...INTEGRATION_COMMANDS,
  ...INTERFACE_COMMANDS,
  ...JOURNEY_COMMANDS,
  ...PATTERN_COMMANDS,
  ...PATTERN_FOLLOWING_COMMANDS,
  ...PRODUCT_COMMANDS,
  ...PRODUCT_SETTING_COMMANDS,
  ...PROVISION_COMMANDS,
  ...READ_MODEL_COMMANDS,
  ...SLOT_FILLING_COMMANDS,
  ...SPECIFICATION_COMMANDS,
  ...STANDARD_COMMANDS,
  ...STORAGE_REQUIREMENT_COMMANDS,
  ...TABLE_COMMANDS,
  ...TEST_DATA_SET_COMMANDS,
  ...TOOLING_COMMANDS,
  ...UI_COMPONENT_COMMANDS,
  ...USE_CASE_COMMANDS,
  ...VALUE_OBJECT_COMMANDS,
  ...VIEW_COMMANDS,
] as const;

export const ALL_COMMANDS: readonly AnyCommand[] = COMMANDS;

/** Each command's route, with its input: what the app sends, typed by its definition. @public (the app's writer) */
export type CommandInputs = InputsByRoute<(typeof COMMANDS)[number]>;

export const ALL_QUERIES: readonly AnyQuery[] = [
  GET_AGGREGATE,
  LIST_AGGREGATES,
  NEXT_AGGREGATE_ID,
  GET_BUSINESS_OUTCOME,
  LIST_BUSINESS_OUTCOMES,
  NEXT_BUSINESS_OUTCOME_ID,
  GET_REACH,
  GET_CHECK,
  LIST_CHECKS,
  GET_COMMAND,
  LIST_COMMANDS,
  NEXT_COMMAND_ID,
  GET_COVERAGE,
  LIST_COVERAGE_GAPS,
  FIND_UNUSED_PACKAGES,
  GET_DATA_STORE,
  LIST_DATA_STORES,
  NEXT_DATA_STORE_ID,
  GET_DOMAIN,
  LIST_DOMAINS,
  NEXT_DOMAIN_ID,
  GET_DOMAIN_EVENT,
  LIST_DOMAIN_EVENTS,
  NEXT_DOMAIN_EVENT_ID,
  GET_ENDPOINT,
  LIST_ENDPOINTS,
  NEXT_ENDPOINT_ID,
  GET_ENTRY_POINT,
  LIST_ENTRY_POINTS,
  NEXT_ENTRY_POINT_ID,
  GET_ERD,
  LIST_ESSENTIAL_RECORDS,
  GET_EXTENSION_RECORD,
  LIST_EXTENSION_RECORDS,
  NEXT_EXTENSION_RECORD_ID,
  LIST_TRACED_ADDRESSES,
  GET_FOLDER_TREE,
  GET_INTEGRATION,
  LIST_INTEGRATIONS,
  NEXT_INTEGRATION_ID,
  GET_JOURNEY,
  LIST_JOURNEYS,
  NEXT_JOURNEY_ID,
  GET_META_MODEL,
  GET_PATTERN,
  LIST_PATTERNS,
  NEXT_PATTERN_ID,
  GET_FOLLOWING,
  LIST_FOLLOWINGS,
  LIST_FOLLOWERS,
  LIST_PROBLEMS,
  GET_PRODUCT,
  LIST_INTERFACES,
  NEXT_PRODUCT_ID,
  LIST_PRODUCTS,
  GET_LIMITS,
  GET_READ_MODEL,
  LIST_READ_MODELS,
  NEXT_READ_MODEL_ID,
  LIST_RECORD_CHANGES,
  FIND_RECORD_DATA_FILE,
  LIST_RECORD_SUMMARIES,
  GET_RECORD_TRACE,
  GET_SERVES,
  LIST_SERVES,
  GET_SPECIFICATION,
  LIST_SPECIFICATIONS,
  NEXT_SPECIFICATION_ID,
  GET_STANDARD,
  LIST_STANDARDS,
  NEXT_STANDARD_ID,
  GET_STORAGE_REQUIREMENT,
  LIST_STORAGE_REQUIREMENTS,
  NEXT_STORAGE_REQUIREMENT_ID,
  FIND_UNDEFINED_STORED_KINDS,
  GET_TABLE,
  LIST_TABLES,
  NEXT_TABLE_ID,
  GET_TEST_DATA_SET,
  LIST_TEST_DATA_SETS,
  NEXT_TEST_DATA_SET_ID,
  GET_TEST_COUNTS,
  GET_TOOLING,
  LIST_TOOLING,
  NEXT_TOOLING_ID,
  LIST_TRACED_USE_CASES,
  GET_JOURNEY_PROOF,
  GET_UI_COMPONENT,
  LIST_UI_COMPONENTS,
  NEXT_UI_COMPONENT_ID,
  GET_USE_CASE,
  LIST_USE_CASES,
  NEXT_USE_CASE_ID,
  GET_VALUE_OBJECT,
  LIST_VALUE_OBJECTS,
  NEXT_VALUE_OBJECT_ID,
  GET_VIEW,
  LIST_VIEWS,
  NEXT_VIEW_ID,
];
